/* ============ Projet : état, historique, chargement du site, dessin des éléments du chantier ============ */
let state = null, sel = null, quiet = false;
const hist = [], redoS = [];
const blankState = (name = 'Nouveau chantier') => ({v:1, app:'architrafic', name, site:null, els:[], legend:{show:true, title:'Légende', pos:null, custom:[], hide:[]}, sim:{dens:1, mix:{vl:78, vul:11, pl:6, bus:3, r2:2}}, meta:{moa:'', entreprise:'', from:'', to:'', arrete:'', notes:''}});
function migrate(s){
  const b = blankState(s?.name || 'Chantier'); if (!s || typeof s !== 'object') return b;
  const o = {...b, ...s, legend:{...b.legend, ...(s.legend || {})}, sim:{...b.sim, ...(s.sim || {}), mix:{...b.sim.mix, ...(s.sim?.mix || {})}}, meta:{...b.meta, ...(s.meta || {})}};
  o.els = Array.isArray(s.els) ? s.els.filter(e => e && e.t && e.id) : []; return o;
}
const byId = id => state.els.find(e => e.id === id);
function save(){ if (!quiet) window.dispatchEvent(new Event('ap:changed')); }
function commit(label){ hist.push(JSON.stringify({els:state.els, legend:state.legend, meta:state.meta})); if (hist.length > 80) hist.shift(); redoS.length = 0; save(); syncUndo(); }
function snapshot(){ return JSON.stringify({els:state.els, legend:state.legend, meta:state.meta}); }
let lastSnap = null;
function beginEdit(){ lastSnap = snapshot(); }
function endEdit(){ if (lastSnap && lastSnap !== snapshot()){ hist.push(lastSnap); if (hist.length > 80) hist.shift(); redoS.length = 0; } lastSnap = null; save(); syncUndo(); }
function edit(fn){ beginEdit(); fn(); endEdit(); rebuildProj(); refreshPanel(); }
function undo(){ if (!hist.length) return; redoS.push(snapshot()); restore(hist.pop()); }
function redo(){ if (!redoS.length) return; hist.push(snapshot()); restore(redoS.pop()); }
function restore(js){ const o = JSON.parse(js); state.els = o.els; state.legend = o.legend; state.meta = o.meta; if (sel && !byId(sel)) sel = null; rebuildProj(); refreshPanel(); save(); syncUndo(); }
function syncUndo(){ $('#undo').disabled = !hist.length; $('#redo').disabled = !redoS.length; }

/* ---------- chargement de la zone du chantier ---------- */
const AREA_SIZES = [500, 1000, 1600, 2400, 5000, 10000, 20000];
const CORE = 2400;   // au-delà : cœur détaillé de 2,4 km (bâtiments, mobilier), puis réseau routier seul jusqu'à la taille demandée
/* barre de chargement fluide : elle avance toujours un peu (progression « d'attente ») sans jamais dépasser
   l'étape réelle suivante, et rattrape en douceur quand l'étape réelle arrive. Affichée dès le clic. */
