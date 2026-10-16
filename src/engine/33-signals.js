/* ============ Feux tricolores (carrefours à feux OSM) ============
   Cycle à la française : vert 27 s, jaune fixe 3 s, rouge intégral 2 s, par axe (deux phases en opposition).
   Têtes de feux R/J/V à 3 feux sur mât, allumées selon le cycle (en simulation : temps simulé ; sinon horloge),
   et repère sur la carte avec la couleur en cours. Les véhicules simulés s'arrêtent au rouge et au jaune. */
const SIGCYC = {g:27, y:3, r:2};   // période = 2 × (vert + jaune + rouge intégral) = 64 s
const SIGT = () => SIM.on ? SIM.t : performance.now() / 1000;   // simulation en cours : temps simulé ; sinon les feux tournent en temps réel
/* axe d'une approche : comparé à la première approche du carrefour (et non aux axes x/y), pour que deux rues
   d'un même carrefour diagonal ne soient jamais vertes en même temps ni rouges toutes les deux pour toujours */
function sigAxis(n, d){ let r = n._sref; if (!r){ const e = NET.edges[n.inn?.[0]]; r = e ? V.norm(V.sub(n.xy, NET.nodes.get(e.from).xy)) : [1, 0]; n._sref = r; }
  return Math.abs(d[0] * r[0] + d[1] * r[1]) >= Math.SQRT1_2 ? 0 : 1; }
/* coordination : les feux à moins de 300 m les uns des autres (OSM ou posés à la main) forment un ensemble ;
   chaque feu est décalé du feu pilote selon la distance (onde verte à 40 km/h) au lieu d'un décalage aléatoire */
function sigOffset(n){ let o = SIM.sigOff.get(n.id); if (o !== undefined) return o;
  const sig = [...NET.nodes.values()].filter(m => m.sig), seen = new Set();
  for (const s of sig){ if (seen.has(s.id)) continue; const grp = [s]; seen.add(s.id);
    for (let i = 0; i < grp.length; i++) for (const m of sig) if (!seen.has(m.id) && Math.hypot(m.xy[0] - grp[i].xy[0], m.xy[1] - grp[i].xy[1]) < 300){ seen.add(m.id); grp.push(m); }
    const base = (hashStr(String(s.id)) % 640) / 10;
    for (const m of grp) SIM.sigOff.set(m.id, base - Math.hypot(m.xy[0] - s.xy[0], m.xy[1] - s.xy[1]) / 11.1); }
  return SIM.sigOff.get(n.id) ?? 0; }
/* état du feu pour une approche de direction d (vers le carrefour) : 'g' | 'y' | 'r' */
function sigState(n, d, t = SIGT()){
  const per = 2 * (SIGCYC.g + SIGCYC.y + SIGCYC.r), ph = ((t + sigOffset(n)) % per + per) % per, half = per / 2;
  const axis = sigAxis(n, d), q = (ph - axis * half + per) % per;
  return q < SIGCYC.g ? 'g' : q < SIGCYC.g + SIGCYC.y ? 'y' : 'r';
}
let SIGHEADS = null;   // {heads:[{n, d}], lamps:{r,y,g:InstancedMesh}, last:''}
const SIGCOL = {r:[0xFF2A1A, 0x3A0D0A], y:[0xFFB300, 0x3A2A06], g:[0x18E070, 0x0A2E18]};
function buildSignals(grp){
  // carrefours à feux ajoutés à la main (feux absents d'OpenStreetMap) : repère « FEUX » posé sur le carrefour
  for (const n of NET.nodes.values()) if (n.sigUser){ n.sig = false; n.sigUser = false; }
  for (const e of state?.els || []) if (e.t === 'obj' && e.k === 'FEUX' && !phOff(e)){ let best = null, bd = 25; for (const n of NET.nodes.values()){ if (nodeDeg(n) < 3 && !n.sig) continue; const d = Math.hypot(n.xy[0] - e.x, n.xy[1] - e.y); if (d < bd){ bd = d; best = n; } } if (best && !best.sig){ best.sig = true; best.sigUser = true; } }
  SIM.sigOff?.clear?.(); for (const n of NET.nodes.values()) n._sref = null;
  SIGHEADS = null; const sig = [...NET.nodes.values()].filter(n => n.sig); if (!sig.length) return;
  const heads = [];
  for (const n of sig) for (const ei of n.inn){ const e = NET.edges[ei], a = NET.nodes.get(e.from).xy, d = V.norm(V.sub(n.xy, a)), w = NET.roads[e.r].w;
    const p = V.add(V.sub(n.xy, V.mul(d, Math.max(4, w * 0.8))), V.mul(V.perp(d), -(w / 2 + 0.6))); heads.push({n, d, p, a:Math.atan2(-d[1], -d[0])}); }
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
  SIGHEADS = {heads, lamps, last:''}; updateSignals(true);
}
/* rafraîchit les lampes allumées (appelé à chaque image ; ne redessine que si un feu a changé) */
function updateSignals(force = false){
  if (!SIGHEADS) return false; const t = SIGT(), st = SIGHEADS.heads.map(h => sigState(h.n, h.d, t)), key = st.join('');
  if (!force && key === SIGHEADS.last) return false; SIGHEADS.last = key; const c = new THREE.Color();
  st.forEach((s, i) => { for (const k of ['r', 'y', 'g']) SIGHEADS.lamps[k].setColorAt(i, c.setHex(SIGCOL[k][s === k ? 0 : 1])); });
  for (const k in SIGHEADS.lamps) if (SIGHEADS.lamps[k].instanceColor) SIGHEADS.lamps[k].instanceColor.needsUpdate = true;
  // repères carte : couleur de l'axe principal
  for (const a of annos) if (a.sig) a.d.dataset.s = sigState(a.sn, a.sd, t);
  return true;
}
