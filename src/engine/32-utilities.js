/* ============ Équipements de surface d'OpenStreetMap ============
   Poteaux incendie réels (positions OSM). Les réseaux souterrains ont été retirés. */
let hydrantGeo = null;
function buildUtilities(grp){
  const U = WORLD.W.utils || []; const hyd = U.filter(u => u.k === 'hydrant'); if (!hyd.length) return;
  if (!hydrantGeo){ const a = new THREE.CylinderGeometry(0.1, 0.11, 0.85, 12); a.translate(0, 0.425, 0); const c = new THREE.SphereGeometry(0.11, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(0, 0.85, 0); const s = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8); s.rotateZ(Math.PI / 2); s.translate(0, 0.62, 0); hydrantGeo = mergeGeometries([a.toNonIndexed(), c.toNonIndexed(), s.toNonIndexed()]); }
  const im = new THREE.InstancedMesh(hydrantGeo, matCol(0xC62828, {rough:0.45, metal:0.3}), hyd.length), m4 = new THREE.Matrix4();
  hyd.forEach((u, i) => { m4.makeTranslation(u.x, H(u.x, u.y) + 0.15, -u.y); im.setMatrixAt(i, m4); }); im.castShadow = true; im.name = 'Poteaux incendie'; grp.add(im);
}
