/* ============ Feux tricolores (carrefours à feux OSM) ============
   Cycle à la française (IISR, 6e partie « feux de circulation permanents ») : vert 27 s, jaune fixe 3 s en agglomération
   et 5 s hors agglomération, rouge intégral (dégagement) 2 s, par axe (deux phases en opposition) ; feux face à face = même couleur.
   Comportement des véhicules (Code de la route) : arrêt au rouge ; au jaune, arrêt sauf si le véhicule ne peut plus s'arrêter
   en sécurité ; au vert, le véhicule qui tourne à gauche cède le passage à ceux qui viennent en face.
   Têtes de feux R/J/V à 3 feux sur mât, allumées selon le cycle (en simulation : temps simulé ; sinon horloge),
   et repère sur la carte avec la couleur en cours. Les véhicules simulés s'arrêtent au rouge et au jaune. */
const SIGCYC = {g:27, y:3, r:2};   // période = 2 × (vert + jaune + rouge intégral) = 64 s
const SIGT = () => SIM.on ? SIM.t : performance.now() / 1000;   // simulation en cours : temps simulé ; sinon les feux tournent en temps réel
/* axe d'une approche : comparé à la première approche du carrefour (et non aux axes x/y), pour que deux rues
   d'un même carrefour diagonal ne soient jamais vertes en même temps ni rouges toutes les deux pour toujours */
/* contrôleur d'un feu : OSM pose souvent les feux sur chaque approche (nœuds à 10-25 m du carrefour) et non sur le
   carrefour lui-même. Tous les feux d'un même carrefour sont rattachés à ce carrefour : même cycle, même référence d'axe,
   donc toujours un axe au vert (jamais 4 feux rouges ensemble hors des 2 s de dégagement). */
function sigCtl(n){ if (n._ctl) return n._ctl; let best = n, bd = nodeDeg(n) >= 3 ? 0 : 30;
  if (bd){ if (!NET._jg){ NET._jg = new Map(); for (const m of NET.nodes.values()) if (nodeDeg(m) >= 3){ const k = Math.floor(m.xy[0] / 50) + ',' + Math.floor(m.xy[1] / 50); (NET._jg.get(k) || NET._jg.set(k, []).get(k)).push(m); } }
    const gx = Math.floor(n.xy[0] / 50), gy = Math.floor(n.xy[1] / 50);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const m of NET._jg.get((gx + i) + ',' + (gy + j)) || []){ const d = Math.hypot(m.xy[0] - n.xy[0], m.xy[1] - n.xy[1]); if (d < bd){ bd = d; best = m; } } }
  return n._ctl = best; }
/* axe d'une approche : les directions des approches d'un carrefour sont regroupées en deux axes par leur ANGLE DE ROUTE
   (sens ignoré : deux approches face à face ou dans le prolongement l'une de l'autre sont toujours sur le même axe,
   donc toujours de la même couleur, comme dans la réalité) ; regroupement par 2 moyennes sur les angles doublés. */
const dblAng = d => Math.atan2(2 * d[0] * d[1], d[0] * d[0] - d[1] * d[1]);   // angle doublé : d et -d donnent la même valeur
const angGap = (a, b) => { let x = Math.abs(a - b) % (2 * Math.PI); return x > Math.PI ? 2 * Math.PI - x : x; };
function sigAxis(n0, d){ const n = sigCtl(n0); const g = n._ax; if (!g) return 0; const a = dblAng(d); return angGap(a, g[0]) <= angGap(a, g[1]) ? 0 : 1; }
function sigCluster(c, dirs){
  const A = dirs.map(dblAng); let i0 = 0, i1 = 0, best = -1;
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++){ const g = angGap(A[i], A[j]); if (g > best){ best = g; i0 = i; i1 = j; } }
  if (best < 0.7){ c._ax = [A[0], A[0] + Math.PI]; c._one = true; return; }   // toutes les approches sur une même route (< 20°)
  let g0 = A[i0], g1 = A[i1];
  for (let it = 0; it < 6; it++){ let s0 = [0, 0], s1 = [0, 0]; for (const a of A){ const t = angGap(a, g0) <= angGap(a, g1) ? s0 : s1; t[0] += Math.cos(a); t[1] += Math.sin(a); }
    if (s0[0] || s0[1]) g0 = Math.atan2(s0[1], s0[0]); if (s1[0] || s1[1]) g1 = Math.atan2(s1[1], s1[0]); }
  c._ax = [g0, g1]; c._one = false; }
