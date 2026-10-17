/* ============ Le site en 3D : relief NGF, voirie, trottoirs, bâtiments, arbres ============
   Construit à partir du « monde » chargé pour la zone (10-geo.js). Chaque calque est fusionné par matériau (peu d'appels de dessin). */
let WORLD = null;   // {size, P, z0, elev:{N, z}, W, net, labels}
/* altitude du relief mesuré (m, relative à l'origine NGF z0) au point (x, y) : interpolation des données IGN */
function Hraw(x, y){
  let E = WORLD?.elev; if (!E) return 0; let S = WORLD.size;
  const E2 = WORLD.elev2; if (E2 && Math.abs(x) < E2.S / 2 && Math.abs(y) < E2.S / 2){ E = E2; S = E2.S; }   // relief fin au cœur de zone
  const N = E.N, st = S / (N - 1); let fi = (x + S / 2) / st, fj = (y + S / 2) / st;
  fi = clamp(fi, 0, N - 1.0001); fj = clamp(fj, 0, N - 1.0001);
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, z = (a, b) => E.z[b * N + a];
  return ((z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v) - WORLD.z0;
}
/* ---------- sol affiché ----------
   Le sol est un maillage (grille triangulée) : grossier sur toute la zone, fin dans le cœur quand le relief fin existe.
   H() rend l'altitude EXACTE de ce maillage (mêmes triangles) : routes, trottoirs, zones barrées, panneaux, véhicules posés
   avec H() sont donc toujours sur le sol visible, jamais dessous (avant, ils suivaient le relief brut et passaient sous le
   maillage dans les creux). La grille fine est raccordée à la grossière sur son bord (aucune fissure). */
const SURF_CAP = 257;
function surfGrids(){
  if (WORLD.surf) return WORLD.surf;
  const S = WORLD.size, n = Math.max(2, Math.min(WORLD.elev.N, SURF_CAP)), st = S / (n - 1), z = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) z[j * n + i] = Hraw(-S / 2 + i * st, -S / 2 + j * st);
  const G = {S, n, st, z, x0:-S / 2}, out = {G, F:null};
  const E2 = WORLD.elev2;
  if (E2){   // cœur fin, bord aligné sur la grille grossière
    const c0 = Math.ceil((n - 1) / 2 - E2.S / 2 / st), c1 = (n - 1) - c0, h = (c1 - c0) / 2 * st;   // cellules c0..c1 de la grille grossière
    if (c1 - c0 >= 2){
      const target = LOWPOW ? 10 : 6, m = Math.min(LOWPOW ? 241 : 401, Math.max(2, Math.round(2 * h / target) + 1)), sf = 2 * h / (m - 1), zf = new Float32Array(m * m), F = {h, n:m, st:sf, z:zf, x0:-h, c0, c1};
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++){ const x = -h + i * sf, y = -h + j * sf; zf[j * m + i] = (i === 0 || j === 0 || i === m - 1 || j === m - 1) ? triZ(G, x, y) : Hraw(x, y); }
      out.F = F;
    }
  }
  return WORLD.surf = out;
}
/* altitude d'une grille triangulée (diagonale a→d, comme le maillage du sol) */
function triZ(G, x, y){
  const n = G.n; let fi = (x - G.x0) / G.st, fj = (y - G.x0) / G.st;
  fi = fi < 0 ? 0 : fi > n - 1.0001 ? n - 1.0001 : fi; fj = fj < 0 ? 0 : fj > n - 1.0001 ? n - 1.0001 : fj;
  const i = fi | 0, j = fj | 0, u = fi - i, v = fj - j, Z = G.z, a = Z[j * n + i], b = Z[j * n + i + 1], c = Z[(j + 1) * n + i], d = Z[(j + 1) * n + i + 1];
  return u >= v ? a + u * (b - a) + v * (d - b) : a + v * (c - a) + u * (d - c);
}
function H(x, y){
  if (!WORLD?.elev) return 0;
  const R = WORLD.surf || surfGrids(), F = R.F;
  return F && x > -F.h && x < F.h && y > -F.h && y < F.h ? triZ(F, x, y) : triZ(R.G, x, y);
}
const NGF = (x, y) => WORLD ? WORLD.z0 + Hraw(x, y) : null;

/* ---------- constructeur de géométrie (triangles, UV en mètres) ---------- */
class GB {
  constructor(){ this.p = []; this.u = []; }
  tri(a, b, c, ua, ub, uc){ this.p.push(...a, ...b, ...c); this.u.push(...ua, ...ub, ...uc); }
  quad(a, b, c, d, ua, ub, uc, ud){ this.tri(a, b, c, ua, ub, uc); this.tri(a, c, d, ua, uc, ud); }
  get empty(){ return !this.p.length; }
  geo(){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.computeVertexNormals(); return g; }
}
const P3 = (x, y, z) => [x, z, -y];
function densify(pts, step = 3){
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++){ const a = pts[i - 1], b = pts[i], L = V.dist(a, b), n = Math.max(1, Math.ceil(L / step)); for (let k = 1; k <= n; k++) out.push(V.lerp(a, b, k / n)); }
  return out;
}
/* bande drapée sur le relief, entre les décalages o0 et o1 (gauche > 0) ; dz = hauteur au-dessus du sol ; v en mètres */
function bandGB(gb, pts, o0, o1, dz0, dz1 = dz0, flipV = false){
  /* hors du cœur détaillé d'une grande zone (relief plus grossier, vu de loin) : maillage 3 à 6 fois plus léger */
  const far = typeof CORE !== 'undefined' && WORLD && WORLD.size > CORE && Math.max(Math.abs(pts[0][0]), Math.abs(pts[0][1])) > CORE / 2 + 150;
  const p = densify(pts, far ? 12 : 3); if (p.length < 2) return;
  /* bandes larges (chaussées) : une rangée de points tous les 4 m en travers, chacun posé sur le sol affiché */
  const w = Math.abs(o1 - o0), K = far ? 1 : Math.max(1, Math.ceil(w / 4)), rows = [];
  for (let k = 0; k <= K; k++){ const t = k / K, o = o0 + (o1 - o0) * t, L = plOffset(p, o), dz = dz0 + (dz1 - dz0) * t, v = flipV ? w * (1 - t) : w * t;
    rows.push({v, P:L.map(q => P3(q[0], q[1], H(q[0], q[1]) + dz))}); }
  let s = 0;
  for (let i = 0; i + 1 < p.length; i++){
    const ds = V.dist(p[i], p[i + 1]);
    for (let k = 0; k < K; k++){
      const R0 = rows[k], R1 = rows[k + 1], A = R0.P[i], D = R0.P[i + 1], C = R1.P[i + 1], B = R1.P[i];
      if (o1 > o0) gb.quad(A, D, C, B, [s, R0.v], [s + ds, R0.v], [s + ds, R1.v], [s, R1.v]);
      else gb.quad(A, B, C, D, [s, R0.v], [s, R1.v], [s + ds, R1.v], [s + ds, R0.v]);
    }
    s += ds;
  }
}
/* paroi verticale le long d'une polyligne au décalage o, du sol+z0 au sol+z1 */
function wallGB(gb, pts, o, z0, z1, outward = 1){
  const p = densify(pts, 3), L = plOffset(p, o); let s = 0;
  for (let i = 0; i + 1 < p.length; i++){
    const a = L[i], b = L[i + 1], ds = V.dist(p[i], p[i + 1]), ha = H(a[0], a[1]), hb = H(b[0], b[1]);
    if (outward > 0) gb.quad(P3(a[0], a[1], ha + z0), P3(b[0], b[1], hb + z0), P3(b[0], b[1], hb + z1), P3(a[0], a[1], ha + z1), [s, 0], [s + ds, 0], [s + ds, z1 - z0], [s, z1 - z0]);
    else gb.quad(P3(b[0], b[1], hb + z0), P3(a[0], a[1], ha + z0), P3(a[0], a[1], ha + z1), P3(b[0], b[1], hb + z1), [s + ds, 0], [s, 0], [s, z1 - z0], [s + ds, z1 - z0]);
    s += ds;
  }
}
function discGB(gb, c, r, dz, n = 18){
  for (let k = 0; k < n; k++){ const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2, p0 = [c[0] + Math.cos(a0) * r, c[1] + Math.sin(a0) * r], p1 = [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r];
    gb.tri(P3(c[0], c[1], H(c[0], c[1]) + dz), P3(p0[0], p0[1], H(p0[0], p0[1]) + dz), P3(p1[0], p1[1], H(p1[0], p1[1]) + dz), [c[0], c[1]], [p0[0], p0[1]], [p1[0], p1[1]]); }
}
/* polygone drapé (triangulé puis subdivisé pour suivre le relief) */
function polyGB(gb, ring, holes, dz){
  const c = ringArea(ring) < 0 ? ring.slice().reverse() : ring, hs = (holes || []).map(h => ringArea(h) > 0 ? h.slice().reverse() : h);
  const tris = THREE.ShapeUtils.triangulateShape(c.map(q => new THREE.Vector2(q[0], q[1])), hs.map(h => h.map(q => new THREE.Vector2(q[0], q[1]))));
  const all = [...c, ...hs.flat()];
  const sub = (a, b, cc, depth) => { const e = Math.max(V.dist(a, b), V.dist(b, cc), V.dist(cc, a)); if (e > 12 && depth < 5){ const ab = V.lerp(a, b, 0.5), bc = V.lerp(b, cc, 0.5), ca = V.lerp(cc, a, 0.5); sub(a, ab, ca, depth + 1); sub(ab, b, bc, depth + 1); sub(ca, bc, cc, depth + 1); sub(ab, bc, ca, depth + 1); return; }
    gb.tri(P3(a[0], a[1], H(a[0], a[1]) + dz), P3(b[0], b[1], H(b[0], b[1]) + dz), P3(cc[0], cc[1], H(cc[0], cc[1]) + dz), a, b, cc); };
  for (const [i, j, k] of tris) sub(all[i], all[j], all[k], 0);
}

