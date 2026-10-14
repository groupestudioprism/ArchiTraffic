/* ============ Bibliothèque ARCHITRAFIC : catalogue des éléments à placer ============ */
const LIB_CATS = {temp:'Signalisation temporaire', dang:'Danger et intersections', reg:'Prescription', ind:'Indication et direction', bal:'Balisage', veh:'Véhicules', eng:'Engins', chan:'Chantier et piétons'};
const LIB = [];
const libAdd = (cat, k, name, build, x = {}) => LIB.push({cat, k, name, build, ...x});
for (const [cat, codes] of Object.entries(SIGN_LIB)) for (const code of codes){ const S = SIGNS[code]; if (!S) continue; const perm = cat !== 'temp';
  libAdd(cat, code, S.n, p => perm && p?.pole === 'mât' ? signOnPole(code, p) : signOnStand(code, p), {sign:code, ref:code.replace(/_.*/, '').replace('KR', 'KC'), p:{...(S.p || {}), ...(perm ? {pole:'mât'} : {})}, h:1.6}); }
libAdd('bal', 'K5a', 'Cône de chantier', p => coneK5a(+(p?.h || 0.75)), {ref:'K5a', p:{h:'0.75'}});
libAdd('bal', 'K5b', 'Balise d\'alignement', () => baliseK5b(), {ref:'K5b'});
libAdd('bal', 'K5c', 'Balise de guidage', () => baliseK5c(), {ref:'K5c'});
libAdd('bal', 'K2', 'Barrière de chantier', p => barrierK2(+(p?.len || 2)), {ref:'K2', p:{len:'2'}});
libAdd('bal', 'KR11', 'Feu de chantier (alternat)', p => feuKR11(p?.on || 'red'), {ref:'KR11', p:{on:'red'}});
libAdd('bal', 'FLR', 'Flèche lumineuse de rabattement', () => flr(), {ref:'FLR'});
libAdd('bal', 'PMV', 'Panneau à messages variables', () => pmv(), {ref:'PMV'});
libAdd('bal', 'K16x', 'Séparateur modulaire (1 m)', () => { const g = new THREE.Group(), m = k16Module(); g.add(part(m.geo, C.red)); return g; }, {ref:'K16'});
libAdd('bal', 'GBAx', 'Glissière béton (2 m)', () => { const g = new THREE.Group(), m = gbaModule(); g.add(part(m.geo, C.concrete)); return g; }, {ref:'GBA'});
libAdd('bal', 'VAUx', 'Barrière Vauban (2 m)', () => vaubanModule().grp, {ref:'Vauban'});
libAdd('bal', 'HERx', 'Clôture de chantier (3,5 m)', () => herasModule().grp, {ref:'Clôture'});
const VEH_DEF = {citadine:['Citadine', () => makeCar('citadine', 0xC9C2B4)], berline:['Berline', () => makeCar('berline', 0x8D949B)], break:['Break', () => makeCar('break', 0x1F3F73)], suv:['SUV', () => makeCar('suv', 0x2E3238)],
  monospace:['Monospace', () => makeCar('monospace', 0xA61E22)], utilitaire:['Fourgon utilitaire', () => makeVan()], camionnette:['Camionnette benne', () => makePickup()], porteur:['Camion porteur', () => makeTruck()], semi:['Semi-remorque', () => makeSemi()],
  bus:['Bus', () => makeBus()], moto:['Moto', () => makeMoto()], velo:['Vélo', () => makeBike()]};
for (const [k, [n, f]] of Object.entries(VEH_DEF)) libAdd('veh', k, n, p => { const g = f(); if (p?.color) recolor(g, p.color); return g; }, {p:{color:''}, color:true});
const ENG_DEF = {pelle:['Pelle sur chenilles', () => makeExcavator(false)], minipelle:['Mini-pelle', () => makeExcavator(true)], chargeuse:['Chargeuse sur pneus', makeLoader], tractopelle:['Tractopelle', makeBackhoe],
  bouteur:['Bouteur (bulldozer)', makeDozer], niveleuse:['Niveleuse', makeGrader], tombereau:['Tombereau articulé', makeDumper], dumper:['Dumper de chantier', makeMiniDumper], telescopique:['Chariot télescopique', makeTelehandler],
  compacteur:['Compacteur monocylindre', makeRoller], tandem:['Compacteur tandem', makeTandem], finisseur:['Finisseur', makeFinisher], fraiseuse:['Fraiseuse (rabotage)', makeColdPlaner],
  benne:['Camion benne 8×4', () => makeTipper()], toupie:['Camion toupie', () => makeMixer()], grueAux:['Camion plateau grue', makeCraneTruck], porteEngins:['Porte-engins', makeLowLoader], hydrocureuse:['Hydrocureuse', makeVacTruck],
  nacelle:['Véhicule nacelle', makeAerial], grue:['Grue mobile', makeCrane], balayeuse:['Balayeuse de voirie', makeSweeper], vehFLR:['Véhicule de signalisation (FLR)', makeFLRTruck], tma:['Camion atténuateur (TMA)', makeTMA]};