/* coordination : les feux à moins de 300 m les uns des autres (OSM ou posés à la main) forment un ensemble ;
   chaque feu est décalé du feu pilote selon la distance (onde verte à 40 km/h) au lieu d'un décalage aléatoire */
function sigOffset(n){ let o = SIM.sigOff.get(n.id); if (o !== undefined) return o;
  const sig = [...new Set([...NET.nodes.values()].filter(m => m.sig).map(sigCtl))], seen = new Set();
  for (const s of sig){ if (seen.has(s.id)) continue; const grp = [s]; seen.add(s.id);
    for (let i = 0; i < grp.length; i++) for (const m of sig) if (!seen.has(m.id) && Math.hypot(m.xy[0] - grp[i].xy[0], m.xy[1] - grp[i].xy[1]) < 300){ seen.add(m.id); grp.push(m); }
    const base = (hashStr(String(s.id)) % 640) / 10;
    for (const m of grp) SIM.sigOff.set(m.id, base - Math.hypot(m.xy[0] - s.xy[0], m.xy[1] - s.xy[1]) / 11.1); }
  return SIM.sigOff.get(n.id) ?? 0; }
/* état du feu pour une approche de direction d (vers le carrefour) : 'g' | 'y' | 'r' */
function sigState(n, d, t = SIGT()){
  const c = sigCtl(n), Y = c._y ??= sigYellow(c), per = 2 * (SIGCYC.g + Y + SIGCYC.r), ph = ((t + sigOffset(c)) % per + per) % per, half = per / 2;
  // un seul axe équipé de feux (passage piéton, feux sur une seule rue) : vert long, rouge court (phase piétons/rue transversale)
  if (c._one){ const P = SIGCYC.g + Y + 10, q1 = ((t + sigOffset(c)) % P + P) % P; return q1 < SIGCYC.g ? 'g' : q1 < SIGCYC.g + Y ? 'y' : 'r'; }
  const axis = sigAxis(n, d), q = (ph - axis * half + per) % per;
  return q < SIGCYC.g ? 'g' : q < SIGCYC.g + Y ? 'y' : 'r';
}
/* durée du jaune fixe : 3 s en agglomération, 5 s hors agglomération (bâti à moins de 30 m : même critère que la signalisation de chantier) */
function sigYellow(c){ if (!WORLD?.W) return SIGCYC.y; const U = WORLD._urb ??= urbanIndex(WORLD.W); return U(c.xy[0], c.xy[1]) >= 2 ? 3 : 5; }
/* carrefour réglé par des feux : feu sur le nœud, ou carrefour auquel sont rattachés les feux posés sur les lignes d'arrêt */
function sigJunction(n){ if (n.sig) return true; if (!NET._sigJ){ NET._sigJ = new Set(); for (const m of NET.nodes.values()) if (m.sig) NET._sigJ.add(sigCtl(m).id); } return NET._sigJ.has(n.id); }
let SIGHEADS = null;   // {heads:[{n, d}], lamps:{r,y,g:InstancedMesh}, last:''}
const SIGCOL = {r:[0xFF2A1A, 0x3A0D0A], y:[0xFFB300, 0x3A2A06], g:[0x18E070, 0x0A2E18]};
function buildSignals(grp){
  // carrefours à feux ajoutés à la main (feux absents d'OpenStreetMap) : repère « FEUX » posé sur le carrefour
  for (const n of NET.nodes.values()) if (n.sigUser){ n.sig = false; n.sigUser = false; }
  for (const e of state?.els || []) if (e.t === 'obj' && e.k === 'FEUX' && !phOff(e)){ let best = null, bd = 25; for (const n of NET.nodes.values()){ if (nodeDeg(n) < 3 && !n.sig) continue; const d = Math.hypot(n.xy[0] - e.x, n.xy[1] - e.y); if (d < bd){ bd = d; best = n; } } if (best && !best.sig){ best.sig = true; best.sigUser = true; } }
  SIM.sigOff?.clear?.(); for (const n of NET.nodes.values()){ n._sref = null; n._ctl = null; n._one = false; n._ax = null; n._y = null; } NET._jg = null; NET._sigJ = null;
  SIGHEADS = null; const sig = [...NET.nodes.values()].filter(n => n.sig); if (!sig.length) return;
  const heads = [];
  for (const n of sig) for (const ei of n.inn){ const e = NET.edges[ei], a = NET.nodes.get(e.from).xy, d = V.norm(V.sub(n.xy, a)), w = NET.roads[e.r].w;
    const p = V.add(V.sub(n.xy, V.mul(d, Math.max(4, w * 0.8))), V.mul(V.perp(d), -(w / 2 + 0.6))); heads.push({n, d, p, a:Math.atan2(-d[1], -d[0])}); }
  // référence d'axe = première approche ÉQUIPÉE de feux du carrefour ; si toutes les approches équipées sont sur le même axe → cycle « un seul axe »
  { const by = new Map(); for (const h of heads){ const c = sigCtl(h.n); (by.get(c) || by.set(c, []).get(c)).push(h.d); } for (const [c, ds] of by) sigCluster(c, ds); }
  // mât + caisson noir à plaque de contraste jaune (feux R11v français), face aux usagers
  const pole = new THREE.CylinderGeometry(0.055, 0.065, 3.3, 8); pole.translate(0, 1.65, 0);
  const box = new THREE.BoxGeometry(0.22, 0.78, 0.3); box.translate(0, 3.0, 0);
  const plate = new THREE.BoxGeometry(0.03, 0.98, 0.46); plate.translate(-0.12, 3.0, 0);
  const visor = []; for (const y of [3.24, 3.0, 2.76]){ const v = new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12, 1, true, 0, Math.PI); v.rotateZ(Math.PI / 2); v.rotateX(Math.PI / 2); v.translate(0.17, y + 0.02, 0); visor.push(v.toNonIndexed()); }
  const body = new THREE.InstancedMesh(mergeGeometries([pole.toNonIndexed(), box.toNonIndexed(), ...visor]), matCol(0x1E2226, {metal:0.4, rough:0.55}), heads.length);
  const back = new THREE.InstancedMesh(plate, matCol(0xF2C200, {rough:0.6}), heads.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const lamps = {};
  for (const [k, y] of [['r', 3.24], ['y', 3.0], ['g', 2.76]]){
    const gL = new THREE.CircleGeometry(0.085, 18); gL.rotateY(Math.PI / 2); gL.translate(0.112, y, 0);
    const im = new THREE.InstancedMesh(gL, new THREE.MeshBasicMaterial({color:0xffffff, toneMapped:false}), heads.length); im.name = 'Feux · lampes'; lamps[k] = im; grp.add(im); }
  heads.forEach((h, i) => { q.setFromAxisAngle(up, h.a); m4.compose(new THREE.Vector3(h.p[0], H(h.p[0], h.p[1]), -h.p[1]), q, one);
    body.setMatrixAt(i, m4); back.setMatrixAt(i, m4); for (const k in lamps) lamps[k].setMatrixAt(i, m4); });
  body.castShadow = true; body.name = 'Feux tricolores'; back.name = 'Feux tricolores · plaques'; grp.add(body, back);
  heads.forEach((h, i) => { h.i = i; h.m = m4.clone().compose(new THREE.Vector3(h.p[0], H(h.p[0], h.p[1]), -h.p[1]), q.setFromAxisAngle(up, h.a), one); });
  SIGHEADS = {heads, lamps, body, back, last:'', vis:heads}; sigVisibility(); updateSignals(true);
}
/* feux affichés : seulement ceux à moins de 500 m des routes barrées (de la route barrée sélectionnée s'il y en a une) ;
   les autres continuent de régler la circulation simulée mais ne sont ni dessinés ni mis à jour à l'écran.
   Sans aucune route barrée, tous les feux sont affichés. */