const LB = {shown:0, real:0, raf:0, t:0, st:0, k:0};
const LB_MSG = ['Rues, sens uniques et carrefours (OpenStreetMap)…', 'Bâtiments (IGN BD TOPO®)…', 'Relief et altitudes NGF (IGN RGE ALTI®)…', 'Écoles, passages à niveau, restrictions poids lourds…', 'Les serveurs publics sont chargés, on insiste…'];
let LOAD_STOP = null;   // action du bouton « Arrêter » pour le chargement en cours
(() => { const b = $('#loadBox'); if (b && b.parentElement !== document.body) document.body.appendChild(b);   // voile au-dessus de toute l'application
  // pendant le chargement : plus aucun raccourci ni clic sur l'interface, sauf Arrêter (Échap = Arrêter)
  const block = e => { if (!b || b.hidden) return; if (e.type === 'keydown' && e.key === 'Escape'){ e.preventDefault(); $('#loadStop').click(); }
    const key = e.type.startsWith('key');
    if (key ? e.target?.id === 'loadStop' && /^(Enter| |Tab)$/.test(e.key) : e.target?.id === 'loadStop') return;   // seul le bouton Arrêter reste actif
    if (key || !b.contains(e.target) || e.target === b || !e.target.closest?.('.lb-stop')){ e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } };
  for (const t of ['keydown', 'keyup', 'keypress', 'wheel', 'pointerdown', 'mousedown', 'touchstart', 'contextmenu', 'dblclick', 'click']) window.addEventListener(t, block, {capture:true, passive:false});
  $('#loadStop')?.addEventListener('click', () => { const f = LOAD_STOP; LOAD_STOP = null; LB.real = 1; b.hidden = true; clearInterval(LB.raf); LB.raf = 0; $('#app')?.removeAttribute('inert'); f?.(); });
})();
function loadUI(on, title = '', step = '', pct = 0){
  const b = $('#loadBox'), app = $('#app');
  if (!on){ if (b.hidden) return; LB.real = 1; setTimeout(() => { if (LB.real >= 1){ b.hidden = true; clearInterval(LB.raf); LB.raf = 0; app?.removeAttribute('inert'); LOAD_STOP = null; } }, 260); return; }
  if (b.hidden || LB.real >= 1){ b.hidden = false; app?.setAttribute('inert', ''); setTimeout(() => $('#loadStop')?.focus(), 30); LB.shown = 0; LB.real = 0; LB.rt = performance.now(); }
  if (title) $('#loadTitle').textContent = title; if (step && step !== LB.step){ $('#loadStep').textContent = LB.step = step; LB.st = performance.now(); }
  const r = Math.min(pct, 0.99); if (r > LB.real){ LB.real = r; LB.rt = performance.now(); }
  if (!LB.raf){ LB.t = performance.now(); const tick = () => { const now = performance.now(), dt = Math.min(0.1, (now - LB.t) / 1000); LB.t = now;
      const cap = LB.real >= 1 ? 1 : Math.min(0.95, LB.real + Math.min(0.3, 0.1 + (now - LB.rt) / 1000 * 0.008));   // l'avance d'attente grandit doucement avec le temps, plafonnée
      if (LB.shown < LB.real - 0.004) LB.shown += (LB.real - LB.shown) * Math.min(1, dt * 6);   // rattrapage rapide
      else if (LB.shown < cap) LB.shown += (cap - LB.shown) * dt * 0.6;                 // progression d'attente, de plus en plus lente
      $('#loadBar').style.width = (LB.shown * 100).toFixed(1) + '%'; $('#loadPct').textContent = Math.floor(LB.shown * 100) + ' %';
      if (now - LB.st > 3500 && LB.real < 0.8){ LB.st = now; $('#loadStep').textContent = LB_MSG[LB.k++ % LB_MSG.length]; }   // rien de neuf depuis 3,5 s : on montre ce qui se charge
      if (b.hidden){ clearInterval(LB.raf); LB.raf = 0; } };
    LB.raf = setInterval(tick, 40); tick(); }
}
let loadToken = 0;
async function loadSite(force = false){
  const s = state.site; if (!s?.lat){ WORLD = null; buildWorld(); rebuildProj(); return; }
  const tok = ++loadToken, size = s.size || 1000, P = makeProj(s.lat, s.lon), key = `site|${DATA_VER}|${s.lat.toFixed(5)}|${s.lon.toFixed(5)}|${size}`;
  simStop(true); loadUI(true, 'Chargement de la zone', 'Ouverture du chantier…', 0.02);
  LOAD_STOP = () => { loadToken++; toast(WORLD ? 'Chargement arrêté : la zone précédente reste affichée.' : 'Chargement arrêté. Relancez quand vous voulez (Projet → Mettre à jour les données).', 5000); };
  let raw = force ? null : await IDB.get(key);
  if (raw && Date.now() - raw.at > 30 * 864e5) raw = null;   // plus de 30 jours : on remet à jour
  try {
    if (!raw){
      const B = areaBounds(P, size + 120); raw = {at:Date.now(), src:{}};
      loadUI(true, 'Chargement de la zone', 'Rues, sens uniques et carrefours (OpenStreetMap)…', 0.08);
      const big = size > CORE, core = Math.min(size, CORE);
      const osmP = loadOSM(big ? areaBounds(P, core + 120) : B, true, big ? B : null, size).then(j => { raw.osm = j; raw.src.osm = 'OpenStreetMap'; });
      const bdtP = loadBDTopo(areaBounds(P, core + 40)).then(f => { raw.bdt = f; }).catch(() => { raw.bdt = []; });
      loadUI(true, 'Chargement de la zone', 'Relief et altitudes NGF (IGN RGE ALTI®)…', 0.18);
      const el = await loadElevation(P, size, p => { if (tok === loadToken) loadUI(true, 'Chargement de la zone', 'Relief et altitudes NGF (IGN RGE ALTI®)…', 0.18 + p * 0.3); });
      raw.elev = {N:el.N, z:Array.from(el.z, v => Math.round(v * 100) / 100)}; raw.src.elev = el.src;
      if (big){ loadUI(true, 'Chargement de la zone', 'Relief fin du cœur de zone…', 0.5); try { const e2 = await loadElevation(P, core); raw.elev2 = {N:e2.N, S:core, z:Array.from(e2.z, v => Math.round(v * 100) / 100)}; } catch(e){} }
      if (tok !== loadToken) return;
      loadUI(true, 'Chargement de la zone', 'Bâtiments (IGN BD TOPO®) et voirie (OpenStreetMap)…', 0.55);
      await Promise.all([osmP, bdtP]);
      if (tok !== loadToken) return;
      IDB.set(key, raw);
    }
    loadUI(true, 'Construction du site en 3D', 'Voirie, trottoirs, bâtiments, arbres…', 0.8); await sleep(30);
    const W = parseWorld(raw, P, size);
    const z = Float32Array.from(raw.elev.z), N = raw.elev.N, mid = Math.floor(N / 2), z0 = z[mid * N + mid];
    const elev2 = raw.elev2 ? {N:raw.elev2.N, S:raw.elev2.S, z:Float32Array.from(raw.elev2.z)} : null;
    WORLD = {size, P, z0:elev2 ? elev2.z[Math.floor(elev2.N / 2) * elev2.N + Math.floor(elev2.N / 2)] : z0, elev:{N, z}, elev2, W, src:{...raw.src, bld:W.src.bld, at:raw.at}};
    camRange(size); buildNet(W); orthoTex = null; orthoState = '';
    buildWorld(); rematchClosures(); rebuildProj(); fit(); refreshPanel();
    loadUI(false); toast(`Zone chargée : ${W.roads.filter(r => r.drive).length} voies, ${W.bld.length} bâtiments, altitude NGF ${nf(z0, 2)} m au point d'origine.`, 5200);
  } catch(e){
    console.error(e); loadUI(false);
    if (tok === loadToken){ toast('Impossible de charger la zone : vérifiez la connexion, puis réessayez (onglet Projet → Mettre à jour).', 7000); WORLD = WORLD || null; refreshPanel(); }
  }
}
/* routes barrées : les nœuds OSM peuvent changer entre deux mises à jour → on les retrouve par leur position */
function rematchClosures(){
  for (const c of state.els) if (c.t === 'closure'){
    if (c.ids?.every(id => NET.nodes.has(id))) continue;
    const a = c.pts?.[0], b = c.pts?.[c.pts.length - 1]; if (!a || !b) continue;
    const near = q => { let best = null, bd = 12; for (const [id, n] of NET.nodes){ const d = V.dist(n.xy, q); if (d < bd){ bd = d; best = id; } } return best; };
    const A = near(a), B = near(b); if (A == null || B == null) continue;
    const r = route(A, B, closedSets([]), {}); if (r && r.len < plLen(c.pts) * 1.5 + 20){ c.ids = r.ids; c.pts = r.pts; }
  }
}

