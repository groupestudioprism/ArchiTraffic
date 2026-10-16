/* ============ Bouchons : carte de congestion et files d'attente ============
   Pour chaque tronçon parcouru : rapport vitesse réelle / vitesse libre, lissé dans le temps (≈ 30 s),
   et longueur de file (véhicules à l'arrêt). Carte : vert fluide, orange ralenti, rouge bouchon. */
const CONG = {r:new Map(), q:new Map(), qmax:new Map(), mesh:null, show:true};
function congReset(){ CONG.r.clear(); CONG.q.clear(); CONG.qmax.clear(); if (CONG.mesh){ CONG.mesh.parent?.remove(CONG.mesh); CONG.mesh.geometry.dispose(); CONG.mesh = null; } }
function congSample(ei, ratio, dt, qlen){
  const k = NET.edges[ei]?.key; if (!k) return; const w = Math.min(1, dt / 30), o = CONG.r.get(k); CONG.r.set(k, o === undefined ? ratio : o + (Math.min(1, ratio) - o) * w);
  if (qlen) CONG.q.set(k, (CONG.q.get(k) || 0) + qlen);
}
function congRender(){
  // files du pas de temps écoulé → maxima par tronçon
  for (const [k, q] of CONG.q) if (q > (CONG.qmax.get(k) || 0)) CONG.qmax.set(k, q); CONG.q.clear();
  if (CONG.mesh){ CONG.mesh.parent?.remove(CONG.mesh); CONG.mesh.geometry.dispose(); CONG.mesh = null; }
  if (!CONG.show || !SIM.t) return;
  const pos = [], col = [], c = new THREE.Color();
  for (const [k, r] of CONG.r){ const sg = NET.segIdx.get(k); if (!sg) continue; const A = NET.nodes.get(sg.a)?.xy, B = NET.nodes.get(sg.b)?.xy; if (!A || !B) continue;
    c.set(r > 0.7 ? 0x1FB45A : r > 0.4 ? 0xF29A0E : r > 0.15 ? 0xE0321E : 0x8E0F0F);
    const d = V.norm(V.sub(B, A)), n = V.mul(V.perp(d), 1.6), w = Math.max(2, mPerPx() * 5), nn = V.mul(V.norm(n), w), za = H(A[0], A[1]) + 0.5, zb = H(B[0], B[1]) + 0.5;
    const p1 = V.add(A, nn), p2 = V.sub(A, nn), p3 = V.add(B, nn), p4 = V.sub(B, nn);
    pos.push(p1[0], za, -p1[1], p2[0], za, -p2[1], p3[0], zb, -p3[1], p3[0], zb, -p3[1], p2[0], za, -p2[1], p4[0], zb, -p4[1]); for (let i = 0; i < 6; i++) col.push(c.r, c.g, c.b); }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  CONG.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, opacity:0.85, depthTest:false, side:THREE.DoubleSide})); CONG.mesh.renderOrder = 6; CONG.mesh.name = 'Carte des bouchons'; markGroup.add(CONG.mesh);
}
/* les plus longues files observées, avec le nom de la rue */
function congQueues(n = 4){
  const byStreet = new Map();
  for (const [k, q] of CONG.qmax){ const sg = NET.segIdx.get(k); if (!sg) continue; const nm = NET.roads[sg.ri]?.name || 'voie sans nom'; byStreet.set(nm, Math.max(byStreet.get(nm) || 0, q)); }
  return [...byStreet].sort((a, b) => b[1] - a[1]).filter(x => x[1] >= 12).slice(0, n);
}