let SIGVIS = null, SIGPIN = null;   // SIGPIN : carrefours à feux dont la bulle peut s'afficher (près des routes barrées ; aucun sans route barrée)
/* bulles de feux : seulement les carrefours qui comptent pour le chantier — à moins de 150 m de la route barrée
   ou sur l'itinéraire de déviation ; aucune sans route barrée (sinon des centaines de bulles recouvrent la ville) */
function sigPinSet(cls){
  const S = new Set(); if (!cls.length || typeof NET === 'undefined' || !NET?.nodes) return S;
  const ids = new Set(cls.map(c => c.id)), dets = (state?.els || []).filter(e => e.t === 'detour' && e.pts?.length > 1 && ids.has(e.cl) && !phOff(e));
  const near = (xy, pts, d) => pts.some((q, i) => V.dist(segClosest(xy, q, pts[i + 1] || q).pt, xy) < d);
  for (const n of NET.nodes.values()) if (n.sig){ const c = sigCtl(n); if (S.has(c.id)) continue; if (cls.some(k => near(c.xy, k.pts, 150)) || dets.some(k => near(c.xy, k.pts, 25))) S.add(c.id); }
  return S;
}
function sigVisibility(){
  if (!SIGHEADS){ if (typeof NET === 'undefined' || !NET?.nodes) return; const cls0 = (state?.els || []).filter(e => e.t === 'closure' && e.pts?.length && !phOff(e)), sc = cls0.find(e => e.id === sel), u = sc ? [sc] : cls0;
    SIGVIS = new Set([...NET.nodes.values()].filter(n => n.sig && (!u.length || u.some(c => c.pts.some((q, i) => V.dist(segClosest(n.xy, q, c.pts[i + 1] || q).pt, n.xy) < 500)))).map(n => sigCtl(n).id)); SIGPIN = sigPinSet(u); annoKey = ''; dirty = true; return; }
  const cls = (state?.els || []).filter(e => e.t === 'closure' && e.pts?.length && !phOff(e)), selC = cls.find(e => e.id === sel), use = selC ? [selC] : cls;
  const near = h => !use.length || use.some(c => c.pts.some((q, i) => { const b = c.pts[i + 1] || q; const t = segClosest(h.n.xy, q, b); return V.dist(t.pt, h.n.xy) < 500; }));
  const vis = SIGHEADS.heads.filter(near), Z = new THREE.Matrix4().makeScale(0, 0, 0); SIGVIS = new Set(vis.map(h => sigCtl(h.n).id)); SIGPIN = sigPinSet(use);
  for (const h of SIGHEADS.heads){ const M = vis.includes(h) ? h.m : Z; SIGHEADS.body.setMatrixAt(h.i, M); SIGHEADS.back.setMatrixAt(h.i, M); for (const k in SIGHEADS.lamps) SIGHEADS.lamps[k].setMatrixAt(h.i, M); }
  for (const im of [SIGHEADS.body, SIGHEADS.back, ...Object.values(SIGHEADS.lamps)]){ im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  SIGHEADS.vis = vis; SIGHEADS.last = ''; updateSignals(true); annoKey = ''; dirty = true;
}
/* rafraîchit les lampes allumées (appelé à chaque image ; ne redessine que si un feu a changé) */
function updateSignals(force = false){
  if (!SIGHEADS) return false; const t = Math.floor(SIGT() * 4) / 4; if (!force && t === SIGHEADS.tq) return false; SIGHEADS.tq = t; const V_ = SIGHEADS.vis, st = V_.map(h => sigState(h.n, h.d, t)), key = st.join('');
  if (!force && key === SIGHEADS.last) return false; SIGHEADS.last = key; const c = new THREE.Color();
  st.forEach((s, j) => { const i = V_[j].i; for (const k of ['r', 'y', 'g']) SIGHEADS.lamps[k].setColorAt(i, c.setHex(SIGCOL[k][s === k ? 0 : 1])); });
  for (const k in SIGHEADS.lamps) if (SIGHEADS.lamps[k].instanceColor) SIGHEADS.lamps[k].instanceColor.needsUpdate = true;
  // repères carte : couleur de l'axe principal
  for (const a of annos) if (a.sig && a.vis) a.d.dataset.s = sigState(a.sn, a.sd, t);
  return true;
}