/* ---------- hauteur de pose : chaussée, trottoir ou sol ---------- */
function surfaceZ(x, y){
  const z = H(x, y); if (!WORLD) return 0;
  const nr = nearestRoad([x, y], 8, false); if (!nr) return z;
  const d = V.dist(nr.pt, [x, y]), hw = nr.r.w / 2;
  if (d <= hw) return z + 0.05;
  if (!nr.r.foot && d < hw + 3.2 && d > hw + 0.3 && nr.r.cls <= 6 && !/^(no|none|separate)$/.test(nr.r.sidewalk)) return z + 0.15;
  return z;
}
/* orientation automatique d'un panneau : face au trafic qui arrive, sur le bord droit */
function autoOrient(x, y){
  const nr = nearestRoad([x, y], 14); if (!nr) return null;
  const side = V.cross(nr.dir, V.sub([x, y], nr.pt)) < 0 ? 1 : -1;     // 1 : à droite du sens de saisie de la voie
  const d = side > 0 ? nr.dir : V.mul(nr.dir, -1);                      // sens de circulation qui longe ce bord
  if (nr.r.oneway && side < 0 && nr.r.oneway > 0) return Math.atan2(-nr.dir[1], -nr.dir[0]);
  return Math.atan2(-d[1], -d[0]);                                       // la face (+x) regarde les véhicules qui arrivent
}

