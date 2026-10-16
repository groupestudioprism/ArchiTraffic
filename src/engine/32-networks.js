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
/* Lambert conique conforme (GRS80) inverse : Lambert-93 et coniques conformes 9 zones CC42…CC50 → longitude / latitude */
function lccToLL(X, Y, lat0, lat1, lat2, lon0, x0, y0){
  const a = 6378137, e = 0.0818191910428158, r = Math.PI / 180, m = p => Math.cos(p) / Math.sqrt(1 - e * e * Math.sin(p) ** 2), t = p => Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - e * Math.sin(p)) / (1 + e * Math.sin(p)), e / 2);
  const p1 = lat1 * r, p2 = lat2 * r, p0 = lat0 * r, n = (Math.log(m(p1)) - Math.log(m(p2))) / (Math.log(t(p1)) - Math.log(t(p2))), F = m(p1) / (n * Math.pow(t(p1), n)), r0 = a * F * Math.pow(t(p0), n);
  const dx = X - x0, dy = r0 - (Y - y0), rr = Math.sign(n) * Math.hypot(dx, dy), tt = Math.pow(rr / (a * F), 1 / n), th = Math.atan2(dx, dy);
  let phi = Math.PI / 2 - 2 * Math.atan(tt); for (let i = 0; i < 10; i++){ const es = e * Math.sin(phi); phi = Math.PI / 2 - 2 * Math.atan(tt * Math.pow((1 - es) / (1 + es), e / 2)); }
  return [th / n / r + lon0, phi / r];
}
/* reconnaît le système d'un plan : Lambert-93 (EPSG:2154), CC42…CC50 (EPSG:3942…3950) ou déjà en degrés */
function frProj(X, Y){
  if (Math.abs(X) <= 180 && Math.abs(Y) <= 90) return c => c;
  if (X > 50000 && X < 1300000 && Y > 6000000 && Y < 7200000) return c => l93ToLL(c[0], c[1]);
  if (X > 1000000 && X < 2500000 && Y > 1000000 && Y < 9400000){ const z = Math.round((Y - 200000) / 1e6) + 41; if (z >= 42 && z <= 50) return c => lccToLL(c[0], c[1], z, z - 0.75, z + 0.75, 3, 1700000, (z - 41) * 1e6 + 200000); }
  return null;
}
/* lecture DXF (format texte) : LINE, LWPOLYLINE, POLYLINE/VERTEX, avec le calque de chaque entité */
function parseDXF(text){
  const L = text.split(/\r?\n/), out = []; let i = 0, inEnt = false;
  const pairs = []; for (let k = 0; k + 1 < L.length; k += 2) pairs.push([L[k].trim(), L[k + 1].trim()]);
  let cur = null, poly = null;
  const flush = () => { if (cur && cur.pts.length >= 2) out.push(cur); cur = null; };
  for (const [c, v] of pairs){
    if (c === '2' && v === 'ENTITIES'){ inEnt = true; continue; } if (!inEnt) continue;
    if (c === '0'){
      if (v === 'VERTEX' && poly){ cur = null; poly.vx = {}; continue; }
      if (poly && poly.vx && v !== 'VERTEX'){ /* fin des sommets */ }
      if (v === 'SEQEND'){ if (poly && poly.pts.length >= 2) out.push(poly); poly = null; continue; }
      flush(); if (poly && v !== 'VERTEX'){ if (poly.pts.length >= 2) out.push(poly); poly = null; }
      if (v === 'ENDSEC') break;
      if (v === 'LINE') cur = {kind:'line', layer:'', pts:[], t:{}};
      else if (v === 'LWPOLYLINE') cur = {kind:'lw', layer:'', pts:[], t:{}};
      else if (v === 'POLYLINE'){ poly = {kind:'poly', layer:'', pts:[]}; }
      continue;
    }
    if (poly && poly.vx){ if (c === '10') poly.vx.x = +v; else if (c === '20'){ poly.pts.push([poly.vx.x, +v]); } else if (c === '8' && !poly.layer) poly.layer = v; continue; }
    if (poly && c === '8'){ poly.layer = v; continue; }
    if (!cur) continue;
    if (c === '8') cur.layer = v;
    else if (cur.kind === 'line'){ if (c === '10') cur.t.x1 = +v; else if (c === '20') cur.pts[0] = [cur.t.x1, +v]; else if (c === '11') cur.t.x2 = +v; else if (c === '21') cur.pts[1] = [cur.t.x2, +v]; }
    else if (cur.kind === 'lw'){ if (c === '10') cur.t.x = +v; else if (c === '20') cur.pts.push([cur.t.x, +v]); }
  }
  flush(); if (poly && poly.pts.length >= 2) out.push(poly);
  return out.filter(e => e.pts.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])));
}
function importDXF(text, fname){
  const ents = parseDXF(text); if (!ents.length){ toast('Aucune ligne lue dans ce DXF (enregistrez-le en DXF ASCII, version 2000 ou plus récente).', 6000); return; }
  const c0 = ents[0].pts[0], conv = frProj(c0[0], c0[1]);
  if (!conv){ toast('Ce DXF est en coordonnées locales : il faut un plan géoréférencé (Lambert-93 ou CC42 à CC50) pour le placer automatiquement.', 7000); return; }
  // le nom du calque désigne le réseau (ex. « EU_Collecteur », « AEP », « GAZ_BP », « FT », « ECL ») ; diamètre lu s'il y figure (DN150, Ø200)
  const lines = ents.map(e => { const dn = /(?:DN|Ø|D)\s?(\d{2,4})/i.exec(e.layer); return {type:netTypeOf({layer:e.layer.replace(/[_-]/g, ' ')}), ll:e.pts.map(conv), depth:null, r:dn ? +dn[1] / 2000 : null, name:e.layer}; });
  edit(() => { state.nets = [...(state.nets || []), ...lines]; });
  DISPLAY.lay.nets = true; saveDisplay(); buildWorld(); renderLegend();
  const by = {}; for (const l of lines) by[NET_TYPES[l.type].n] = (by[NET_TYPES[l.type].n] || 0) + 1;
  toast(`${lines.length} tronçons importés depuis ${fname} : ${Object.entries(by).map(([k, n]) => `${k} (${n})`).join(', ')}. Les calques non reconnus sont classés « Autre réseau ».`, 8000);
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
  for (const r of W.roads){ if (r.lite || !r.drive || r.cls > 6 || r.tunnel || r.pts.length < 2) continue; const mid = plAt(r.pts, plLen(r.pts) / 2).pt; if (urb(mid[0], mid[1]) < 2 && r.cls > 3) continue;
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
$('#netIn')?.addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (!WORLD){ toast('Choisissez d\'abord le lieu du chantier.'); return; } const r = new FileReader(); if (/\.dwg$/i.test(f.name)){ toast('Le DWG est un format fermé : enregistrez le plan en DXF depuis votre logiciel de DAO (ou avec le convertisseur gratuit ODA File Converter), puis importez le DXF.', 9000); return; }
  r.onload = () => /\.dxf$/i.test(f.name) ? importDXF(r.result, f.name) : importNetworks(r.result, f.name); r.readAsText(f); });