/* ---------- terrain : maillage du relief + texture du sol (occupation du sol peinte) ---------- */
const GROUND_COL = {
  plan:{base:'#F6F4EF', grass:'#DCEBCB', wood:'#C7DEB4', scrub:'#DCE5C8', pitch:'#D3E8C7', parking:'#ECEBE7', farm:'#F3ECD3', water:'#B9D8EC', works:'#F0E3CA', rail:'#E4E1EA'},
  tex:{base:'#7A7E62', grass:'#5F7F3E', wood:'#3F5C2C', scrub:'#6C7A45', pitch:'#5E8C42', parking:'#5A5D61', farm:'#A49866', water:'#4A7590', works:'#8E7B5E', rail:'#6E6A66'},
};
let groundCanvas = null, groundTex = null, orthoTex = null, orthoState = '';
function paintGround(){
  const W = WORLD.W, S = WORLD.size, PX = Math.min(renderer.capabilities.maxTextureSize, GFX().ground, Math.max(2048, Math.round(S * 4 / 1024) * 1024)), k = PX / S, plan = planLook(), C = plan ? GROUND_COL.plan : GROUND_COL.tex;
  groundCanvas ??= document.createElement('canvas'); groundCanvas.width = groundCanvas.height = PX; const g = groundCanvas.getContext('2d');
  const X = x => (x + S / 2) * k, Y = y => (S / 2 - y) * k, R = rng(7);
  g.fillStyle = C.base; g.fillRect(0, 0, PX, PX);
  if (!plan){ // sol urbain : gazon clairsemé et terre
    for (let i = 0; i < 90000; i++){ g.globalAlpha = 0.35; g.fillStyle = shadeHex(R() < 0.6 ? '#6B7F48' : '#8A8160', (R() - 0.5) * 0.18); g.fillRect(R() * PX, R() * PX, 2 + R() * 3, 2 + R() * 3); } g.globalAlpha = 1;
  }
  const poly = (p, fill) => { g.beginPath(); p.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.closePath(); g.fillStyle = fill; g.fill(); };
  const order = ['farm', 'grass', 'pitch', 'scrub', 'wood', 'works', 'rail', 'parking'];
  if (DISPLAY.lay.areas !== false) for (const kk of order) for (const a of W.areas) if (a.k === kk){
    if (!plan && (kk === 'grass' || kk === 'pitch' || kk === 'wood' || kk === 'scrub')){ poly(a.p, C[kk]); g.save(); g.clip(); for (let i = 0; i < Math.min(30000, Math.abs(ringArea(a.p)) * k * k / 6); i++){ const c = centroid(a.p); g.fillStyle = shadeHex(C[kk], (R() - 0.5) * 0.25); g.globalAlpha = 0.6; const bx = a.p.reduce((m, q) => Math.max(m, Math.abs(q[0] - c[0])), 0), by = a.p.reduce((m, q) => Math.max(m, Math.abs(q[1] - c[1])), 0); g.fillRect(X(c[0] + (R() * 2 - 1) * bx), Y(c[1] + (R() * 2 - 1) * by), 3, 3); } g.restore(); g.globalAlpha = 1; }
    else poly(a.p, C[kk]);
    if (kk === 'parking' && !plan){ g.save(); poly(a.p, C.parking); g.clip(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, 0.12 * k); const c = centroid(a.p); for (let x = -200; x < 200; x += 2.5){ g.beginPath(); g.moveTo(X(c[0] + x), Y(c[1] - 200)); g.lineTo(X(c[0] + x), Y(c[1] + 200)); g.stroke(); } g.restore(); }
  }
  for (const w of W.water) if (!w.line) poly(w.p, C.water);
  for (const w of W.water) if (w.line){ g.strokeStyle = C.water; g.lineWidth = w.w * k; g.lineCap = 'round'; g.beginPath(); w.pts.forEach((q, i) => i ? g.lineTo(X(q[0]), Y(q[1])) : g.moveTo(X(q[0]), Y(q[1]))); g.stroke(); }
  if (plan){ // en plan : emprises des bâtiments sur le sol (lisibles même vus de dessus)
    for (const b of W.bld){ poly(b.p, '#DEDAD2'); g.strokeStyle = '#8F8A80'; g.lineWidth = 1.4; g.stroke(); }
  }
  if (!groundTex){ groundTex = new THREE.CanvasTexture(groundCanvas); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8; }
  groundTex.needsUpdate = true;
}
function loadOrtho(){ // photo aérienne IGN (BD ORTHO®), drapée sur le relief
  if (!WORLD || orthoState) return; orthoState = 'loading';
  const B = areaBounds(WORLD.P, WORLD.size), px = WORLD.size <= 500 ? 2048 : 4096;
  const tryLayer = (layers) => { const L = layers[0]; if (!L){ orthoState = 'err'; toast('Photo aérienne indisponible pour le moment.'); return; }
    const p = new URLSearchParams({SERVICE:'WMS', VERSION:'1.3.0', REQUEST:'GetMap', LAYERS:L, STYLES:'', CRS:'EPSG:4326', BBOX:`${B.s},${B.w},${B.n},${B.e}`, WIDTH:String(px), HEIGHT:String(px), FORMAT:'image/jpeg'});
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { orthoTex = new THREE.Texture(img); orthoTex.colorSpace = THREE.SRGBColorSpace; orthoTex.anisotropy = 8; orthoTex.needsUpdate = true; orthoState = 'ok'; WORLD.src.ortho = 'IGN BD ORTHO®'; if (DISPLAY.style === 'aerial') buildWorld(); };
    img.onerror = () => tryLayer(layers.slice(1)); img.src = `${WMS_R}?${p}`; };
  tryLayer(['HR.ORTHOIMAGERY.ORTHOPHOTOS', 'ORTHOIMAGERY.ORTHOPHOTOS']);
}
function buildTerrain(grp){
  const R = surfGrids(), G = R.G, F = R.F, S = WORLD.size, n = G.n, st = G.st, pos = [], uv = [], idx = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++){ const x = -S / 2 + i * st, y = -S / 2 + j * st; pos.push(x, G.z[j * n + i] - 0.02, -y); uv.push(i / (n - 1), j / (n - 1)); }
  const c0 = F ? F.c0 : -1, c1 = F ? F.c1 : -1;   // cellules du cœur : remplacées par la grille fine
  for (let j = 0; j + 1 < n; j++) for (let i = 0; i + 1 < n; i++){ if (F && i >= c0 && i < c1 && j >= c0 && j < c1) continue; const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, b, d, a, d, c); }
  if (F){ const m = F.n, base = pos.length / 3;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++){ const x = -F.h + i * F.st, y = -F.h + j * F.st; pos.push(x, F.z[j * m + i] - 0.02, -y); uv.push((x + S / 2) / S, (y + S / 2) / S); }
    for (let j = 0; j + 1 < m; j++) for (let i = 0; i + 1 < m; i++){ const a = base + j * m + i, b = a + 1, c = a + m, d = c + 1; idx.push(a, b, d, a, d, c); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : idx); g.computeVertexNormals();
  const aerial = DISPLAY.style === 'aerial' && orthoTex;
  const m = planLook() ? new THREE.MeshBasicMaterial({map:groundTex}) : new THREE.MeshStandardMaterial({map:aerial ? orthoTex : groundTex, roughness:1, metalness:0});
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.name = 'Terrain'; mesh.userData.terrain = true; grp.add(mesh);
  // jupe autour du terrain (épaisseur du sol, coupe propre en bord de zone)
  const sk = new GB(), zb = WORLD.elev.z.reduce((m, v) => v < m ? v : m, Infinity) - WORLD.z0 - 4, edge = [];
  for (let i = 0; i < n; i++) edge.push([-S / 2 + i * st, -S / 2]); for (let j = 1; j < n; j++) edge.push([S / 2, -S / 2 + j * st]); for (let i = n - 2; i >= 0; i--) edge.push([-S / 2 + i * st, S / 2]); for (let j = n - 2; j > 0; j--) edge.push([-S / 2, -S / 2 + j * st]); edge.push(edge[0]);
  for (let k = 0; k + 1 < edge.length; k++){ const a = edge[k], b = edge[k + 1]; sk.quad(P3(a[0], a[1], zb), P3(b[0], b[1], zb), P3(b[0], b[1], H(b[0], b[1]) - 0.02), P3(a[0], a[1], H(a[0], a[1]) - 0.02), [0, 0], [1, 0], [1, 1], [0, 1]); }
  const skin = new THREE.Mesh(sk.geo(), matCol(planLook() ? 0xD9D4C9 : 0x6B5A45, {rough:1, side:THREE.DoubleSide})); skin.name = 'Coupe du sol'; grp.add(skin);
  return mesh;
}