/* ---------- dessin des éléments du projet ---------- */
const projCache = new Map();
const closedTex = () => TEX.closed ??= (() => { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(211,47,47,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 14; for (let i = -2; i < 4; i++){ g.beginPath(); g.moveTo(i * 64, h); g.lineTo(i * 64 + h, 0); g.stroke(); } }); t.repeat.set(1 / 3, 1 / 3); return t; })();
const zoneTex = () => TEX.zone ??= (() => { const t = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(242,138,26,.28)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(242,138,26,.85)'; g.lineWidth = 6; for (let i = -2; i < 4; i++){ g.beginPath(); g.moveTo(i * 64, h); g.lineTo(i * 64 + h, 0); g.stroke(); } }); t.repeat.set(1 / 4, 1 / 4); return t; })();
function chevronTex(col){ const key = 'chev|' + col; return TEX[key] ??= (() => { const t = canvasTex(128, 64, (g, w, h) => { g.fillStyle = col; g.globalAlpha = 0.92; g.fillRect(0, 0, w, h); g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineJoin = 'miter'; g.beginPath(); g.moveTo(38, 12); g.lineTo(70, 32); g.lineTo(38, 52); g.stroke(); }); t.repeat.set(1 / 6, 1 / 3.2); return t; })(); }
function ribbonMesh(pts, w, mat, dz = 0.12, off = 0){
  const gb = new GB(); bandGB(gb, off ? plOffset(pts, off) : pts, -w / 2, w / 2, dz); if (gb.empty) return null;
  const g = gb.geo(), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + 0); const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
}
/* cote : ligne de cote (décalable), lignes d'attache, extrémités flèches / traits obliques / points, couleur et épaisseur au choix */
const DIM_DEF = {col:'#0B57D0', w:0.3, style:'fleches', off:0, dec:2, dz:false};
const dimOpt = e => ({...DIM_DEF, ...e});
function dimBuild(e, g){
  const o = dimOpt(e), col = new THREE.Color(o.col).getHex(), mat = matCol(col, {po:-12, rough:0.6}), d = V.norm(V.sub(e.b, e.a)), n = V.perp(d), A = V.add(e.a, V.mul(n, o.off)), B = V.add(e.b, V.mul(n, o.off)), w = o.w, L = V.dist(A, B);
  const add = m => { if (m){ m.userData.id = e.id; g.add(m); } };
  const tip = Math.min(L * 0.3, Math.max(1.4, w * 6));
  add(ribbonMesh(o.style === 'fleches' ? [V.add(A, V.mul(d, tip * 0.9)), V.sub(B, V.mul(d, tip * 0.9))] : [A, B], w, mat, 0.22));
  if (Math.abs(o.off) > 0.05) for (const [p, q] of [[e.a, A], [e.b, B]]) add(ribbonMesh([V.add(p, V.mul(n, Math.sign(o.off) * 0.3)), V.add(q, V.mul(n, Math.sign(o.off) * 0.6))], w * 0.45, mat, 0.22));
  const z = q => H(q[0], q[1]) + 0.225, gb = new GB();
  for (const [P, dir] of [[A, d], [B, V.mul(d, -1)]]){
    if (o.style === 'fleches'){ const b0 = V.add(P, V.mul(dir, tip)), l = V.add(b0, V.mul(V.perp(dir), tip * 0.38)), r = V.sub(b0, V.mul(V.perp(dir), tip * 0.38)); gb.tri(P3(r[0], r[1], z(r)), P3(P[0], P[1], z(P)), P3(l[0], l[1], z(l)), [0, 0], [1, 0], [0, 1]); }
    else if (o.style === 'traits'){ const t = V.norm(V.add(dir, V.perp(dir))); add(ribbonMesh([V.sub(P, V.mul(t, tip * 0.45)), V.add(P, V.mul(t, tip * 0.45))], w * 1.3, mat, 0.225)); }
    else { const m = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.45, w * 1.8), 18), mat); m.rotation.x = -Math.PI / 2; m.position.set(P[0], z(P), -P[1]); add(m); }
  }
  if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), matCol(col, {po:-12, side:THREE.DoubleSide})); add(m); }
}
function dimText(e){ const o = dimOpt(e), L = V.dist(e.a, e.b), cm = DISPLAY.dimUnit === 'cm', f = v => (cm ? v * 100 : v).toFixed(cm ? Math.max(0, o.dec - 2) : o.dec).replace('.', ',') + (cm ? ' cm' : ' m'); let t = f(L);
  if (o.dz && WORLD){ const dz = H(e.b[0], e.b[1]) - H(e.a[0], e.a[1]); t += `\nΔ ${dz >= 0 ? '+' : '−'}${f(Math.abs(dz))} · ${(Math.abs(dz) / Math.max(0.01, L) * 100).toFixed(1).replace('.', ',')} %`; } return t; }
