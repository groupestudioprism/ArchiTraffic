/* ============ Réseaux souterrains ============
   Trois sources, par ordre de fiabilité :
   1. plans des exploitants importés (GeoJSON, en WGS84 ou en Lambert-93) : réponses aux DT/DICT, exports SIG des collectivités ;
   2. équipements cartographiés dans OpenStreetMap (regards, bouches à clé, armoires, poteaux incendie) : positions réelles ;
   3. réseau PRÉSUMÉ, généré d'après les règles de pose usuelles (assainissement sous chaussée, eau et gaz sous trottoir…).
      Toujours signalé comme présumé : il ne remplace jamais un relevé ni une réponse DT/DICT.
   Couleurs des grillages avertisseurs (NF EN 12613) ; profondeurs de génératrice usuelles. */
const NET_TYPES = {
  eu:{n:'Eaux usées', col:0x7B4A26, d:2.4, r:0.15}, ep:{n:'Eaux pluviales', col:0xA0784B, d:1.8, r:0.2}, aep:{n:'Eau potable', col:0x1E63C6, d:1.0, r:0.05},
  gaz:{n:'Gaz', col:0xF2C400, d:0.9, r:0.045}, elec:{n:'Électricité', col:0xD32F2F, d:0.8, r:0.055}, tel:{n:'Télécommunications', col:0x2E9D4A, d:0.6, r:0.05},
  ecl:{n:'Éclairage public et signalisation', col:0xF0F0F0, d:0.5, r:0.03}, chauf:{n:'Chauffage urbain', col:0x7E3FA0, d:1.2, r:0.12}, autre:{n:'Autre réseau', col:0xE07A10, d:1.0, r:0.05},
};
const NETBUILT = {types:new Map()};   // type → 'présumé' | 'plan importé' (pour la légende)
function netTypeOf(props = {}){
  const s = ' ' + Object.values(props).filter(v => typeof v === 'string' || typeof v === 'number').join(' ').toLowerCase().replace(/r[ée]seau/g, ' ') + ' ';
  if (/eaux? us[ée]|\beu\b|unitaire|assainissement|sewer|waste/.test(s)) return 'eu';
  if (/pluvia|\bep\b|storm|drain/.test(s)) return 'ep';
  if (/potable|\baep\b|adduction|water|[^a-z]eau[^a-z]/.test(s)) return 'aep';
  if (/gaz|gas|grdf/.test(s)) return 'gaz';
  if (/[ée]clairage|signalisation lumineuse|feux/.test(s)) return 'ecl';
  if (/t[ée]l[ée]com|fibre|orange|\bft\b|telecom|cuivre|optique/.test(s)) return 'tel';
  if (/[ée]lec|enedis|\bhta\b|\bbt\b|power|rte/.test(s)) return 'elec';
  if (/chauffage|chaleur|heat|vapeur|froid urbain/.test(s)) return 'chauf';
  return 'autre';
}
/* Lambert-93 (RGF93, EPSG:2154) → longitude / latitude (degrés) */
function l93ToLL(X, Y){
  const n = 0.725607765053267, C = 11754255.426096, Xs = 700000, Ys = 12655612.049876, e = 0.0818191910428158, lon0 = 3 * Math.PI / 180;
  const dx = X - Xs, dy = Y - Ys, R = Math.hypot(dx, dy), g = Math.atan2(dx, -dy), L = -Math.log(Math.abs(R / C)) / n;
  let phi = 2 * Math.atan(Math.exp(L)) - Math.PI / 2; for (let i = 0; i < 8; i++){ const es = e * Math.sin(phi); phi = 2 * Math.atan(Math.pow((1 + es) / (1 - es), e / 2) * Math.exp(L)) - Math.PI / 2; }
  return [(lon0 + g / n) * 180 / Math.PI, phi * 180 / Math.PI];
}
/* import d'un plan de réseaux (GeoJSON) : lignes → canalisations ; profondeur lue si renseignée */
function importNetworks(text, fname){
  let gj; try { gj = JSON.parse(text); } catch(e){ toast('Fichier non reconnu : choisissez un plan de réseaux au format GeoJSON.'); return; }
  const feats = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [];
  const conv = c => Math.abs(c[0]) > 1000 || Math.abs(c[1]) > 1000 ? l93ToLL(c[0], c[1]) : [c[0], c[1]];
  const lines = [];
  for (const f of feats){ const g = f?.geometry, P = f?.properties || {}; if (!g) continue;
    const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
    const type = netTypeOf(P), dep = parseFloat(String(P.profondeur ?? P.prof ?? P.depth ?? P.PROFONDEUR ?? '').replace(',', '.')), dia = parseFloat(String(P.diametre ?? P.DN ?? P.dn ?? P.diameter ?? '').replace(',', '.'));
    for (const c of parts) if (c?.length >= 2) lines.push({type, ll:c.map(conv), depth:dep > 0 && dep < 15 ? dep : null, r:dia > 0 ? (dia > 5 ? dia / 2000 : dia / 2) : null, name:String(P.nom || P.name || P.exploitant || '')}); }
  if (!lines.length){ toast('Aucune canalisation (ligne) trouvée dans ce fichier.'); return; }
  edit(() => { state.nets = [...(state.nets || []), ...lines]; });
  DISPLAY.lay.nets = true; saveDisplay(); buildWorld(); renderLegend();
  const types = [...new Set(lines.map(l => NET_TYPES[l.type].n))].join(', ');
  toast(`${lines.length} canalisations importées (${types}). Le réseau présumé de ces types est remplacé par le plan.`, 6500);
}
/* réseau présumé, d'après la voirie : une ligne par réseau, décalée de l'axe selon les usages de pose */
function presumedNetworks(){
  const W = WORLD.W, out = [], urb = urbanIndex(W);
  for (const r of W.roads){ if (!r.drive || r.cls > 6 || r.tunnel || r.pts.length < 2) continue; const mid = plAt(r.pts, plLen(r.pts) / 2).pt; if (urb(mid[0], mid[1]) < 2 && r.cls > 3) continue;
    const e = r.w / 2, swW = r.cls <= 3 ? 2.6 : r.cls <= 4 ? 2 : 1.6;
    const lay = [['eu', r.oneway ? 0.6 : 1.2], ['ep', r.oneway ? -0.8 : -1.2], ['aep', e + 0.45 + swW * 0.35], ['tel', e + 0.45 + swW * 0.62], ['gaz', -(e + 0.45 + swW * 0.4)], ['elec', -(e + 0.45 + swW * 0.7)], ['ecl', -(e + 0.6)]];
    for (const [type, off] of lay) out.push({type, pts:plOffset(densify(r.pts, 4), off), presumed:true}); }
  return out;
}
let hydrantGeo = null;
function buildNetworks(grp){
  NETBUILT.types.clear(); if (!WORLD) return;
  const P = WORLD.P, imported = (state.nets || []).map(l => ({...l, pts:l.ll.map(c => P.toXY(c[0], c[1]))})), have = new Set(imported.map(l => l.type));
  const lines = [...imported, ...presumedNetworks().filter(l => !have.has(l.type))];
  const unit = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false), up = new THREE.Vector3(0, 1, 0), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), S = WORLD.size / 2 + 40;
  for (const [type, T] of Object.entries(NET_TYPES)) for (const presumed of [false, true]){
    const L = lines.filter(l => l.type === type && !!l.presumed === presumed); if (!L.length) continue;
    const segs = []; for (const l of L){ const d = l.depth ?? T.d, rr = l.r ?? T.r; const p = densify(l.pts, 4); for (let i = 0; i + 1 < p.length; i++){ const a = p[i], b = p[i + 1]; if (Math.abs(a[0]) > S || Math.abs(a[1]) > S) continue; segs.push([a, b, d, rr]); } }
    if (!segs.length) continue;
    const mat = new THREE.MeshStandardMaterial({color:T.col, roughness:0.55, metalness:0.1, transparent:presumed, opacity:presumed ? 0.9 : 1, emissive:T.col, emissiveIntensity:0.45});
    const im = new THREE.InstancedMesh(unit, mat, segs.length);
    segs.forEach(([a, b, d, rr], i) => { const A = new THREE.Vector3(a[0], H(a[0], a[1]) - d - rr, -a[1]), B = new THREE.Vector3(b[0], H(b[0], b[1]) - d - rr, -b[1]), dir = B.clone().sub(A), len = dir.length() || 0.01;
      m4.compose(A.clone().addScaledVector(dir, 0.5), q.setFromUnitVectors(up, dir.normalize()), new THREE.Vector3(rr, len, rr)); im.setMatrixAt(i, m4); });
    im.name = `Réseau ${T.n}${presumed ? ' (présumé)' : ''}`; im.userData.net = type; im.frustumCulled = false; grp.add(im);
    NETBUILT.types.set(type, presumed && !NETBUILT.types.has(type) ? 'présumé' : NETBUILT.types.get(type) === 'présumé' && !presumed ? 'plan importé' : (NETBUILT.types.get(type) || (presumed ? 'présumé' : 'plan importé')));
  }
}
/* coupe : sol, chaussées et trottoirs transparents pour voir les réseaux */
function applyCutaway(grp){
  grp.traverse(o => { if (!o.isMesh || o.userData.net) return; if (!/Terrain|Chaussées|Trottoirs|Caniveaux|Bordures|Voies piétonnes|Chemins|Pistes|Coupe du sol|Ballast|Occupation|Espaces|Marquages|Regards|Avaloirs|télécom|podotactiles/.test(o.name)) return;
    const mk = m => { const c = m.clone(); c.transparent = true; c.opacity = /Terrain|Coupe/.test(o.name) ? 0.14 : 0.22; c.depthWrite = false; return c; }; o.material = Array.isArray(o.material) ? o.material.map(mk) : mk(o.material); o.renderOrder = 2; });
}
/* poteaux incendie et équipements réels d'OpenStreetMap */
function buildUtilities(grp){
  const U = WORLD.W.utils || []; const hyd = U.filter(u => u.k === 'hydrant'); if (!hyd.length) return;
  if (!hydrantGeo){ const a = new THREE.CylinderGeometry(0.1, 0.11, 0.85, 12); a.translate(0, 0.425, 0); const c = new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(0, 0.85, 0); const s = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8); s.rotateZ(Math.PI / 2); s.translate(0, 0.62, 0); hydrantGeo = mergeGeometries([a.toNonIndexed(), c.toNonIndexed(), s.toNonIndexed()]); }
  const im = new THREE.InstancedMesh(hydrantGeo, matCol(0xC62828, {rough:0.45, metal:0.3}), hyd.length), m4 = new THREE.Matrix4();
  hyd.forEach((u, i) => { m4.makeTranslation(u.x, H(u.x, u.y) + 0.15, -u.y); im.setMatrixAt(i, m4); }); im.castShadow = true; im.name = 'Poteaux incendie'; grp.add(im);
}
$('#netIn')?.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (!WORLD){ toast('Choisissez d\'abord le lieu du chantier.'); return; } const r = new FileReader(); r.onload = () => importNetworks(r.result, f.name); r.readAsText(f); });