/* ---------- voirie ---------- */
const PLAN_COL = {road:0xFFFFFF, roadEdge:0x9AA0A8, foot:0xF1EEE7, side:0xE9E5DC, bld:0xF3F2EF, bldTop:0xFBFAF8, mark:0xB9BEC6};
function urbanIndex(W){ // nombre de bâtiments à moins de 30 m de chaque point (grille de 30 m) : trottoirs en ville, accotements à la campagne
  const g = new Map(); for (const b of W.bld){ const c = centroid(b.p), k = `${Math.floor(c[0] / 30)},${Math.floor(c[1] / 30)}`; g.set(k, (g.get(k) || 0) + 1); }
  return (x, y) => { let s = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) s += g.get(`${Math.floor(x / 30) + dx},${Math.floor(y / 30) + dy}`) || 0; return s; };
}
function junctionRadius(nid){
  const n = NET.nodes.get(nid); if (!n) return 0; let r = 0; for (const ri of n.ways){ const rr = NET.roads[ri]; r = Math.max(r, rr.w / 2); } return r;
}
function buildRoads(grp){
  const W = WORLD.W, plan = planLook(), urb = urbanIndex(W), dark = isDarkUI();
  const deco = [], crossAt = new Map(), realMH = (W.utils || []).filter(u => u.k === 'manhole'), nearReal = (x, y, d = 18) => realMH.some(u => Math.abs(u.x - x) < d && Math.abs(u.y - y) < d);
  for (const u of realMH){ const nr = nearestRoad([u.x, u.y], 15, false), a = nr ? Math.atan2(nr.dir[1], nr.dir[0]) : 0, onRoad = nr && nr.d < 0.3 && nr.r.drive, sub = u.sub;   // regards réels (OpenStreetMap)
    deco.push({k:/drain|storm/.test(sub) ? 'avaloir' : /telecom|telephone/.test(sub) ? 'telecom' : 'regard', x:u.x, y:u.y, a, z:onRoad ? 0.058 : 0.152}); }
  if (!plan) for (const pt of W.points) if (pt.k === 'crossing'){ const nr = nearestRoad([pt.x, pt.y], 6); if (nr && !nr.r.foot){ const c = plClosest(nr.r.pts, [pt.x, pt.y]); (crossAt.get(nr.ri) || crossAt.set(nr.ri, []).get(nr.ri)).push(c.s); } }
  const gSett = new GB(), gPaveRoad = new GB(), gConcRoad = new GB(), gRoad = new GB(), gFoot = new GB(), gPath = new GB(), gCyc = new GB(), gMark = new GB(), gGut = new GB(), gCurb = new GB(), gSide = new GB(), gEdgePlan = new GB(), gRail = new GB(), gBallast = new GB();
  const trimAt = (r, end) => { const nid = end ? r.nodes[r.nodes.length - 1] : r.nodes[0], n = NET.nodes.get(nid); return n && nodeDeg(n) >= 3 ? junctionRadius(nid) : 0; };
  for (const r of W.roads){
    if (r.tunnel) continue;
    if (r.foot){
      const surf = r.surface, gb = r.hw === 'cycleway' ? gCyc : /gravel|dirt|ground|compacted|fine_gravel|grass|unpaved/.test(surf) || r.hw === 'track' || r.hw === 'path' ? gPath : /sett|cobblestone|unhewn/.test(surf) ? gSett : gFoot;
      bandGB(gb, r.pts, -r.w / 2, r.w / 2, r.hw === 'pedestrian' ? 0.025 : 0.035); continue;
    }
    if (r.lite){ bandGB(gRoad, r.pts, -r.w / 2, r.w / 2, 0.05); continue; }   // réseau routier de grande zone : chaussée seule
    if (!plan && r.cls <= 6 && r.w >= 4.5){ const L0 = plLen(r.pts), off = (hashStr(String(r.id)) % 1000) / 1000 * 30; for (let x = 12 + off; x < L0 - 8; x += 45){ const q = plAt(r.pts, x), nn = V.perp(q.dir), lat = r.oneway ? 0.6 : 1.2; if (nearReal(q.pt[0], q.pt[1])) continue; deco.push({k:'regard', x:q.pt[0] + nn[0] * lat, y:q.pt[1] + nn[1] * lat, a:Math.atan2(q.dir[1], q.dir[0]), z:0.058}); } }
    bandGB(/sett|cobblestone|unhewn/.test(r.surface) ? gSett : /paving_stones|paving/.test(r.surface) ? gPaveRoad : /concrete/.test(r.surface) ? gConcRoad : gRoad, r.pts, -r.w / 2, r.w / 2, 0.05);   // revêtement OSM → texture de l'app
    if (plan){ bandGB(gEdgePlan, r.pts, r.w / 2, r.w / 2 + 0.35, 0.045); bandGB(gEdgePlan, r.pts, -r.w / 2 - 0.35, -r.w / 2, 0.045); }
    // marquages : axe discontinu (double sens), lignes de rive (routes principales)
    if (!plan && DISPLAY.lay.marks !== false && r.drive && !r.round && r.cls <= 6 && r.w >= 5){
      const L = plLen(r.pts), t0 = trimAt(r, false) + 6, t1 = L - trimAt(r, true) - 6;
      if (t1 - t0 > 4){
        const p = plSlice(r.pts, t0, t1);
        if (!r.oneway){ const dash = r.cls <= 3 ? 3 : 3, gap = r.cls <= 3 ? 10 : 3.5, Lp = plLen(p); for (let s = 0; s + dash <= Lp; s += dash + gap) bandGB(gMark, plSlice(p, s, s + dash), -0.06, 0.06, 0.07); }
        if (r.cls <= 3 && r.w >= 6.5){ bandGB(gMark, p, r.w / 2 - 0.35, r.w / 2 - 0.2, 0.07); bandGB(gMark, p, -r.w / 2 + 0.2, -r.w / 2 + 0.35, 0.07); }
      }
    }
    // trottoirs : caniveau 2 rangs de pavés granit, bordure granit, trottoir (en ville seulement)
    const sw = String(r.sidewalk || ''); if (DISPLAY.lay.sidewalks === false || sw === 'no' || sw === 'none' || sw === 'separate' || r.cls > 6 || r.round || r.hw === 'living_street') continue;
    const mid = plAt(r.pts, plLen(r.pts) / 2).pt; if (!sw && urb(mid[0], mid[1]) < 3) continue;
    const L = plLen(r.pts), t0 = trimAt(r, false) + 1.2, t1 = L - trimAt(r, true) - 1.2; if (t1 - t0 < 3) continue;
    const p = plSlice(r.pts, t0, t1), swW = r.cls <= 3 ? 2.6 : r.cls <= 4 ? 2 : 1.6, e = r.w / 2, Lp = plLen(p);
    // bateaux : bordure abaissée et trottoir en pente au droit des passages piétons
    const gaps = (crossAt.get(W.roads.indexOf(r)) || []).map(x => x - t0).filter(x => x > 1 && x < Lp - 1).sort((a, b) => a - b), segs = [], ramps = []; let s0 = 0;
    for (const x of gaps){ if (x - 1.8 > s0 + 0.3) segs.push([s0, x - 1.8]); ramps.push([Math.max(s0, x - 1.8), Math.min(Lp, x + 1.8)]); s0 = x + 1.8; } if (Lp - s0 > 0.3) segs.push([s0, Lp]);
    for (const side of [1, -1]){
      if (sw === 'left' && side < 0 || sw === 'right' && side > 0) continue;
      const o = x => side * x;
      if (plan){ bandGB(gSide, p, o(e + 0.3), o(e + 0.3 + swW), 0.04); continue; }
      bandGB(gGut, p, side > 0 ? e : -e - 0.3, side > 0 ? e + 0.3 : -e, 0.055, 0.055, side < 0);
      for (const [a, b] of segs){ const q = plSlice(p, a, b);
        wallGB(gCurb, q, o(e + 0.3), 0.04, 0.15, side > 0 ? -1 : 1);
        bandGB(gCurb, q, side > 0 ? e + 0.3 : -e - 0.45, side > 0 ? e + 0.45 : -e - 0.3, 0.15);
        bandGB(gSide, q, side > 0 ? e + 0.45 : -e - 0.45 - swW, side > 0 ? e + 0.45 + swW : -e - 0.45, 0.15);
        wallGB(gCurb, q, o(e + 0.45 + swW), -0.3, 0.15, side > 0 ? 1 : -1); }
      for (const [a, b] of ramps){ const q = plSlice(p, a, b);
        bandGB(gCurb, q, side > 0 ? e + 0.3 : -e - 0.45, side > 0 ? e + 0.45 : -e - 0.3, 0.07);
        if (side > 0) bandGB(gSide, q, e + 0.45, e + 0.45 + swW, 0.07, 0.15); else bandGB(gSide, q, -e - 0.45 - swW, -e - 0.45, 0.15, 0.07);
        const mid = plAt(q, plLen(q) / 2), nn = V.perp(mid.dir); deco.push({k:'podo', x:mid.pt[0] + nn[0] * o(e + 0.85), y:mid.pt[1] + nn[1] * o(e + 0.85), a:Math.atan2(mid.dir[1], mid.dir[0]), z:0.075}); }
      // avaloirs (grilles au fil d'eau), chambres télécom sur trottoir
      const off = (hashStr(r.id + '|' + side) % 1000) / 1000 * 20;
      for (let x = 8 + off; x < Lp - 4; x += 26){ if (gaps.some(g => Math.abs(g - x) < 3)) continue; const q = plAt(p, x), nn = V.perp(q.dir); if (nearReal(q.pt[0], q.pt[1], 10)) continue; deco.push({k:'avaloir', x:q.pt[0] + nn[0] * o(e + 0.17), y:q.pt[1] + nn[1] * o(e + 0.17), a:Math.atan2(q.dir[1], q.dir[0]), z:0.062}); }
      for (let x = 20 + off * 2; x < Lp - 6; x += 64){ const q = plAt(p, x), nn = V.perp(q.dir); deco.push({k:'telecom', x:q.pt[0] + nn[0] * o(e + 0.45 + swW * 0.55), y:q.pt[1] + nn[1] * o(e + 0.45 + swW * 0.55), a:Math.atan2(q.dir[1], q.dir[0]), z:0.152}); }
    }
  }
  // carrefours : disques de chaussée (comblent les jonctions)
  for (const [id, n] of NET.nodes){ if (nodeDeg(n) < 3) continue; const r = junctionRadius(id); if (r > 0) discGB(gRoad, n.xy, r * 1.02, 0.049, 20); }
  // passages piétons
  if (!plan && DISPLAY.lay.marks !== false) for (const pt of W.points) if (pt.k === 'crossing'){
    const nr = nearestRoad([pt.x, pt.y], 6); if (!nr || nr.r.foot) continue; const d = nr.dir, n = V.perp(d), w = nr.r.w - 0.6;
    for (let s = -w / 2 + 0.25; s < w / 2 - 0.25; s += 1){ const c = V.add(nr.pt, V.mul(n, s)); bandGB(gMark, [V.add(c, V.mul(d, -1.25)), V.add(c, V.mul(d, 1.25))], -0.25, 0.25, 0.075); }
  }
  // voies ferrées et tramway
  for (const rl of W.rails){ if (rl.k === 'rail'){ bandGB(gBallast, rl.pts, -1.6, 1.6, 0.04); } bandGB(gRail, rl.pts, 0.68, 0.76, 0.1); bandGB(gRail, rl.pts, -0.76, -0.68, 0.1); }
  const M = plan ? {road:matCol(PLAN_COL.road, {po:-2, basic:true}), foot:matCol(PLAN_COL.foot, {po:-1, basic:true}), side:matCol(PLAN_COL.side, {po:-1, basic:true}), edge:matCol(PLAN_COL.roadEdge, {po:-1, basic:true}), mark:matCol(PLAN_COL.mark, {po:-3, basic:true})}
    : {road:matTex('asphalt', {po:-2}), foot:matTex('pavers', {po:-1}), side:matTex('sidewalk', {po:-1}), mark:matCol(0xF2F2EE, {po:-4, rough:0.6})};
  const add = (gb, mat, name, shadow = false) => { if (gb.empty) return; const m = new THREE.Mesh(gb.geo(), mat); m.name = name; m.receiveShadow = true; m.castShadow = shadow; grp.add(m); return m; };
  add(gRoad, M.road, 'Chaussées (enrobé)'); add(gSett, plan ? M.road : matTex('cobble', {po:-2}), 'Chaussées pavées'); add(gPaveRoad, plan ? M.road : matTex('pavers', {po:-2}), 'Chaussées en dalles'); add(gConcRoad, plan ? M.road : matTex('concrete', {po:-2}), 'Chaussées béton'); add(gFoot, M.foot, 'Voies piétonnes'); add(gPath, plan ? M.foot : matTex('gravel', {po:-1}), 'Chemins'); add(gCyc, plan ? matCol(0xF3D9D2, {po:-1}) : matCol(0x8C4A3F, {po:-1, rough:0.9}), 'Pistes cyclables');
  if (plan){ // bords de chaussée : traits fins (1 pixel à toutes les échelles)
    const seg = [];
    for (const r of W.roads){ if (r.tunnel || r.foot) continue; const L = plLen(r.pts), t0 = trimAt(r, false), t1 = L - trimAt(r, true); if (t1 - t0 < 0.5) continue; const p = densify(plSlice(r.pts, t0, t1), 3);
      for (const o of [r.w / 2, -r.w / 2]){ const q = plOffset(p, o); for (let i = 0; i + 1 < q.length; i++) seg.push(q[i][0], H(q[i][0], q[i][1]) + 0.08, -q[i][1], q[i + 1][0], H(q[i + 1][0], q[i + 1][1]) + 0.08, -q[i + 1][1]); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); const ls = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0x7E8690})); ls.name = 'Bords de chaussée'; grp.add(ls); }
  add(gMark, M.mark, 'Marquages au sol');
  buildOneways(grp, plan);
  if (!plan && deco.length && DISPLAY.lay.marks !== false){ // regards, avaloirs, chambres télécom, bandes podotactiles
    const D = {regard:[0.66, 0.66, 'round'], avaloir:[0.75, 0.32, 'grid'], telecom:[1.0, 0.5, 'plate'], podo:[1.2, 0.42, 'podo']};
    for (const [k, [lx, lz, kind]] of Object.entries(D)){ const list = deco.filter(d => d.k === k); if (!list.length) continue;
      const geo = kind === 'round' ? new THREE.CylinderGeometry(lx / 2, lx / 2, 0.02, 24) : new THREE.BoxGeometry(lx, 0.02, lz), im = new THREE.InstancedMesh(geo, streetDecalMat(kind), list.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      list.forEach((d, i) => { m4.compose(new THREE.Vector3(d.x, H(d.x, d.y) + d.z, -d.y), q.setFromAxisAngle(up, d.a), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
      im.receiveShadow = true; im.name = {regard:'Regards de visite', avaloir:'Avaloirs', telecom:'Chambres télécom', podo:'Bandes podotactiles'}[k]; grp.add(im); } }
  add(gGut, plan ? M.side : matTex('gutter', {po:-2}), 'Caniveaux (2 rangs granit)');
  add(gCurb, plan ? M.edge : matTex('granite', {side:THREE.DoubleSide}), 'Bordures granit', true);
  add(gSide, M.side, 'Trottoirs');
  add(gBallast, plan ? matCol(0xD8D4CC) : matTex('gravel', {po:-1}), 'Ballast'); add(gRail, matCol(0x8A8F96, {metal:0.8, rough:0.35}), 'Rails');
}

/* sens de circulation : flèches de sens unique le long des voies, disque « sens interdit » à la sortie de chaque sens unique */
let ARROW_GEO = null, NOENTRY_GEO = null;
function buildOneways(grp, plan){
  if (DISPLAY.lay.oneway === false || (DISPLAY.lay.marks === false && !plan)) return;
  if (!ARROW_GEO){ const sh = new THREE.Shape([[-1.6, -0.22], [0.4, -0.22], [0.4, -0.55], [1.6, 0], [0.4, 0.55], [0.4, 0.22], [-1.6, 0.22]].map(q => new THREE.Vector2(q[0], q[1]))); ARROW_GEO = new THREE.ShapeGeometry(sh); ARROW_GEO.rotateX(-Math.PI / 2); }
  if (!NOENTRY_GEO){ NOENTRY_GEO = new THREE.CircleGeometry(0.9, 24); NOENTRY_GEO.rotateX(-Math.PI / 2); }
  const arrows = [], ends = [];
  for (const r of WORLD.W.roads){ if (!r.drive || !r.oneway || r.tunnel || r.pts.length < 2) continue;
    const L = plLen(r.pts), pts = r.oneway < 0 ? r.pts.slice().reverse() : r.pts, step = plan ? 34 : 22, sc = clamp(r.w / 6, 0.7, 1.4) * (plan ? 2.4 : 1);
    for (let x = Math.min(10, L / 2); x < L - 4; x += step){ const q = plAt(pts, x); arrows.push({x:q.pt[0], y:q.pt[1], a:Math.atan2(q.dir[1], q.dir[0]), s:sc}); }
    const n1 = NET.nodes.get(r.oneway < 0 ? r.nodes[0] : r.nodes[r.nodes.length - 1]); if (n1 && nodeDeg(n1) >= 2 && L > 12){ const q = plAt(pts, L - Math.min(8, L * 0.25)); ends.push({x:q.pt[0], y:q.pt[1], a:Math.atan2(q.dir[1], q.dir[0]), s:sc}); } }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const inst = (geo, mat, list, name, z) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((d, i) => { m4.compose(new THREE.Vector3(d.x, H(d.x, d.y) + z, -d.y), q.setFromAxisAngle(up, d.a), new THREE.Vector3(d.s, 1, d.s)); im.setMatrixAt(i, m4); }); im.name = name; im.renderOrder = 3; grp.add(im); return im; };
  inst(ARROW_GEO, plan ? matCol(0x1565C0, {basic:true, po:-6}) : matCol(0xF4F4F0, {rough:0.6, po:-6}), arrows, 'Sens uniques', plan ? 0.1 : 0.072);
  if (plan || DISPLAY.lay.marks !== false){ const im = inst(NOENTRY_GEO, matCol(0xC1121F, {basic:plan, po:-7}), ends, 'Sens interdits', plan ? 0.11 : 0.074);
    if (im){ const bar = new THREE.PlaneGeometry(1.2, 0.3); bar.rotateX(-Math.PI / 2); inst(bar, matCol(0xFFFFFF, {basic:plan, po:-8}), ends, 'Sens interdits (barre)', plan ? 0.12 : 0.076); } }
}
/* matériaux des équipements au sol (fonte, grilles, plaques, dalles podotactiles) */
function streetDecalMat(kind){ return MAT['deco|' + kind] ??= new THREE.MeshStandardMaterial({roughness:kind === 'podo' ? 0.8 : 0.45, metalness:kind === 'podo' ? 0 : 0.7, map:canvasTex(128, kind === 'round' ? 128 : 64, (g, w, h) => {
  if (kind === 'round'){ g.fillStyle = '#2B2D30'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4A4D51'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); g.lineWidth = 3; for (let rr = 14; rr < 54; rr += 10){ g.beginPath(); g.arc(64, 64, rr, 0, 7); g.stroke(); } for (let a = 0; a < 6.28; a += 0.524){ g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 54, 64 + Math.sin(a) * 54); g.stroke(); } }
  else if (kind === 'grid'){ g.fillStyle = '#1A1B1D'; g.fillRect(0, 0, w, h); g.fillStyle = '#4C4F53'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); for (let x = 0; x < w; x += 10) g.fillRect(x, 0, 4, h); }
  else if (kind === 'plate'){ g.fillStyle = '#6E7176'; g.fillRect(0, 0, w, h); g.fillStyle = '#5A5D61'; for (let y = 4; y < h; y += 8) for (let x = (y / 8 % 2) * 6; x < w; x += 12) g.fillRect(x, y, 6, 2); g.strokeStyle = '#3F4246'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); }
  else { g.fillStyle = '#D8D3C6'; g.fillRect(0, 0, w, h); g.fillStyle = '#B9B3A5'; for (let y = 6; y < h; y += 10) for (let x = 6; x < w; x += 10){ g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } } })}); }
/* ---------- bâtiments ---------- */
function obb(p){ // rectangle orienté minimal (angles des arêtes)
  let best = null;
  for (let i = 0; i < p.length; i++){
    const a = p[i], b = p[(i + 1) % p.length], d = V.norm(V.sub(b, a)), n = V.perp(d); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of p){ const u = V.dot(q, d), v = V.dot(q, n); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0); if (!best || A < best.A) best = {A, d, n, u0, u1, v0, v1};
  }
  const B = best; if (B.u1 - B.u0 < B.v1 - B.v0){ const d = B.n, n = V.mul(B.d, -1); return {A:B.A, d, n, u0:B.v0, u1:B.v1, v0:-B.u1, v1:-B.u0}; }
  return B;
}
/* typologie française d'un bâtiment, d'après la BD TOPO (usage, nature, matériaux, hauteur, étages), la surface, la densité et la région */
function bldStyle(b, i, A, urb, reg){
  const R = rng(hashStr(`${i}|${b.p[0]}`)), k = String(b.kind || ''), m = b.mat || (/brick/.test(b.wallC) ? 'brique' : ''), h = b.h || 6, dense = urb >= 10;
  let type;
  if (/Église|Eglise|Chapelle|Religieux|church|chapel|cathedral|basilica/i.test(k + ' ' + b.name)) type = 'eglise';
  else if (A < 28 || /garage|shed|hut|Annexe|carport/i.test(k)) type = 'annexe';
  else if (/Industriel|industrial|warehouse|Agricole|barn|hangar|Commercial et services|retail|commercial|supermarket|Sportif/i.test(k) && (A > 450 || h <= 9 && A > 250)) type = 'ind';
  else if (h >= 14){
    if ((m === 'pierre' || m === 'meuliere' || (!m && (reg === 'idf' || dense))) && h <= 30 && dense && R() < (reg === 'idf' ? 0.85 : 0.5)) type = 'haus';
    else if (m === 'beton' || m === 'agglo' || h > 24) type = R() < 0.65 ? 'mod' : 'recent';
    else type = m === 'brique' || reg === 'nord' && R() < 0.5 ? 'brique' : 'immeuble';
  }
  else if (h >= 7.5 && dense) type = reg === 'nord' && R() < 0.7 || m === 'brique' ? 'brique' : m === 'beton' ? (R() < 0.5 ? 'recent' : 'mod') : 'immeuble';
  else if (m === 'brique' || reg === 'nord' && R() < 0.6) type = 'brique';
  else if (m === 'pierre' || m === 'meuliere' || (reg === 'bzh' && !dense && R() < 0.45)) type = urb < 4 || reg === 'bzh' ? 'pierre' : 'pav';
  else if (m === 'beton' && h > 6) type = 'recent';
  else type = 'pav';
  let roofM = b.roofM || (b.roofC && /grey|gray|#[45]/.test(b.roofC) ? 'ardoises' : '');
  if (!roofM) roofM = type === 'haus' ? 'zinc' : type === 'ind' ? 'bac' : type === 'mod' || type === 'recent' ? 'beton'
    : reg === 'bzh' ? 'ardoises' : reg === 'idf' ? (type === 'pav' ? 'tuiles' : R() < 0.5 ? 'ardoises' : 'zinc') : reg === 'nord' ? (R() < 0.6 ? 'tuiles' : 'ardoises') : type === 'eglise' ? 'ardoises' : 'tuiles';
  return {kind:type, type, seed:Math.floor(R() * 4), R, roofM, reg};
}
/* contour rentré de d mètres (bissectrices), pour les combles à la Mansart */
function insetRing(p, d){ const n = p.length, out = [];
  for (let i = 0; i < n; i++){ const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], e1 = V.norm(V.sub(b, a)), e2 = V.norm(V.sub(c, b)), n1 = [-e1[1], e1[0]], n2 = [-e2[1], e2[0]], bis = V.norm(V.add(n1, n2)), k = Math.max(0.35, V.dot(bis, n1)); out.push(V.add(b, V.mul(bis, d / k))); }
  return out; }