function placeObj(grp, x, y, a, dz = 0){ grp.position.set(x, surfaceZ(x, y) + dz, -y); grp.rotation.y = a; return grp; }
function elSig(e){ return JSON.stringify(e) + (WORLD ? WORLD.z0 + WORLD.size : '') + DISPLAY.style; }
function buildEl(e){
  const g = new THREE.Group(); g.userData.id = e.id;
  if (e.t === 'obj'){ const L = LIBK[e.k]; if (!L) return g; const pk = e.k + '|' + JSON.stringify(e.p || {}); let pr = OBJ_PROTO.get(pk); if (!pr){ pr = L.build(e.p || {}); const light = L.sign || /^(temp|bal|chan)$/.test(L.cat || ''); pr.traverse(m => { m.userData.shared = true; if (light && m.isMesh) m.castShadow = false; });   /* petits objets : pas d'ombre portée (rendu plus léger) */ OBJ_PROTO.set(pk, pr); } const o = pr.clone();   // modèle construit une fois, géométries et matériaux partagés par toutes les copies
    o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(o); placeObj(g, e.x, e.y, e.a || 0, e.dz || 0);
    if (L.sign){ // en plan : symbole du panneau vu de face, à l'échelle du plan
      let sc = L.sign; if (/^KD22[abc]$/.test(sc)){ const a = e.a || 0, din = [-Math.cos(a), -Math.sin(a)], go = sc === 'KD22c' ? din : sc === 'KD22a' ? [-din[1], din[0]] : [din[1], -din[0]];   // plan (nord en haut) : flèche dans la direction réelle
        sc = Math.abs(go[0]) >= Math.abs(go[1]) * 0.9 ? (go[0] > 0 ? 'KD22b' : 'KD22a') : (go[1] > 0 ? 'KD22c' : 'KD22d'); }
      const sp = new THREE.Sprite(MAT['spr|' + sc + JSON.stringify(e.p || {})] ??= new THREE.SpriteMaterial({map:signFaceTex(sc, e.p || {}), depthTest:false})); const sh = signShape(sc), ar = sh.s === 'rect' ? sh.ar || 1.6 : 1;
      sp.scale.set(2.2 * ar, 2.2, 1); sp.position.set(0, 3, 0); sp.renderOrder = 20; sp.userData = {planOnly:true, id:e.id}; sp.visible = view === '2d'; g.add(sp); }
    return g; }
  if (e.t === 'model'){ const o = MODELS.get(e.key); if (o){ const c = o.clone(true); c.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(c); } else { const ph = part(BOX(6, 3, 6), matCol(0x9AB0C8, {opacity:0.35, depthWrite:false}), 0, 1.5, 0); ph.userData.id = e.id; g.add(ph); }
    g.position.set(e.x, (e.zAbs != null && WORLD ? e.zAbs - WORLD.z0 : H(e.x, e.y)), -e.y); g.rotation.y = e.a || 0; return g; }
  if (e.t === 'closure' && e.pts?.length > 1){
    /* zone rouge arrêtée sur la ligne des barrières (posées à min(6 m, L/3) de chaque carrefour, voir autoSigns) : elle ne déborde plus sur la rue transversale */
    const ptsC = closureVis(e);
    const w = closureWidth(e) + 0.4, lane = e.mode === 'sens' || e.mode === 'voie', pd = e.dir === -1 ? ptsC.slice().reverse() : ptsC, m = ribbonMesh(lane ? plOffset(pd, -w / 4 * (e.mode === 'voie' ? (e.side || 1) : 1)) : ptsC, lane ? w / 2 : w, MAT.closed ??= new THREE.MeshBasicMaterial({map:closedTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-6, polygonOffsetUnits:-6}), 0.14);
    if (m){ m.userData.id = e.id; g.add(m); }
    if (e.mode === 'sens'){ const p = e.dir === -1 ? e.pts.slice().reverse() : e.pts, mid = plAt(p, plLen(p) / 2), a = Math.atan2(mid.dir[1], mid.dir[0]), ar = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 3), matCol(0xD32F2F)); ar.rotation.set(0, a, -Math.PI / 2); ar.position.set(mid.pt[0], H(mid.pt[0], mid.pt[1]) + 0.3, -mid.pt[1]); ar.scale.y = 0.3; g.add(ar); }
    return g;
  }
  if (e.t === 'pdetour' && e.pts?.length > 1){   // cheminement piéton dévié : chevrons verts, étroits, sur le trottoir
    const m = ribbonMesh(e.pts, 0.9, MAT.pdet ??= new THREE.MeshBasicMaterial({map:chevronTex(PED_COL), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-8}), 0.17, -(e.off ?? 3.4));
    if (m){ m.userData.id = e.id; g.add(m); } return g;
  }
  if (e.t === 'detour' && e.pts?.length > 1){
    const col = e.col || '#F28A1A', m = ribbonMesh(e.pts, 1.6, MAT['det|' + col] ??= new THREE.MeshBasicMaterial({map:chevronTex(col), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-8, polygonOffsetUnits:-8}), 0.16, -(e.off ?? 1.4));
    if (m){ m.userData.id = e.id; g.add(m); } return g;
  }
  if (e.t === 'zone' && e.pts?.length > 2){
    const gb = new GB(); try { polyGB(gb, e.pts, [], 0.1); } catch(err){}
    if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), MAT.zone ??= new THREE.MeshBasicMaterial({map:zoneTex(), transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5})); m.userData.id = e.id; m.renderOrder = 1; g.add(m); }
    const ring = [...e.pts, e.pts[0]], ob = ribbonMesh(ring, 0.25, matCol(0xF28A1A, {po:-7}), 0.13); if (ob){ ob.userData.id = e.id; g.add(ob); }
    if (e.fence){ const mod = herasModule(); lineModules(g, ring, mod.grp, mod.len, e.id); }
    return g;
  }
  if (e.t === 'line' && e.pts?.length > 1){
    const T = LINE_TYPES[e.k] || LINE_TYPES.cones;
    if (T.item){ const L = plLen(e.pts), sp = e.sp || T.sp; for (let s = 0; s <= L + 0.01; s += sp){ const a = plAt(e.pts, Math.min(s, L)), o = LIBK[T.item].build({}); o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); placeObj(o, a.pt[0], a.pt[1], Math.atan2(a.dir[1], a.dir[0])); g.add(o); } }
    else if (T.mod === 'k16'){ const m = k16Module(); lineModules(g, e.pts, null, m.len, e.id, (i) => part(m.geo, i % 2 ? C.white : C.red)); }
    else if (T.mod === 'gba'){ const m = gbaModule(); lineModules(g, e.pts, null, m.len, e.id, () => part(m.geo, C.concrete)); }
    else if (T.mod === 'heras'){ const m = herasModule(); lineModules(g, e.pts, m.grp, m.len, e.id); }
    else if (T.mod === 'vauban'){ const m = vaubanModule(); lineModules(g, e.pts, m.grp, m.len, e.id); }
    else if (T.mod === 'k2'){ lineModules(g, e.pts, barrierK2(2), 2.05, e.id); }
    else if (T.mod === 'tape'){ const L = plLen(e.pts); for (let s = 0; s <= L + 0.01; s += 3){ const a = plAt(e.pts, Math.min(s, L)), p = part(CYL(0.02, 0.02, 1.1, 6), C.white, 0, 0.55, 0); const o = new THREE.Group(); o.add(p); placeObj(o, a.pt[0], a.pt[1], 0); o.traverse(m => { if (m.isMesh) m.userData.id = e.id; }); g.add(o); }
      const gb = new GB(); const p = densify(e.pts, 3); for (let i = 0; i + 1 < p.length; i++){ const a = p[i], b = p[i + 1], za = surfaceZ(a[0], a[1]) + 1.0, zb = surfaceZ(b[0], b[1]) + 1.0, n = V.mul(V.perp(V.norm(V.sub(b, a))), 0.0); gb.quad(P3(a[0], a[1], za), P3(b[0], b[1], zb), P3(b[0], b[1], zb + 0.07), P3(a[0], a[1], za + 0.07), [0, 0], [V.dist(a, b), 0], [V.dist(a, b), 1], [0, 1]); }
      if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), MAT.tape ??= new THREE.MeshStandardMaterial({map:stripeTex('#E53935', '#FFFFFF', true, 6), side:THREE.DoubleSide, roughness:0.6})); m.userData.id = e.id; g.add(m); } }
    return g;
  }
  if (e.t === 'arrow' && e.pts?.length > 1){
    const col = e.col || '#1565C0', w = e.w || 1.2, L = plLen(e.pts), head = Math.min(w * 3, L * 0.4), body = plSlice(e.pts, 0, L - head * 0.9);
    const m = ribbonMesh(body, w, matCol(new THREE.Color(col).getHex(), {po:-9, rough:0.7}), 0.18); if (m){ m.userData.id = e.id; g.add(m); }
    const end = plAt(e.pts, L), base = V.sub(end.pt, V.mul(end.dir, head)), n = V.perp(end.dir), gb = new GB(), A = V.add(base, V.mul(n, w * 1.4)), B = V.sub(base, V.mul(n, w * 1.4)), z = q => H(q[0], q[1]) + 0.185;
    gb.tri(P3(B[0], B[1], z(B)), P3(end.pt[0], end.pt[1], z(end.pt)), P3(A[0], A[1], z(A)), [0, 0], [1, 0], [0, 1]); const hm = new THREE.Mesh(gb.geo(), matCol(new THREE.Color(col).getHex(), {po:-9, rough:0.7, side:THREE.DoubleSide})); hm.userData.id = e.id; g.add(hm); return g;
  }
  if (e.t === 'dim' && e.a && e.b){ dimBuild(e, g); return g; }
  if (e.t === 'swept' && e.env){
    const gb = new GB(); try { polyGB(gb, [...e.env.l, ...e.env.r.slice().reverse()], [], 0.17); } catch(err){}
    if (!gb.empty){ const m = new THREE.Mesh(gb.geo(), matCol(0x7B1FA2, {opacity:0.28, depthWrite:false, po:-9})); m.userData.id = e.id; g.add(m); }
    for (const side of [e.env.l, e.env.r]){ const m = ribbonMesh(side, 0.14, matCol(0x7B1FA2, {po:-10}), 0.19); if (m){ m.userData.id = e.id; g.add(m); } }
    for (const tr of e.env.tracks || []){ const m = ribbonMesh(tr, 0.08, matCol(0x4A148C, {po:-10}), 0.19); if (m){ m.userData.id = e.id; g.add(m); } }
    const v = sweptVehicle(e.veh); if (v && e.pose){ const o = v.build(); o.traverse(mm => { if (mm.isMesh){ mm.userData.id = e.id; mm.material = mm.material.clone(); mm.material.transparent = true; mm.material.opacity = 0.55; } }); placeObj(o, e.pose[0], e.pose[1], e.pose[2]); g.add(o); }
    return g;
  }
  if (e.t === 'note'){ const pin = part(CYL(0.05, 0.05, 2.2, 6), matCol(new THREE.Color(e.col || '#1565C0').getHex()), 0, 1.1, 0); pin.userData.id = e.id; g.add(pin); g.position.set(e.x, H(e.x, e.y), -e.y); return g; }
  return g;
}
function lineModules(g, pts, tpl, len, id, make){
  const L = plLen(pts); let i = 0;
  for (let s = len / 2; s < L; s += len){ const a = plAt(pts, s), o = make ? (() => { const gg = new THREE.Group(); gg.add(make(i)); return gg; })() : tpl.clone(true); o.traverse(m => { if (m.isMesh) m.userData.id = id; });
    placeObj(o, a.pt[0], a.pt[1], Math.atan2(a.dir[1], a.dir[0]) + Math.PI / 2); g.add(o); i++; }
}
function closureWidth(c){ let w = 0; for (let i = 0; i + 1 < (c.ids?.length || 0); i++){ const s = NET.segIdx.get(segKey(c.ids[i], c.ids[i + 1])); if (s) w = Math.max(w, NET.roads[s.ri].w); } return w || 6; }
const OBJ_PROTO = new Map();
let feuxKey = '';
let stateVer = 0;   // incrémenté à chaque reconstruction du projet (les étiquettes ne recalculent leur clé qu'à ce moment)
function rebuildProj(){
  stateVer++;
  const fk = (state?.els || []).filter(e => e.t === 'obj' && e.k === 'FEUX' && !phOff(e)).map(e => Math.round(e.x) + ',' + Math.round(e.y)).join(';'); if (fk !== feuxKey){ feuxKey = fk; if (WORLD) buildWorld(); }   // carrefours à feux ajoutés ou retirés
  const keep = new Set();
  for (const e of state?.els || []){
    const sig = elSig(e); let c = projCache.get(e.id);
    if (!c || c.sig !== sig){ if (c){ projGroup.remove(c.grp); c.grp.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); } let grp; try { grp = buildEl(e); } catch(err){ console.warn('élément', e, err); grp = new THREE.Group(); } c = {sig, grp}; projCache.set(e.id, c); projGroup.add(grp); }
    c.base = !e.hidden && !phOff(e); c.grp.visible = c.base; c.small = e.t === 'obj'; c.x = e.x; c.y = e.y;
    keep.add(e.id);
  }
  for (const [id, c] of projCache) if (!keep.has(id)){ projGroup.remove(c.grp); c.grp.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); projCache.delete(id); }
  objInstances(); applySel(); renderLegend(); simNetworkChanged(); renderPhaseBar(); dirty = true;
}
/* objets du chantier en instances : les copies d'un même modèle (cône, barrière, panneau AK5…) sont dessinées en un seul
   appel par pièce au lieu d'un appel par objet et par pièce (900 objets ≈ 6 000 appels → quelques dizaines) */
