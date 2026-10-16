/* ============ Réseau routier : graphe orienté, tronçons, itinéraires et déviations ============
   Construit à partir des voies OpenStreetMap de la zone : sens uniques (oneway, giratoires), interdictions et obligations de tourner
   (relations « restriction »), impasses (naturellement : aucune sortie), vitesses. Les routes barrées du projet retirent leurs
   tronçons du graphe (dans les deux sens, ou dans un seul sens) ; les itinéraires de déviation sont calculés sur le graphe ainsi modifié. */
const NET = {nodes:new Map(), edges:[], segIdx:new Map(), grid:new Map(), cell:20, restr:new Map(), only:new Map(), roads:[]};
const segKey = (a, b) => a < b ? `${a}_${b}` : `${b}_${a}`;
function buildNet(W){
  const N = {nodes:new Map(), edges:[], segIdx:new Map(), grid:new Map(), cell:20, restr:new Map(), only:new Map(), roads:W.roads};
  const node = id => { let n = N.nodes.get(id); if (!n){ const xy = W.nodes.get(id); if (!xy) return null; n = {id, xy, out:[], inn:[], nb:new Set(), ways:new Set(), sig:false, stop:false, give:false, cross:false}; N.nodes.set(id, n); } return n; };
  W.roads.forEach((r, ri) => {
    if (!r.drive) return;
    for (let k = 0; k + 1 < r.nodes.length; k++){
      const a = node(r.nodes[k]), b = node(r.nodes[k + 1]); if (!a || !b || a === b) continue;
      a.nb.add(b.id); b.nb.add(a.id); a.ways.add(ri); b.ways.add(ri);
      const len = V.dist(a.xy, b.xy) || 0.01, sp = r.speed / 3.6;
      const mk = (f, t, rev) => { const e = {i:N.edges.length, from:f.id, to:t.id, r:ri, k, rev, len, sp, cls:r.cls, key:segKey(f.id, t.id), pl:plOk(r), dest:/^(destination|delivery)$/.test(r.tags?.motor_vehicle || r.tags?.vehicle || r.tags?.access || ''), z30:(r.speed || 50) <= 30, hz:/^no$/.test(r.tags?.hazmat || ''), dl:!!r.deles, dep:/^[DNM]\s?\d/i.test(r.ref || '')}; N.edges.push(e); f.out.push(e.i); t.inn.push(e.i); return e; };
      if (r.oneway >= 0) mk(a, b, false);
      if (r.oneway <= 0) mk(b, a, true);
      const sk = segKey(a.id, b.id); if (!N.segIdx.has(sk)) N.segIdx.set(sk, {ri, k, a:a.id, b:b.id});
    }
  });
  for (const p of W.points){ const n = N.nodes.get(p.id); if (!n) continue; if (p.k === 'traffic_signals') n.sig = true; else if (p.k === 'stop') n.stop = true; else if (p.k === 'give_way') n.give = true; else if (p.k === 'crossing') n.cross = true; else if (p.k === 'mini_roundabout') n.mini = true; }
  // abords d'écoles, crèches, collèges, hôpitaux (à moins de 80 m) : on n'y fait pas passer une déviation si l'on peut l'éviter
  const SENS = W.sens || []; for (const e of N.edges){ const a = N.nodes.get(e.from).xy, b = N.nodes.get(e.to).xy, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; e.near = SENS.some(q => Math.hypot(q.x - m[0], q.y - m[1]) < 80); }
  for (const p of W.points) if (p.k === 'level_crossing'){ const n = N.nodes.get(p.id); if (n) n.lc = true; }
  for (const R of W.restr){ const k = `${R.from}|${R.via}`; if (R.only) N.only.set(k, R.to); else { (N.restr.get(k) || N.restr.set(k, new Set()).get(k)).add(R.to); } }
  // index spatial des segments (toutes voies, piétonnes comprises, pour l'accroche)
  W.roads.forEach((r, ri) => { for (let k = 0; k + 1 < r.pts.length; k++){ const a = r.pts[k], b = r.pts[k + 1];
    const x0 = Math.floor(Math.min(a[0], b[0]) / N.cell), x1 = Math.floor(Math.max(a[0], b[0]) / N.cell), y0 = Math.floor(Math.min(a[1], b[1]) / N.cell), y1 = Math.floor(Math.max(a[1], b[1]) / N.cell);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++){ const key = x + ',' + y; (N.grid.get(key) || N.grid.set(key, []).get(key)).push([ri, k]); } } });
  Object.assign(NET, N);
  return NET;
}
/* aptitude poids lourds d'une voie (guide SETRA « déviations » : l'itinéraire doit avoir gabarit, tonnage et largeur compatibles
   avec le trafic dévié). 0 = interdit / inadapté aux PL, 1 = possible. */
