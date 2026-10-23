/* ============ Piétons, cycles et bus ============
   Une route barrée peut fermer aussi ses trottoirs (« piétons déviés ») : l'itinéraire piéton est alors calculé sur le
   réseau marchable (trottoirs, chemins, rues piétonnes, pistes cyclables, rues circulées hors voies rapides), sans le tronçon
   fermé ni les trottoirs tracés le long de lui. Les arrêts de bus situés sur une section barrée sont signalés (arrêt
   provisoire à créer, transporteur à prévenir) ; un modèle « Arrêt de bus provisoire » est ajouté à la bibliothèque. */
const PED_COL = '#2E7D32';
let WALK = null;
function walkGraph(){
  if (WALK && WALK.W === WORLD?.W) return WALK;
  const W = WORLD.W, adj = new Map(), segs = [];
  const add = (a, b, len, ri) => { (adj.get(a) || adj.set(a, []).get(a)).push({to:b, len, key:segKey(a, b), ri}); };
  W.roads.forEach((r, ri) => {
    if (/^(elevator|corridor|platform|bridleway)$/.test(r.hw)) return;
    const walk = r.foot || (r.drive && r.cls >= 2 && !r.tunnel && !(r.tags?.sidewalk === 'no' && r.tags?.foot !== 'yes' && r.cls <= 4)) || r.psv;
    if (!walk) return;
    for (let k = 0; k + 1 < r.nodes.length; k++){ const a = r.nodes[k], b = r.nodes[k + 1], A = W.nodes.get(a), B = W.nodes.get(b); if (!A || !B || a === b) continue;
      const len = V.dist(A, B); add(a, b, len, ri); add(b, a, len, ri); if (r.foot) segs.push({a, b, A, B, ri}); }
  });
  return WALK = {W, adj, segs};
}
/* segments fermés aux piétons : la section barrée + les trottoirs tracés à part le long d'elle (parallèles, à moins de 12 m) */
function pedClosedKeys(c){
  const G = walkGraph(), keys = new Set();
  for (let i = 0; i + 1 < c.ids.length; i++) keys.add(segKey(c.ids[i], c.ids[i + 1]));
  for (const s of G.segs){
    const m = V.mul(V.add(s.A, s.B), 0.5), d = V.norm(V.sub(s.B, s.A)); const q = plClosest(c.pts, m); if (!q || V.dist(q.pt, m) > 12) continue;
    const L = plLen(c.pts); if (q.s < 3 || q.s > L - 3) continue;   // les traversées aux carrefours restent ouvertes
    const cd = plAt(c.pts, q.s).dir; if (Math.abs(V.dot(d, cd)) > 0.8) keys.add(segKey(s.a, s.b));
  }
  return keys;
}
function walkRoute(from, to, closed){
  const G = walkGraph(), T = WORLD.W.nodes.get(to); if (!G.adj.has(from) || !T) return null;
  const g = new Map([[from, 0]]), prev = new Map(), open = [[V.dist(WORLD.W.nodes.get(from), T), 0, from]]; let it = 0;
  while (open.length && it++ < 60000){
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, c, n] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (c > (g.get(n) ?? Infinity) + 1e-9) continue; if (n === to) break;
    for (const e of G.adj.get(n) || []){ if (closed.has(e.key)) continue; const nc = c + e.len * (NET.roads?.[e.ri]?.foot ? 0.9 : 1); if (nc < (g.get(e.to) ?? Infinity)){ g.set(e.to, nc); prev.set(e.to, n); open.push([nc + V.dist(WORLD.W.nodes.get(e.to), T), nc, e.to]); } }
  }
  if (!g.has(to)) return null;
  const ids = [to]; while (ids[0] !== from) ids.unshift(prev.get(ids[0]));
  const pts = ids.map(id => WORLD.W.nodes.get(id)); return {ids, pts, len:plLen(pts)};
}
/* (re)calcule le cheminement piéton dévié d'une fermeture */
function pedDetour(c){
  state.els = state.els.filter(e => !(e.t === 'pdetour' && e.cl === c.id && e.auto) && !(e.t === 'obj' && e.pauto === c.id));
  if (c.ped !== 'devie' || !WORLD || !(c.ids?.length > 1) || c.mode === 'alternat' || c.mode === 'voie') return null;
  const r = walkRoute(c.ids[0], c.ids[c.ids.length - 1], pedClosedKeys(c));
  if (!r){ c.pedFail = true; return null; } delete c.pedFail;
  const names = [...new Set(r.ids.slice(1).map((id, k) => NET.segIdx.get(segKey(r.ids[k], id))?.ri).filter(x => x != null).map(ri => NET.roads[ri]?.name).filter(Boolean))].filter(n => n !== c.name);
  state.els.push({id:uid8(), t:'pdetour', cl:c.id, ph:c.ph, auto:true, ids:r.ids, pts:r.pts, len:r.len, extra:Math.max(0, r.len - (c.len || plLen(c.pts))), via:names.join(', '), name:`Cheminement piéton dévié${c.name ? ' · ' + c.name : ''}`});
  // panneaux « accès interdit aux piétons » (B9g) sur les trottoirs, aux deux extrémités
  const w = closureWidth(c) / 2 + 1.2;
  for (const [p, q] of [[c.pts[0], c.pts[1]], [c.pts[c.pts.length - 1], c.pts[c.pts.length - 2]]]){ const d = V.norm(V.sub(q, p)), n = V.perp(d);
    for (const s of [1, -1]){ const o = V.add(V.add(p, V.mul(d, 4)), V.mul(n, s * w)); state.els.push({id:uid8(), t:'obj', k:'B9g', x:o[0], y:o[1], a:Math.atan2(-d[1], -d[0]), pauto:c.id, auto:c.id, ph:c.ph}); } }
  return r;
}
/* arrêts de bus sur les sections barrées */
function busStopsOn(c){
  if (!WORLD || !(c.pts?.length > 1) || c.mode === 'alternat' || c.mode === 'voie') return [];
  return WORLD.W.points.filter(p => p.k === 'bus_stop' || p.tags?.public_transport === 'platform' && p.tags?.bus === 'yes').filter(p => { const q = plClosest(c.pts, [p.x, p.y]); return q && V.dist(q.pt, [p.x, p.y]) < 22; })
    .map(p => ({name:p.tags?.name || 'Arrêt sans nom', x:p.x, y:p.y, lines:p.tags?.route_ref || p.tags?.['bus_routes'] || ''}));
}
function pedChecks(add, els){
  for (const c of els.filter(e => e.t === 'closure' && e.pts?.length > 1)){
    const mid = plAt(c.pts, plLen(c.pts) / 2).pt, nm = c.name || 'Rue';
    if (c.ped === 'devie'){ const pd = els.find(d => d.t === 'pdetour' && d.cl === c.id); if (!pd) add('err', `${nm} : piétons déviés mais aucun cheminement possible (à aménager : passage protégé provisoire)`, mid); else add('ok', `${nm} : cheminement piéton dévié (${fmtM(pd.len)}, +${fmtM(pd.extra || 0)})`, mid); }
    else if (c.mode === 'total') add('info', `${nm} : cheminement piéton maintenu le long du chantier (largeur ≥ 1,40 m, séparé de l'emprise)`, mid);
    for (const s of busStopsOn(c)){ const prov = els.some(o => o.t === 'obj' && o.k === 'arretBus' && Math.hypot(o.x - s.x, o.y - s.y) < 250);
      add(prov ? 'ok' : 'err', prov ? `Arrêt de bus « ${s.name} » : arrêt provisoire posé` : `Arrêt de bus « ${s.name} »${s.lines ? ` (lignes ${s.lines})` : ''} sur la section barrée : arrêt provisoire à créer et transporteur à prévenir`, [s.x, s.y]); }
  }
}
/* modèle : arrêt de bus provisoire (poteau, plaque « BUS · arrêt provisoire », socle lesté) */
function arretBusProv(){
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 10), C.galva, 0, 1.3, 0));
  g.add(part(new THREE.BoxGeometry(0.62, 0.14, 0.62), C.concrete, 0, 0.07, 0));
  const tex = TEX.busProv ??= canvasTex(256, 384, (c, w, h) => { c.fillStyle = '#F2B705'; c.fillRect(0, 0, w, h); c.fillStyle = '#0B3D91'; c.fillRect(14, 14, w - 28, 170); c.fillStyle = '#fff'; c.font = '800 118px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BUS', w / 2, 102);
    c.fillStyle = '#111'; c.font = '700 40px Arial'; c.fillText('ARRÊT', w / 2, 236); c.fillText('PROVISOIRE', w / 2, 284); c.font = '500 26px Arial'; c.fillText('travaux', w / 2, 334); });
  const m = MAT.busProv ??= new THREE.MeshStandardMaterial({map:tex, roughness:0.5});
  g.add(part(new THREE.BoxGeometry(0.5, 0.75, 0.03), [C.white, C.white, C.white, C.white, m, m], 0, 2.15, 0));
  return g;
}
libAdd('chan', 'arretBus', 'Arrêt de bus provisoire', arretBusProv, {ref:'Arrêt provisoire'}); LIBK.arretBus = LIB[LIB.length - 1];