function buildBuildings(grp){
  const W = WORLD.W, plan = planLook(), groups = new Map(), gb = key => groups.get(key) || groups.set(key, new GB()).get(key);
  const reg = frRegion(WORLD.P.lat0, WORLD.P.lon0), urbI = urbanIndex(W), roofDefault = reg === 'bzh' ? 'ardoises' : 'tuiles';
  const farGB = new GB();   /* façades simplifiées : un quadrilatère par mur, dessinées au loin à la place des façades détaillées */
  W.bld.forEach((b, bi) => {
    const p = ringArea(b.p) < 0 ? b.p.slice().reverse() : b.p, n = p.length, c0 = centroid(p), st = bldStyle(b, bi, Math.abs(ringArea(p)), urbI(c0[0], c0[1]), reg);
    const zs = p.map(q => H(q[0], q[1])), zMin = Math.min(...zs) - 0.4, zAvg = zs.reduce((a, v) => a + v, 0) / n;
    if (!plan){ const F = farGB, zt = zAvg + b.h; for (let i = 0; i < n; i++){ const q0 = p[i], q1 = p[(i + 1) % n]; F.quad(P3(q0[0], q0[1], zMin), P3(q1[0], q1[1], zMin), P3(q1[0], q1[1], zt), P3(q0[0], q0[1], zt), [0, 0], [1, 0], [1, 1], [0, 1]); } }   // murs simplifiés (vue lointaine)
    const A = Math.abs(ringArea(p)), O = obb(p), fill = A / ((O.u1 - O.u0) * (O.v1 - O.v0)), minorW = O.v1 - O.v0;
    const tag = b.roof, pitchedTag = /gabled|hipped|pyramidal|half-hipped|gambrel|saltbox|mansard|round/.test(tag), flatTag = tag === 'flat';
    let ridgeH = 0; const mans = st.type === 'haus' && b.h > 12, mansH = mans ? 2.8 : 0;
    if (!flatTag && !['haus', 'mod', 'recent', 'ind'].includes(st.type) && fill > 0.78 && n <= 12 && minorW > 3){
      if (b.ridge > 1.2) ridgeH = Math.min(b.ridge, minorW * 0.75);
      else if (pitchedTag || ['pav', 'brique', 'pierre', 'immeuble', 'eglise', 'annexe'].includes(st.type) && b.h <= 18) ridgeH = clamp(minorW * (st.type === 'eglise' ? 0.75 : st.reg === 'sud' ? 0.28 : st.reg === 'bzh' || st.reg === 'nord' ? 0.5 : 0.4), 1.2, st.type === 'eglise' ? 12 : 6);
    }
    const eave = Math.max(2.6, b.h - (b.ridge > 1.2 ? ridgeH : 0) - mansH), zTop = zAvg + eave;
    const shop = ['haus', 'immeuble', 'brique', 'mod', 'recent'].includes(st.type) && b.lv >= 3 && st.R() < (st.type === 'haus' ? 0.9 : 0.6);
    const facKey = plan ? 'plan' : `fac|${st.kind}|${st.seed}|${reg}`, shopKey = plan ? 'plan' : `shop|${st.kind}|${st.seed}|${reg}`;
    const wall = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++){ const a = ring[i], c = ring[(i + 1) % ring.length], L = V.dist(a, c); if (L < 0.05) continue;
      const z1 = shop ? zAvg + 3.4 : zMin; if (shop){ gb(shopKey).quad(P3(a[0], a[1], zMin), P3(c[0], c[1], zMin), P3(c[0], c[1], z1), P3(a[0], a[1], z1), [s / 3, (zMin - zAvg) / 3.4], [(s + L) / 3, (zMin - zAvg) / 3.4], [(s + L) / 3, 1], [s / 3, 1]); }
      gb(facKey).quad(P3(a[0], a[1], z1), P3(c[0], c[1], z1), P3(c[0], c[1], zTop), P3(a[0], a[1], zTop), [s / 3, (z1 - zAvg) / 3], [(s + L) / 3, (z1 - zAvg) / 3], [(s + L) / 3, eave / 3], [s / 3, eave / 3]);
      if (!plan && L > 1.2){ const nx = (c[1] - a[1]) / L, ny = -(c[0] - a[0]) / L, o = (q, k) => [q[0] + nx * k, q[1] + ny * k];
        if (!shop && b.h > 4){ const A2 = o(a, 0.04), C2 = o(c, 0.04), zp = zAvg + 0.7; gb('plinth|x|0').quad(P3(A2[0], A2[1], zMin), P3(C2[0], C2[1], zMin), P3(C2[0], C2[1], zp), P3(A2[0], A2[1], zp), [s, 0], [s + L, 0], [s + L, 0.7], [s, 0.7]); }
        if (b.h > 7){ const CB = gb('cornice|x|0'), A3 = o(a, 0.22), C3 = o(c, 0.22), zc = zTop - (ridgeH > 0 ? 0.05 : 0.35); // bandeau de corniche
          CB.quad(P3(A3[0], A3[1], zc - 0.22), P3(C3[0], C3[1], zc - 0.22), P3(C3[0], C3[1], zc), P3(A3[0], A3[1], zc), [0, 0], [1, 0], [1, 1], [0, 1]); CB.quad(P3(a[0], a[1], zc - 0.22), P3(c[0], c[1], zc - 0.22), P3(C3[0], C3[1], zc - 0.22), P3(A3[0], A3[1], zc - 0.22), [0, 0], [1, 0], [1, 1], [0, 1]); CB.quad(P3(A3[0], A3[1], zc), P3(C3[0], C3[1], zc), P3(c[0], c[1], zc), P3(a[0], a[1], zc), [0, 0], [1, 0], [1, 1], [0, 1]); }
        if (ridgeH <= 0 && !mans && b.h > 3.5){ const CB = gb('cornice|x|0'), I = o(a, -0.25), J = o(c, -0.25), zp = zTop + 0.7; // acrotère
          CB.quad(P3(a[0], a[1], zTop), P3(c[0], c[1], zTop), P3(c[0], c[1], zp), P3(a[0], a[1], zp), [0, 0], [1, 0], [1, 1], [0, 1]); CB.quad(P3(J[0], J[1], zTop), P3(I[0], I[1], zTop), P3(I[0], I[1], zp), P3(J[0], J[1], zp), [0, 0], [1, 0], [1, 1], [0, 1]); CB.quad(P3(a[0], a[1], zp), P3(c[0], c[1], zp), P3(J[0], J[1], zp), P3(I[0], I[1], zp), [0, 0], [1, 0], [1, 1], [0, 1]); } }
      s += L; } };
    wall(p); (b.holes || []).forEach(h => wall(ringArea(h) > 0 ? h.slice().reverse() : h));
    const roofKey = plan ? 'planTop' : (st.roofM || roofDefault) === 'ardoises' ? 'roofSlate' : st.roofM === 'zinc' || st.roofM === 'bac' ? 'roofZinc' : st.roofM === 'beton' || st.roofM === 'verre' ? 'roofFlat' : 'roofTiles';
    if (mans){ // comble à la Mansart : brisis en zinc à 70°, terrasson, lucarnes
      const inn = insetRing(p, 1.0), zM = zTop + mansH, Z = gb(plan ? 'planTop' : 'roofZinc'), L2 = gb(plan ? 'planTop' : 'cornice|x|0');
      for (let i = 0; i < n; i++){ const a = p[i], c = p[(i + 1) % n], ai = inn[i], ci = inn[(i + 1) % n], Lw = V.dist(a, c); Z.quad(P3(a[0], a[1], zTop), P3(c[0], c[1], zTop), P3(ci[0], ci[1], zM), P3(ai[0], ai[1], zM), [0, 0], [Lw, 0], [Lw, 3], [0, 3]);
        if (!plan && Lw > 4) for (let t = 2.2; t < Lw - 1.6; t += 3){ const q = V.lerp(a, c, t / Lw), qi = V.lerp(ai, ci, t / Lw), dir = V.norm(V.sub(c, a)), m0 = V.lerp(q, qi, 0.35), w0 = V.add(m0, V.mul(dir, -0.55)), w1 = V.add(m0, V.mul(dir, 0.55)), zb = zTop + mansH * 0.35, zt = zTop + mansH * 0.9;
          L2.quad(P3(w0[0], w0[1], zb), P3(w1[0], w1[1], zb), P3(w1[0], w1[1], zt), P3(w0[0], w0[1], zt), [0, 0], [1, 0], [1, 1], [0, 1]); const gq = gb('glassD|x|0'), g0 = V.add(V.lerp(w0, w1, 0.18), V.mul(V.sub(q, qi), 0.02)), g1 = V.add(V.lerp(w0, w1, 0.82), V.mul(V.sub(q, qi), 0.02)); gq.quad(P3(g0[0], g0[1], zb + 0.12), P3(g1[0], g1[1], zb + 0.12), P3(g1[0], g1[1], zt - 0.12), P3(g0[0], g0[1], zt - 0.12), [0, 0], [1, 0], [1, 1], [0, 1]); } }
      const tris = THREE.ShapeUtils.triangulateShape(inn.map(q => new THREE.Vector2(q[0], q[1])), []), T = gb(plan ? 'planTop' : 'roofFlat'); for (const [i, j, k] of tris){ const a = inn[i], bb = inn[j], c = inn[k]; T.tri(P3(a[0], a[1], zM), P3(bb[0], bb[1], zM), P3(c[0], c[1], zM), a, bb, c); }
    } else
    if (ridgeH > 0){
      // toit à 2 ou 4 pans sur le rectangle orienté (débord 0,3 m)
      const ov = 0.3, d = O.d, nn = O.n, u0 = O.u0 - ov, u1 = O.u1 + ov, v0 = O.v0 - ov, v1 = O.v1 + ov, vm = (O.v0 + O.v1) / 2, hip = /hipped|pyramidal/.test(tag) || (!tag && (O.u1 - O.u0) < minorW * 1.6 && st.R() < 0.6);
      const pt = (u, v) => V.add(V.mul(d, u), V.mul(nn, v)), zr = zTop + ridgeH, zE = zTop - ov * ridgeH / (minorW / 2);
      const ru0 = hip ? O.u0 + minorW / 2 : u0, ru1 = hip ? O.u1 - minorW / 2 : u1;
      const c00 = pt(u0, v0), c10 = pt(u1, v0), c11 = pt(u1, v1), c01 = pt(u0, v1), r0 = pt(Math.min(ru0, (u0 + u1) / 2), vm), r1 = pt(Math.max(ru1, (u0 + u1) / 2), vm);
      const R = gb(roofKey), q = (a, za) => P3(a[0], a[1], za), slope = Math.hypot(minorW / 2 + ov, ridgeH);
      R.quad(q(c00, zE), q(c10, zE), q(r1, zr), q(r0, zr), [u0, 0], [u1, 0], [u1, slope], [u0, slope]);
      R.quad(q(c11, zE), q(c01, zE), q(r0, zr), q(r1, zr), [u1, 0], [u0, 0], [u0, slope], [u1, slope]);
      if (hip){ R.tri(q(c10, zE), q(c11, zE), q(r1, zr), [v0, 0], [v1, 0], [vm, slope]); R.tri(q(c01, zE), q(c00, zE), q(r0, zr), [v1, 0], [v0, 0], [vm, slope]); }
      else { // pignons (maçonnés)
        const F = gb(facKey), g0 = pt(O.u0, O.v0), g1 = pt(O.u0, O.v1), gr0 = pt(O.u0, vm), h0 = pt(O.u1, O.v1), h1 = pt(O.u1, O.v0), hr = pt(O.u1, vm);
        F.tri(q(g1, zTop), q(g0, zTop), q(gr0, zr - 0.05), [0, eave / 3], [minorW / 3, eave / 3], [minorW / 6, (eave + ridgeH) / 3]);
        F.tri(q(h1, zTop), q(h0, zTop), q(hr, zr - 0.05), [0, eave / 3], [minorW / 3, eave / 3], [minorW / 6, (eave + ridgeH) / 3]);
      }
      // dessous de toit (évite de voir à travers sous les débords)
      const U = gb(plan ? 'planTop' : 'roofFlat'); U.quad(q(c00, zE - 0.02), q(c01, zE - 0.02), q(c11, zE - 0.02), q(c10, zE - 0.02), [0, 0], [0, 1], [1, 1], [1, 0]);
    } else {
      // toit-terrasse (avec les cours intérieures)
      const holes = (b.holes || []).map(h => ringArea(h) > 0 ? h.slice().reverse() : h);
      const tris = THREE.ShapeUtils.triangulateShape(p.map(q => new THREE.Vector2(q[0], q[1])), holes.map(h => h.map(q => new THREE.Vector2(q[0], q[1])))), all = [...p, ...holes.flat()];
      const key = plan ? 'planTop' : st.roofM === 'zinc' ? 'roofZinc' : 'roofFlat', R = gb(key);
      for (const [i, j, k] of tris){ const a = all[i], bb = all[j], c = all[k]; R.tri(P3(a[0], a[1], zTop), P3(bb[0], bb[1], zTop), P3(c[0], c[1], zTop), a, bb, c); }
    }
  });
  if (!farGB.empty){ const fm = new THREE.Mesh(farGB.geo(), matCol(0xD8CDBB, {rough:0.95})); fm.name = 'Façades (vue lointaine)'; fm.receiveShadow = true; fm.userData.bld = true; grp.add(fm); }
  const mats = {plan:matCol(PLAN_COL.bld, {rough:1, side:THREE.DoubleSide}), planTop:matCol(PLAN_COL.bldTop, {rough:1, side:THREE.DoubleSide}), roofTiles:matTex('roofTiles', {rough:0.85, side:THREE.DoubleSide}), roofSlate:matTex('roofSlate', {rough:0.7, side:THREE.DoubleSide}), roofZinc:matTex('roofZinc', {rough:0.5, side:THREE.DoubleSide}), roofFlat:matTex('roofFlat', {side:THREE.DoubleSide})};
  for (const [key, g] of groups){
    let m = mats[key];
    if (!m){ const [k, kind, seed] = key.split('|'); const rg = key.split('|')[3]; m = k === 'plinth' ? matTex('granite', {rough:0.8}) : k === 'cornice' ? matCol(0xE4DDD0, {rough:0.85}) : k === 'glassD' ? VM.glass : facadeMat(kind, +seed, k === 'shop', rg); }
    const mesh = new THREE.Mesh(g.geo(), m); mesh.castShadow = !plan; mesh.receiveShadow = true; mesh.name = /^(fac|shop|plinth|cornice)/.test(key) ? 'Façades' : key.startsWith('roof') ? 'Toitures' : 'Bâtiments'; mesh.userData.bld = true; grp.add(mesh);
  }
}