for (const [k, [n, f]] of Object.entries(ENG_DEF)) libAdd('eng', k, n, () => f());
libAdd('chan', 'bungalow', 'Bungalow de chantier', bungalow); libAdd('chan', 'wc', 'Sanitaire de chantier', wcChantier); libAdd('chan', 'benneDechets', 'Benne à gravats', benne);
libAdd('chan', 'bigbag', 'Big bag', bigBag); libAdd('chan', 'sable', 'Tas de sable', () => tas(C.sand)); libAdd('chan', 'terre', 'Tas de terre', () => tas(C.earth, 2.2, 1.4)); libAdd('chan', 'palette', 'Palette de matériaux', palette);
libAdd('chan', 'groupe', 'Groupe électrogène', groupeElec); libAdd('chan', 'plaque', 'Plaque de roulage', plaqueRoulage); libAdd('chan', 'tranchee', 'Tranchée', tranchee);
libAdd('chan', 'ouvrier', 'Agent de chantier', () => person(true)); libAdd('chan', 'pieton', 'Piéton', () => person(false));
const LIBK = Object.fromEntries(LIB.map(e => [e.k, e]));
/* balisage en ligne (outil « Balisage ») */
const LINE_TYPES = {
  cones:{n:'Cônes K5a', sp:4, item:'K5a', legend:'Cônes K5a', col:'#F06A12'}, k5b:{n:'Balises K5b', sp:5, item:'K5b', legend:'Balises K5b', col:'#C8102E'},
  k16:{n:'Séparateurs K16 (continus)', mod:'k16', legend:'Séparateurs modulaires K16', col:'#C8102E'}, gba:{n:'Glissière béton (GBA)', mod:'gba', legend:'Glissière béton armé', col:'#8C8A84'},
  heras:{n:'Clôture de chantier', mod:'heras', legend:'Clôture de chantier', col:'#6E7781'}, vauban:{n:'Barrières Vauban', mod:'vauban', legend:'Barrières Vauban', col:'#9AA1A8'},
  k2:{n:'Barrières K2 (continues)', mod:'k2', legend:'Barrières K2', col:'#C8102E'}, rubalise:{n:'Rubalise', mod:'tape', legend:'Rubalise', col:'#E53935'},
};
function recolor(g, color){ const c = new THREE.Color(color); g.traverse(o => { if (o.isMesh && o.material?.userData.body) o.material = bodyMat(c.getHex()); }); }
/* vignettes 3D (rendues une fois, à la demande) */
const THUMBS = {};
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
let thumbScene = null, thumbCam = null; const thumbRTs = {};
/* rendu d'un objet isolé sur fond transparent → data URL (vignettes, aperçus) */
function renderPreview(obj, W = 160, Hh = W, opt = {}){
  const key = W + 'x' + Hh; let rt = thumbRTs[key];
  if (!rt){ rt = thumbRTs[key] = new THREE.WebGLRenderTarget(W, Hh, {samples:4}); rt.texture.colorSpace = THREE.SRGBColorSpace; }
  thumbCam ??= new THREE.PerspectiveCamera(30, 1, 0.05, 400); thumbCam.aspect = W / Hh; thumbCam.updateProjectionMatrix();
  if (!thumbScene){ thumbScene = new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.9)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(4, 7, 5); thumbScene.add(d); const d2 = new THREE.DirectionalLight(0xdfe8ff, 0.7); d2.position.set(-5, 3, -4); thumbScene.add(d2); }
  thumbScene.environment = envTex || null; thumbScene.add(obj);
  const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), r = Math.max(s.x, s.y * 1.1, s.z) * 0.62 + 0.08;
  const az = opt.az ?? 0.72, el = opt.el ?? 0.42, dist = r / Math.tan(thumbCam.fov * Math.PI / 360) * (W < Hh ? Hh / W : 1) * 1.08;
  thumbCam.position.set(c.x + Math.cos(az) * Math.cos(el) * dist, c.y + Math.sin(el) * dist, c.z + Math.sin(az) * Math.cos(el) * dist); thumbCam.lookAt(c);
  const bgc = renderer.getClearColor(new THREE.Color()), ba = renderer.getClearAlpha(); renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt); renderer.clear(); renderer.render(thumbScene, thumbCam); const px = new Uint8Array(W * Hh * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, Hh, px); renderer.setRenderTarget(null); renderer.setClearColor(bgc, ba);
  thumbScene.remove(obj);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const g = cv.getContext('2d'), img = g.createImageData(W, Hh);
  for (let y = 0; y < Hh; y++) img.data.set(px.subarray((Hh - 1 - y) * W * 4, (Hh - y) * W * 4), y * W * 4);
  g.putImageData(img, 0, 0); dirty = true; return cv.toDataURL('image/png');
}
function libThumb(e){
  if (THUMBS[e.k]) return THUMBS[e.k];
  if (e.sign) return THUMBS[e.k] = signThumb(e.sign, e.p);
  try { const obj = e.build(e.p || {}); const u = renderPreview(obj, 160, 160); obj.traverse(o => o.geometry?.dispose()); return THUMBS[e.k] = u; }
  catch(err){ console.warn('vignette', e.k, err); return THUMBS[e.k] = BLANK; }
}