const objInstGroup = new THREE.Group(); objInstGroup.name = 'Objets (instances)';
function objInstances(){
  if (objInstGroup.parent !== projGroup) projGroup.add(objInstGroup);
  for (const m of objInstGroup.children) m.dispose?.(); objInstGroup.clear();
  const bins = new Map();
  for (const c of projCache.values()){
    if (!c.small) continue; c.grp.updateMatrixWorld(true);
    c.grp.traverse(m => { if (!m.isMesh || !m.userData.shared || m.isInstancedMesh) return; m.visible = false; if (!c.base) return;
      const k = m.geometry.uuid + '|' + (Array.isArray(m.material) ? m.material.map(x => x.uuid).join() : m.material.uuid); let b = bins.get(k);
      if (!b) bins.set(k, b = {g:m.geometry, mat:m.material, cs:m.castShadow, rs:m.receiveShadow, mats:[]}); b.mats.push(m.matrixWorld.clone()); });
  }
  for (const b of bins.values()){ const im = new THREE.InstancedMesh(b.g, b.mat, b.mats.length); b.mats.forEach((M, i) => im.setMatrixAt(i, M)); im.castShadow = b.cs; im.receiveShadow = b.rs; im.computeBoundingSphere(); im.userData.shared = true; objInstGroup.add(im); }
}