const UNPAVED = /^(unpaved|gravel|fine_gravel|dirt|earth|ground|grass|sand|mud|compacted|pebblestone|woodchips|grass_paver)$/;
function plOk(r){
  const T = r.tags || {}, num = v => parseFloat(String(v || '').replace(',', '.'));
  if (/^(no|destination|delivery|local)$/.test(T.hgv || '') || /^(destination|private)$/.test(T.access || '')) return 0;
  if (/no|destination|delivery/.test(T['hgv:conditional'] || '') || /no|destination/.test(T['motor_vehicle:conditional'] || '')) return 0;   // restrictions horaires locales (arrêté municipal) : non garanties pendant le chantier
  if (T['maxweight:conditional'] || T['maxlength'] && num(T.maxlength) < 12) return 0;
  if (num(T.maxweight) > 0 && num(T.maxweight) < 19) return 0;
  if (num(T.maxheight) > 0 && num(T.maxheight) < 4) return 0;
  if (num(T.maxwidth) > 0 && num(T.maxwidth) < 2.6) return 0;
  if (UNPAVED.test(T.surface || '') || T.highway === 'track') return 0;
  if (r.cls >= 6) return 0;                                       // aire piétonne, zone de rencontre, voie de desserte
  if (r.w < (r.oneway ? 3.5 : 5.5) && r.cls >= 5) return 0;       // chemin ou rue trop étroits pour croiser un PL
  return 1;
}
const nodeDeg = n => n ? n.nb.size : 0;
/* voie la plus proche d'un point (drive : voies circulées seulement) */
function nearestRoad(q, maxD = 25, drive = true){
  let best = null; const cx = Math.floor(q[0] / NET.cell), cy = Math.floor(q[1] / NET.cell), seen = new Set();
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const [ri, k] of NET.grid.get(`${cx + dx},${cy + dy}`) || []){
    const key = ri * 100000 + k; if (seen.has(key)) continue; seen.add(key);
    const r = NET.roads[ri]; if (drive && !r.drive) continue;
    const c = segClosest(q, r.pts[k], r.pts[k + 1]), d = V.dist(c.pt, q) - r.w / 2 * 0.5;
    if (d < maxD && (!best || d < best.d)) best = {ri, k, t:c.t, pt:c.pt, d, r, dir:V.norm(V.sub(r.pts[k + 1], r.pts[k]))};
  }
  return best;
}
/* tronçon entre deux carrefours, autour du segment k de la voie ri (peut traverser plusieurs voies OSM sans carrefour) */
function sectionAt(ri, k){
  const r = NET.roads[ri], A = r.nodes[k], B = r.nodes[k + 1]; if (A == null || B == null) return null;
  const walk = (prev, cur) => { const chain = [cur]; let p = prev, c = cur, guard = 0;
    while (guard++ < 400){ const n = NET.nodes.get(c); if (!n || nodeDeg(n) !== 2) break; const nx = [...n.nb].find(x => x !== p); if (nx == null || chain.includes(nx)) break; chain.push(nx); p = c; c = nx; }
    return chain; };
  const fwd = walk(A, B), back = walk(B, A);
  const ids = [...back.reverse(), ...fwd];  // back se termine par A, fwd commence par B
  const pts = ids.map(id => NET.nodes.get(id)?.xy).filter(Boolean);
  const keys = []; for (let i = 0; i + 1 < ids.length; i++) keys.push(segKey(ids[i], ids[i + 1]));
  const names = [...new Set(keys.map(kk => NET.roads[NET.segIdx.get(kk)?.ri]?.name).filter(Boolean))];
  return {ids, pts, keys, len:plLen(pts), name:names.join(' / ') || NET.roads[ri].hw.replace(/_/g, ' ')};
}
/* sens de circulation autorisés sur un tronçon (avant travaux) : 1 = a→b, -1 = b→a, 0 = double sens */
function sectionOneway(ids){
  let f = false, b = false;
  const n0 = NET.nodes.get(ids[0]); if (!n0) return 0;
  for (const ei of n0.out){ const e = NET.edges[ei]; if (e.to === ids[1]) f = true; }
  for (const ei of (NET.nodes.get(ids[1])?.out || [])){ const e = NET.edges[ei]; if (e.to === ids[0]) b = true; }
  return f && b ? 0 : f ? 1 : b ? -1 : 0;
}
/* routes barrées actives → ensembles de segments fermés */
function closedSets(els){
  const both = new Set(), dir = new Set(), slow = new Map();
  for (const c of els) if (c.t === 'closure' && !c.off && !phOff(c) && c.ids?.length > 1){
    for (let i = 0; i + 1 < c.ids.length; i++){
      const a = c.ids[i], b = c.ids[i + 1];
      if (c.mode === 'alternat') slow.set(segKey(a, b), 0.45);
      else if (c.mode === 'voie') slow.set(segKey(a, b), 0.7);
      else if (c.mode === 'sens') dir.add(c.dir === -1 ? `${b}>${a}` : `${a}>${b}`);
      else both.add(segKey(a, b));
    }
  }
  return {both, dir, slow};
}
/* plus court chemin (A*, état = nœud + voie d'arrivée pour respecter les interdictions de tourner) */
function route(fromId, toId, C, opt = {}){
  const S = NET.nodes.get(fromId), T = NET.nodes.get(toId); if (!S || !T) return null;
  const pen = opt.detour ? {1:1, 2:1, 3:1.05, 4:1.15, 5:1.5, 6:3, 7:4, 8:6} : {1:1, 2:1, 3:1, 4:1, 5:1.1, 6:1.4, 7:2, 8:3};
  const vmax = 30, h = n => V.dist(n.xy, T.xy) / vmax;
  const g = new Map(), prev = new Map(), open = [[h(S), 0, fromId, -1, -1]];
  const push = it => { open.push(it); let i = open.length - 1; while (i > 0){ const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length){ open[0] = last; let i = 0; for (;;){ const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
  g.set(fromId + '|-1', 0); let found = null, iter = 0;
  const avoid = opt.avoid || null;
  while (open.length && iter++ < 200000){
    const [, cost, nid, inWay, inEdge] = pop(), sk = nid + '|' + inWay;
    if (cost > (g.get(sk) ?? Infinity) + 1e-9) continue;
    if (nid === toId){ found = sk; break; }
    const n = NET.nodes.get(nid), wayId = inWay >= 0 ? NET.roads[inWay].id : null, only = wayId != null ? NET.only.get(`${wayId}|${nid}`) : null, no = wayId != null ? NET.restr.get(`${wayId}|${nid}`) : null;
    for (const ei of n.out){
      const e = NET.edges[ei]; if (C.both.has(e.key) || C.dir.has(`${e.from}>${e.to}`)) continue;
      if (avoid && avoid.has(e.key)) continue;
      const toWay = NET.roads[e.r].id;
      if (only != null && toWay !== only) continue; if (no && no.has(toWay)) continue;
      if (inEdge >= 0 && e.to === NET.edges[inEdge].from && nodeDeg(n) > 1) continue;   // pas de demi-tour sur place
      let c = e.len / (e.sp * (C.slow.get(e.key) || 1)) * (pen[e.cls] || 2);
      if (inEdge >= 0){ const pe = NET.edges[inEdge], a = NET.nodes.get(pe.from).xy, d1 = V.norm(V.sub(n.xy, a)), d2 = V.norm(V.sub(NET.nodes.get(e.to).xy, n.xy)), turn = Math.acos(clamp(V.dot(d1, d2), -1, 1)); if (turn > 0.6) c += opt.detour ? 6 : 4; }
      if (opt.vtype === 'pl' && (e.cls >= 6)) c *= 3;
      if (opt.lvl){   // déviation d'une route classée : rester sur le réseau de même niveau, jamais de chemin inadapté aux PL
        if (opt.strict && !e.pl) continue;
        if (e.cls >= 6 && opt.lvl < 6) continue;                  // jamais de zone de rencontre / desserte pour dévier une rue circulée
        if (e.dest) continue;                                        // « sauf desserte / riverains » : transit interdit, donc pas de déviation
        if (e.dl) c *= 0.7;                                          // itinéraire de délestage officiel (BD TOPO) : à privilégier
        if (e.near) c *= 1.8;                                        // abords d'école / hôpital
        if (e.z30 && opt.lvl <= 4) c *= 1.4;                         // zone 30 : pas de report d'un trafic de transit
        if (opt.strict && NET.nodes.get(e.to)?.lc) c += 90;          // passage à niveau : risque d'arrêt d'un PL sur les voies
        const drop = e.cls - opt.lvl; if (drop > 0 && !e.dep) c *= drop === 1 ? 2.5 : 8;   // descendre dans la hiérarchie coûte cher (lotissements, rues résidentielles)
      }
      const nk = e.to + '|' + e.r, ng = cost + c;
      if (ng < (g.get(nk) ?? Infinity)){ g.set(nk, ng); prev.set(nk, [sk, ei]); push([ng + h(NET.nodes.get(e.to)), ng, e.to, e.r, ei]); }
    }
  }
  if (!found) return null;
  const edges = []; let k = found; while (prev.has(k)){ const [pk, ei] = prev.get(k); edges.push(ei); k = pk; } edges.reverse();
  const ids = [fromId, ...edges.map(ei => NET.edges[ei].to)], pts = ids.map(id => NET.nodes.get(id).xy);
  let time = 0; for (const ei of edges){ const e = NET.edges[ei]; time += e.len / (e.sp * (C.slow.get(e.key) || 1)); }
  return {ids, pts, edges, len:plLen(pts), time};
}
/* déviation(s) automatique(s) d'une route barrée : pour chaque sens qui était circulé, itinéraire de bout en bout du tronçon */
function proposeDetours(cl, els){
  const C = closedSets(els.filter(e => e !== cl).concat([{...cl, off:false}])), ids = cl.ids, A = ids[0], B = ids[ids.length - 1];
  const ow = sectionOneway(ids), out = [];
  const closedEdges = []; for (let i = 0; i + 1 < ids.length; i++){ const n = NET.nodes.get(ids[i]); for (const ei of n?.out || []) if (NET.edges[ei].to === ids[i + 1]) closedEdges.push(NET.edges[ei]); for (const ei of n?.inn || []) if (NET.edges[ei].from === ids[i + 1]) closedEdges.push(NET.edges[ei]); }
  const lvl = Math.min(...closedEdges.map(e => e.cls), 8), heavy = closedEdges.some(e => e.dep) || lvl <= 4;   // route départementale / nationale ou voie principale : trafic PL à dévier
  const ref = [...new Set(closedEdges.map(e => NET.roads[e.r].ref).filter(Boolean))].join(', ');
  cl.rules = [heavy ? `Voie ${ref ? ref + ' ' : ''}de niveau ${['', 'autoroute / voie express', 'route principale', 'route secondaire', 'route de liaison'][lvl] || 'locale'} : déviation par un réseau équivalent, apte aux poids lourds (tonnage, hauteur, largeur, revêtement, restrictions horaires)` : 'Rue locale : déviation par les rues ouvertes à la circulation de transit',
    'Exclus : zones de rencontre, aires piétonnes, voies de desserte, chemins non revêtus, voies « sauf riverains / desserte »',
    'Privilégiés : itinéraires de délestage officiels (IGN). Évités si possible : abords d\'écoles et d\'hôpitaux (80 m), zones 30 pour le trafic de transit' + (heavy ? ', passages à niveau pour les PL' : '')];
  if (WORLD?.W?.zfe) cl.rules.push(`${WORLD.W.zfe} : vérifier les vignettes Crit'Air des véhicules déviés`);
  const dirs = cl.mode === 'sens' ? [cl.dir === -1 ? [B, A] : [A, B]] : ow === 1 ? [[A, B]] : ow === -1 ? [[B, A]] : [[A, B], [B, A]];
  for (const [f, t] of dirs){
    // niveau de la voie barrée : une départementale / route principale se dévie par le même réseau, apte aux PL
    let r = route(f, t, C, {detour:true, lvl, strict:heavy}), vl = false;
    if (!r && heavy){ r = route(f, t, C, {detour:true, lvl}); vl = !!r; }   // aucun itinéraire PL : déviation VL seulement, à signaler
    if (!r) { out.push({from:f, to:t, fail:true}); continue; }
    if (r && !heavy && r.edges.some(ei => !NET.edges[ei].pl) && closedEdges.every(e => e.pl)) vl = true;
    const base = route(f, t, closedSets([]), {});
    out.push({from:f, to:t, ...r, vl, extra:base ? r.len - base.len : 0, extraT:base ? r.time - base.time : 0});
  }
  return out;
}
/* changements de direction le long d'un itinéraire : carrefours où il faut un panneau de déviation */
function routeTurns(ids, startDir = null){
  const out = [];
  for (let i = startDir ? 0 : 1; i + 1 < ids.length; i++){
    const n = NET.nodes.get(ids[i]); if (i > 0 && nodeDeg(n) < 3) continue;
    const b = n.xy, c = NET.nodes.get(ids[i + 1]).xy, d1 = i === 0 ? startDir : V.norm(V.sub(b, NET.nodes.get(ids[i - 1]).xy)), d2 = V.norm(V.sub(c, b));
    const ang = Math.atan2(V.cross(d1, d2), V.dot(d1, d2));
    out.push({i, id:ids[i], xy:b, inDir:d1, outDir:d2, turn:Math.abs(ang) < 0.45 ? 'tout droit' : ang > 0 ? 'gauche' : 'droite', ang});
  }
  return out;
}