/* ---------- arbres, murs et haies, mobilier urbain ---------- */
function crownGeo(seed, detail = 2){
  const g0 = new THREE.IcosahedronGeometry(1, detail); g0.deleteAttribute('normal'); g0.deleteAttribute('uv'); const g = mergeVertices(g0), a = g.attributes.position, R = rng(seed), col = [];
  for (let i = 0; i < a.count; i++){ const x = a.getX(i), y = a.getY(i), z = a.getZ(i), k = 0.82 + R() * 0.3 + 0.1 * Math.sin(x * 3 + seed) * Math.cos(z * 3); a.setXYZ(i, x * k, y * k * 0.92, z * k); const c = new THREE.Color().setHSL(0.27 + R() * 0.05, 0.42 + R() * 0.15, 0.24 + R() * 0.1 + y * 0.05); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function buildTrees(grp){
  const W = WORLD.W, R = rng(99), list = W.trees.map(t => ({...t})), S = WORLD.size / 2;
  // boisements et parcs : arbres plantés (densité réaliste, reproductible)
  for (const a of W.areas){ if (!/wood|grass|scrub/.test(a.k)) continue; const A = Math.abs(ringArea(a.p)), dens = a.k === 'wood' ? 1 / 55 : a.k === 'scrub' ? 1 / 160 : 1 / 260, nb = Math.min(600, Math.round(A * dens));
    const xs = a.p.map(q => q[0]), ys = a.p.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let k = 0, t = 0; k < nb && t < nb * 6; t++){ const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); if (!inPoly(x, y, a.p) || Math.abs(x) > S || Math.abs(y) > S) continue; list.push({x, y, h:a.k === 'scrub' ? 3 + R() * 2 : 8 + R() * 10, k:a.k === 'wood' && R() < 0.15 ? 'c' : 'f'}); k++; } }
  if (!list.length) return;
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 6); trunkG.translate(0, 0.5, 0);
  const crowns = [crownGeo(1, 3), crownGeo(2, 3), crownGeo(3, 2)], coneG = (() => { const g = new THREE.ConeGeometry(1, 1, 8, 3); g.translate(0, 0.5, 0); const a = g.attributes.position, col = []; for (let i = 0; i < a.count; i++){ const c = new THREE.Color().setHSL(0.33, 0.35, 0.18 + a.getY(i) * 0.08); col.push(c.r, c.g, c.b); } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; })();
  const plan = planLook(), trunkM = matCol(plan ? 0xB9C9A8 : 0x5E4A38, {rough:1}), crownM = plan ? matCol(0xA9CB8C, {basic:true, opacity:0.8, depthWrite:false}) : new THREE.MeshStandardMaterial({vertexColors:true, roughness:0.95, flatShading:false});
  const trunks = new THREE.InstancedMesh(trunkG, trunkM, list.length), cr = [0, 1, 2].map(i => new THREE.InstancedMesh(crowns[i], crownM, list.length)), cones = new THREE.InstancedMesh(coneG, crownM, list.length);
  const cnt = [0, 0, 0], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); let nc = 0, nt = 0;
  for (const t of list){
    const h = t.h > 0 ? clamp(t.h, 3, 30) : 7 + R() * 7, z = H(t.x, t.y), th = t.k === 'c' ? h * 0.18 : h * 0.4;
    m4.compose(new THREE.Vector3(t.x, z, -t.y), q.identity(), new THREE.Vector3(h / 9, th, h / 9)); trunks.setMatrixAt(nt++, m4);
    if (t.k === 'c'){ m4.compose(new THREE.Vector3(t.x, z + th * 0.8, -t.y), q.identity(), new THREE.Vector3(h * 0.22, h * 0.85, h * 0.22)); cones.setMatrixAt(nc++, m4); }
    else { const v = Math.floor(R() * 3), r = h * (0.28 + R() * 0.08); e.set(0, R() * 6.28, 0); m4.compose(new THREE.Vector3(t.x, z + th + r * 0.75, -t.y), q.setFromEuler(e), new THREE.Vector3(r, r * 1.05, r)); cr[v].setMatrixAt(cnt[v]++, m4); }
  }
  trunks.count = nt; cones.count = nc; cr.forEach((m, i) => m.count = cnt[i]);
  for (const m of [trunks, cones, ...cr]){ m.castShadow = !plan; m.receiveShadow = true; m.name = m === trunks ? 'Troncs' : 'Arbres'; m.userData.tree = true; m.frustumCulled = false; grp.add(m); }
}
function buildWalls(grp){
  const W = WORLD.W, gWall = new GB(), gHedge = new GB(), gFence = new GB();
  for (const w of W.walls){ const gb = w.k === 'hedge' ? gHedge : w.k === 'fence' ? gFence : gWall, t = w.k === 'hedge' ? 0.5 : w.k === 'fence' ? 0.04 : 0.22, h = clamp(w.h, 0.5, 4);
    wallGB(gb, w.pts, t / 2, -0.2, h, 1); wallGB(gb, w.pts, -t / 2, -0.2, h, -1); bandGB(gb, w.pts, -t / 2, t / 2, h); }
  const add = (gb, m, n) => { if (gb.empty) return; const mesh = new THREE.Mesh(gb.geo(), m); mesh.name = n; mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); };
  add(gWall, matCol(0xC9BFAE, {rough:0.95}), 'Murs'); add(gHedge, matCol(0x4C6B33, {rough:1}), 'Haies'); add(gFence, matCol(0x3B4148, {metal:0.4, rough:0.6, opacity:0.75}), 'Clôtures');
}
function buildFurniture(grp){
  const W = WORLD.W; if (DISPLAY.lay.lamps === false) return;
  const lamps = W.points.filter(p => p.k === 'street_lamp');
  if (lamps.length){
    const pole = new THREE.CylinderGeometry(0.06, 0.09, 6, 6); pole.translate(0, 3, 0); const head = new THREE.BoxGeometry(0.7, 0.14, 0.28); head.translate(0.3, 6, 0);
    const g = mergeGeometries([pole.toNonIndexed(), head.toNonIndexed()]); const im = new THREE.InstancedMesh(g, matCol(0x4A5058, {metal:0.6, rough:0.5}), lamps.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    lamps.forEach((l, i) => { const nr = nearestRoad([l.x, l.y], 15); const a = nr ? Math.atan2(nr.pt[1] - l.y, nr.pt[0] - l.x) : 0; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a); m4.compose(new THREE.Vector3(l.x, H(l.x, l.y), -l.y), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.name = 'Lampadaires'; grp.add(im);
  }
  buildSignals(grp);
}
/* noms des rues (étiquettes à l'écran) */
function buildStreetLabels(){
  // une étiquette par tronçon assez long, sans répéter le même nom à moins de 140 m
  const W = WORLD.W, cand = [], out = [], S = WORLD.size / 2 + 10;
  for (const r of W.roads){ if (!r.name || r.foot && r.hw !== 'pedestrian' || r.tunnel) continue; const L = plLen(r.pts); if (L < 25) continue; const a = plAt(r.pts, L / 2); if (Math.abs(a.pt[0]) > S || Math.abs(a.pt[1]) > S) continue; cand.push({name:r.name, xy:a.pt, dir:a.dir, L, cls:r.cls}); }
  cand.sort((a, b) => a.cls - b.cls || b.L - a.L);
  for (const c of cand){ if (out.length > 400) break; if (out.some(o => o.name === c.name && V.dist(o.xy, c.xy) < 140)) continue; out.push(c); }
  WORLD.labels = out;
}
/* ---------- reconstruction complète du site ---------- */
function disposeGroup(g){ g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); g.clear(); }
/* ============ Découpage en tuiles et niveaux de détail ============
   Chaque couche (chaussées, façades, bordures…) était un seul maillage couvrant toute la zone : sur 20 km, la carte
   graphique dessinait toute la ville à chaque image (et une 2e fois pour les ombres), même hors champ. On découpe les
   gros maillages en tuiles de 400 m (la caméra ne dessine que les tuiles visibles) et on masque les petits détails
   au loin (bordures, regards, trottoirs… au-delà de ~1 km ; façades détaillées au-delà de 3 km). */
const TILE = 800; let WTILES = [];
const FAR_FAC = 1500;   // au-delà : façades simplifiées
const lodMinOf = name => /vue lointaine/.test(name) ? FAR_FAC : 0;
const lodOf = name => /vue lointaine/.test(name) ? Infinity : /^Façades$/.test(name) ? FAR_FAC + 250 : /Bordure|Caniveau|Regard|Avaloir|Chambre|podotact|Bande|Passage|Marquage|Trottoir|Voies piétonnes|Potelet|Banc|Poubelle|Mobilier|Troncs|Lampadaire|Feux|Mur|Haie|Clôture/i.test(name) ? 1100 : /Arbre|Fenêtre|Vitrine|Corniche|Soubassement/i.test(name) ? 3200 : Infinity;
const tileKey = (x, z) => Math.floor(x / TILE) + ',' + Math.floor(z / TILE);   // (essai de grandes tuiles hors du cœur : plus lent, car moins bien écartées hors champ)
function tileWorld(grp){
  WTILES = [];
  for (const m of [...grp.children]){
    if (!m.isMesh || m.userData.terrain || m.userData.noTile) continue;
    const lod = lodOf(m.name || '');
    if (m.isInstancedMesh){
      if (m.count < 1500){ if (lod < Infinity){ m.geometry.computeBoundingSphere(); } continue; }
      const buckets = new Map(), M = new THREE.Matrix4(), P = new THREE.Vector3(), C = new THREE.Color();
      for (let i = 0; i < m.count; i++){ m.getMatrixAt(i, M); P.setFromMatrixPosition(M); const k = tileKey(P.x, P.z); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); }
      if (buckets.size < 2) continue;
      for (const [k, ids] of buckets){ const t = new THREE.InstancedMesh(m.geometry, m.material, ids.length); t.name = m.name; t.castShadow = m.castShadow; t.receiveShadow = m.receiveShadow; t.userData = {...m.userData};
        ids.forEach((i, j) => { m.getMatrixAt(i, M); t.setMatrixAt(j, M); if (m.instanceColor){ m.getColorAt(i, C); t.setColorAt(j, C); } });
        t.computeBoundingSphere(); t.userData.lod = lod; grp.add(t); WTILES.push(t); }
      grp.remove(m); continue;   // la géométrie est partagée par les tuiles : on ne la libère pas
    }
    const g = m.geometry, pos = g.attributes.position; if (g.index || pos.count < 120000) { const l0 = lodMinOf(m.name || ''); if (lod < Infinity || l0){ g.computeBoundingSphere(); m.userData.lod = lod; m.userData.lodMin = l0; WTILES.push(m); } continue; }
    const uv = g.attributes.uv, nor = g.attributes.normal, buckets = new Map(), A = pos.array;
    for (let t = 0; t < pos.count; t += 3){ const cx = (A[t * 3] + A[t * 3 + 3] + A[t * 3 + 6]) / 3, cz = (A[t * 3 + 2] + A[t * 3 + 5] + A[t * 3 + 8]) / 3, k = tileKey(cx, cz); (buckets.get(k) || buckets.set(k, []).get(k)).push(t); }
    if (buckets.size < 2) continue;
    for (const [, tris] of buckets){
      const n = tris.length * 3, gp = new Float32Array(n * 3), gn = nor ? new Float32Array(n * 3) : null, gu = uv ? new Float32Array(n * 2) : null; let o = 0;
      for (const t of tris) for (let v = 0; v < 3; v++, o++){ const i = t + v; gp.set(A.subarray(i * 3, i * 3 + 3), o * 3); if (gn) gn.set(nor.array.subarray(i * 3, i * 3 + 3), o * 3); if (gu) gu.set(uv.array.subarray(i * 2, i * 2 + 2), o * 2); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); if (gn) tg.setAttribute('normal', new THREE.BufferAttribute(gn, 3)); if (gu) tg.setAttribute('uv', new THREE.BufferAttribute(gu, 2)); tg.computeBoundingSphere();
      const tm = new THREE.Mesh(tg, m.material); tm.name = m.name; tm.castShadow = m.castShadow; tm.receiveShadow = m.receiveShadow; tm.renderOrder = m.renderOrder; tm.userData = {...m.userData, lod, lodMin:lodMinOf(m.name || '')}; grp.add(tm); WTILES.push(tm);
    }
    grp.remove(m); g.dispose();
  }
}
/* niveaux de détail : appelé avant chaque rendu ; masque les tuiles de détail trop loin de la caméra */
const _lc = new THREE.Vector3();
function updateLOD(){
  const c = cam(); if (!c) return; _lc.copy(c.position);
  /* brouillard et plan lointain suivent la hauteur de vue : près du sol on ne dessine pas la ville à 15 km (cachée par le
     brouillard de toute façon) ; en vue d'ensemble, on voit tout */
  if (c === persp && WORLD){ const d = persp.position.distanceTo(c3.target), far = clamp(d * 5 + 1800, 2600, Math.max(2600, FOGR[1]));
    if (Math.abs(far - (persp.userData.fogFar || 0)) > far * 0.04){ persp.userData.fogFar = far; persp.far = far * 1.03; persp.updateProjectionMatrix();
      if (scene.fog){ const night = !!DISPLAY.night; scene.fog.far = far * (night ? 0.8 : 1); scene.fog.near = far * (night ? 0.21 : 0.35); } } }
  /* objets du chantier (panneaux, barrières, cônes…) : au-delà de ~450 m ils ne font que quelques pixels et la bulle
     les remplace ; on ne les dessine plus (des centaines d'objets = des milliers d'appels de dessin) */
  { const far2d = view === '2d' && mPerPx() > 1.2, R2 = 450 * 450;
    for (const o of projCache.values()){ if (!o.small) continue; const v = o.base && !far2d && (view === '2d' || (o.x - _lc.x) ** 2 + (o.y + _lc.z) ** 2 < R2); if (o.grp.visible !== v) o.grp.visible = v; } }
  if (!WTILES.length) return;
  const ortho2d = view === '2d', k = ortho2d ? mPerPx() * 900 : 0;   // en vue de dessus : selon l'échelle (m par pixel)
  for (const t of WTILES){ const sp = t.isInstancedMesh ? t.boundingSphere : t.geometry.boundingSphere; if (!sp) continue; const L = t.userData.lod, L0 = t.userData.lodMin || 0; if (L === Infinity && !L0) continue;
    const d = ortho2d ? k : _lc.distanceTo(sp.center) - sp.radius; const dc = ortho2d ? k : _lc.distanceTo(sp.center); t.visible = L0 ? dc >= L0 : (/^Façades$/.test(t.name) ? dc < FAR_FAC : d < L); }
}
function buildWorld(){
  disposeGroup(worldGroup); if (!WORLD) { dirty = true; return; }
  const t0 = performance.now();
  paintGround(); buildTerrain(worldGroup);
  if (DISPLAY.style === 'aerial' && !orthoTex) loadOrtho();
  if (DISPLAY.style !== 'aerial') buildRoads(worldGroup); else { const g = new THREE.Group(); buildRoads(g); g.children.forEach(m => { if (m.name === 'Marquages au sol') worldGroup.add(m); else m.geometry.dispose(); }); }
  if (DISPLAY.lay.bld !== false && !(planLook() && view === '2d')) buildBuildings(worldGroup);   // en plan : emprises dessinées au sol
  if (DISPLAY.lay.trees !== false) buildTrees(worldGroup);
  if (DISPLAY.lay.walls !== false && !planLook()) buildWalls(worldGroup);
  if (!planLook()){ buildFurniture(worldGroup); if (DISPLAY.lay.lamps !== false) buildUtilities(worldGroup); }
  if (DISPLAY.lay.nets){ buildNetworks(worldGroup); applyCutaway(worldGroup); } else NETBUILT.types.clear();
  buildStreetLabels();
  tileWorld(worldGroup); applyNight(); worldGroup.userData.ms = Math.round(performance.now() - t0);
  dirty = true;
}
TEX_LISTENERS.add(() => { dirty = true; });