/* sélection : contour orange */
const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xF28A1A); selBox.visible = false; markGroup.add(selBox);
let selShape = null; const selMat = new THREE.MeshBasicMaterial({color:0xF28A1A, transparent:true, opacity:0.32, depthTest:false}), selLine = new THREE.LineBasicMaterial({color:0xF28A1A, depthTest:false});
/* tracé visible d'une route barrée : arrêté sur la ligne des barrières, à min(6 m, L/3) de chaque carrefour (voir autoSigns) */
function closureVis(e){ const L = plLen(e.pts); return L > 1 ? plSlice(e.pts, closureTrim(e, 0), L - closureTrim(e, 1)) : e.pts; }
/* recul de la ligne des barrières depuis le centre du carrefour d'extrémité (end 0 = début, 1 = fin) : jusqu'au bord de la rue
   transversale (demi-largeur de la plus large rue qui croise + 1,2 m), pour que la fermeture s'arrête à la rue où elle est censée
   s'arrêter. L'ancien recul fixe de 6 m débordait sur les rues larges (boulevards, cours lyonnais : 15 à 30 m). */
function closureTrim(e, end){
  const L = plLen(e.pts), ids = e.ids || [], dflt = Math.min(6, L / 3); if (ids.length < 2 || typeof NET === 'undefined') return dflt;
  const id = end ? ids[ids.length - 1] : ids[0], nx = end ? ids[ids.length - 2] : ids[1], n = NET.nodes.get(id), m0 = NET.nodes.get(nx); if (!n || !m0) return dflt;
  const d0 = V.norm(V.sub(m0.xy, n.xy)); let hw = -1;
  for (const mid of n.nb){ if (mid === nx) continue; const m = NET.nodes.get(mid); if (!m) continue; const d = V.norm(V.sub(m.xy, n.xy)); if (Math.abs(V.dot(d, d0)) > 0.85) continue;   // rue dans le prolongement : pas une transversale
    const ed = n.out.map(i => NET.edges[i]).find(x => x.to === mid) || n.inn.map(i => NET.edges[i]).find(x => x.from === mid), w = ed ? NET.roads[ed.r]?.w : 0; if (w) hw = Math.max(hw, w / 2); }
  return hw < 0 ? dflt : Math.min(L / 3, Math.max(2, hw + 1.2));
}
function applySel(){
  if (typeof sigVisibility === 'function' && applySel.k !== sel + '|' + stateVer){ applySel.k = sel + '|' + stateVer; sigVisibility(); }   // feux affichés selon la route barrée sélectionnée
  if (selShape){ markGroup.remove(selShape); selShape.traverse(o => o.geometry?.dispose()); selShape = null; } selBox.visible = false;
  const c = sel && projCache.get(sel), e = sel && byId(sel); if (!c || !e){ dirty = true; return; }
  const S = elShape(e);
  if (S?.lines){ // éléments linéaires : bandeau orange le long de la forme
    const g = new THREE.Group(); for (const l of S.lines){ const m = ribbonMesh(l, S.w + 1.2, selMat, 0.3); if (m){ m.renderOrder = 8; g.add(m); } } selShape = g; markGroup.add(g); dirty = true; return; }
  // objets : boîte orientée comme l'objet (et non un rectangle aligné sur les axes)
  const grp = c.grp, keep = [grp.position.clone(), grp.rotation.y]; grp.position.set(0, 0, 0); grp.rotation.y = 0; grp.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(grp); grp.position.copy(keep[0]); grp.rotation.y = keep[1]; grp.updateMatrixWorld(true);
  if (b.isEmpty()){ dirty = true; return; } b.expandByScalar(0.2);
  const h = new THREE.Box3Helper(b, 0xF28A1A); h.material.depthTest = false; h.renderOrder = 8; const w = new THREE.Group(); w.add(h);
  // inner group children may carry their own rotation (placeObj on child) : on reprend la transformation du premier enfant si le groupe n'en a pas
  const src = grp.rotation.y || grp.position.lengthSq() ? grp : grp.children[0]; if (src){ w.position.copy(src.position); w.rotation.y = src.rotation.y; }
  selShape = w; markGroup.add(w); dirty = true;
}
