/* ============ Véhicules et engins (sans marque) ============
   Modèles procéduraux dessinés pour ARCHITRAFIC (aucun fichier tiers, aucun logo) : carrosseries « lissées » par sections
   successives (profil latéral, vue en plan, galbe), vitrages, arches de roues, pneus à flancs, jantes à branches, feux.
   Deux niveaux de détail : complet (bibliothèque, éléments posés) et allégé (lod = 1, simulation de centaines de véhicules).
   Repère : +x vers l'avant, +y vers le haut, +z côté droit ; origine au sol, au milieu du véhicule. Dimensions réelles moyennes. */
const BODY_COLORS = [0xE9ECEF, 0xF5F5F3, 0x1E1F22, 0x8D949B, 0x4E555D, 0xB3B8BD, 0x1F3F73, 0x8E1B1B, 0x2F5E3B, 0xC9C2B4, 0x5A3E2B, 0x2C6EAF, 0xD7D0C2, 0x6B7178, 0xA61E22];
const VM = {
  glass:matCol(0x1B242C, {rough:0.05, metal:0.85}), trim:matCol(0x15171A, {rough:0.7}), plastic:matCol(0x2A2D31, {rough:0.6}), chrome:matCol(0xD5DADF, {rough:0.15, metal:1}),
  rubber:matCol(0x161718, {rough:0.92, side:THREE.DoubleSide}), rim:matCol(0xB9BFC5, {rough:0.25, metal:0.9}), rimDark:matCol(0x3A3E44, {rough:0.4, metal:0.6}),
  head:matCol(0xF4F7FA, {rough:0.1, metal:0.3, emissive:0xFFFFFF, ei:0.35}), tail:matCol(0xA3141C, {rough:0.2, emissive:0x7A0008, ei:0.45}), ind:matCol(0xE87A10, {rough:0.25, emissive:0x803800, ei:0.3}),
  plate:null, steel:matCol(0x5B6168, {rough:0.45, metal:0.75}), dark:matCol(0x2B2E33, {rough:0.6, metal:0.2}), eng:matCol(0xE8AE0C, {rough:0.42, metal:0.15}),
  engDark:matCol(0x26292D, {rough:0.55, metal:0.3}), bucket:matCol(0x3B3F45, {rough:0.5, metal:0.5}), drum:matCol(0x8A9097, {rough:0.35, metal:0.8}), alu:matCol(0xC8CDD2, {rough:0.35, metal:0.7}),
  white:matCol(0xF2F3F1, {rough:0.4, metal:0.1}), seat:matCol(0x2C2F33, {rough:0.9}), deck:matCol(0x8C6A45, {rough:0.9}),
};
function plateMat(){ return VM.plate ??= new THREE.MeshStandardMaterial({roughness:0.4, map:canvasTex(256, 56, (g, w, h) => { // plaque française générique (numéro fictif)
  g.fillStyle = '#F7F7F5'; g.fillRect(0, 0, w, h); g.fillStyle = '#1F4FA3'; g.fillRect(0, 0, 22, h); g.fillRect(w - 22, 0, 22, h); g.fillStyle = '#FFD200'; g.font = 'bold 9px Arial'; g.textAlign = 'center'; g.fillText('F', 11, h - 8);
  g.fillStyle = '#16181B'; g.font = 'bold 34px Arial'; g.textBaseline = 'middle'; g.fillText('AT-000-SP', w / 2, h / 2 + 2); g.strokeStyle = '#16181B'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); })}); }
function bodyMat(c){ const key = 'body|' + c; if (MAT[key]) return MAT[key]; const m = new THREE.MeshPhysicalMaterial({color:c, roughness:0.38, metalness:0.45, clearcoat:0.7, clearcoatRoughness:0.12}); m.userData.body = true; return MAT[key] = m; }
const P = (m, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => part(geo, m, x, y, z, rx, ry, rz);
/* profil latéral (x, y) extrudé en largeur (z), centré */
function profileExtrude(pts, width, bevel = 0.07){
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(s, {depth:Math.max(0.02, width - 2 * bevel), bevelEnabled:bevel > 0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:3, curveSegments:6});
  g.translate(0, 0, -(width - 2 * bevel) / 2); return g;
}
const RB = (l, h, w, r = 0.04, seg = 2) => new RoundedBoxGeometry(l, h, w, seg, Math.max(0.002, Math.min(r, l / 2.05, h / 2.05, w / 2.05)));

/* ---------- interpolation lisse (Hermite monotone) ---------- */
function curve(keys){
  const n = keys.length, xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / ((xs[i + 1] - xs[i]) || 1e-6));
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  m[0] = d[0] ?? 0; m[n - 1] = d[n - 2] ?? 0;
  for (let i = 0; i < n - 1; i++){ if (!d[i]){ m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9){ const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  const f = x => { if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1]; let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t; return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]; };
  f.slope = x => (f(x + 0.02) - f(x - 0.02)) / 0.04; return f;
}
/* arche de roue : relève le bas de caisse au droit des roues */
function archBottom(base, wheelsX, r, gap = 0.07){ const R = r + gap; const f = x => { let z = base(x); for (const xc of wheelsX){ const dx = Math.abs(x - xc); if (dx < R) z = Math.max(z, r + Math.sqrt(R * R - dx * dx)); } return z; }; return f; }
/* sous-géométrie compacte (une par matériau) */
function subGeo(pos, nor, uv, idx){
  const map = new Map(), P2 = [], N2 = [], U2 = [], I = [];
  for (const v of idx){ let k = map.get(v); if (k === undefined){ k = P2.length / 3; map.set(v, k); P2.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); N2.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]); U2.push(uv[v * 2], uv[v * 2 + 1]); } I.push(k); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); g.setIndex(I); return g;
}
/* ---------- carrosserie lissée ----------
   sp : L (longueur), top(x), belt(x), bot(x), hw(x) demi-largeur (x de 0 = arrière à L = avant), tumble (rentrée des vitres), rb/rt (rayons bas/haut),
        glass(x, kind, side, z, gh) → 'glass' | null  (kind : 'side' vitres latérales, 'top' pare-brise / lunette),
        paint(x, zone, side, z) → matériau particulier, sill (hauteur du bas de caisse noir), capF / capR (matériau des faces avant / arrière). */
function loftBody(sp, bodyM, lod = 0){
  const L = sp.L, NX = lod ? 16 : 52, AR = lod ? 2 : 4, xs = [];
  for (let i = 0; i <= NX; i++){ const t = i / NX; xs.push(L * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI) * 0.55)); }
  const half = x => {
    const zt = sp.top(x), zb = sp.bot(x), hw = sp.hw(x), gh0 = zt - sp.belt(x);
    const tum = (sp.tumble ?? 0.15) * clamp(gh0 / 0.3, 0, 1), rw = Math.max(0.05, hw - tum - (sp.roofIn ?? 0.015));
    const rt = clamp(Math.min(sp.rt ?? 0.11, gh0 > 0.06 ? gh0 * 0.45 : (zt - zb) * 0.32, rw * 0.6), 0.01, 1), zbelt = Math.min(sp.belt(x), zt - rt - 0.005), rb = clamp(Math.min(sp.rb ?? 0.09, (zbelt - zb) * 0.45, hw * 0.4), 0.005, 1);
    const P = [[0, zb]];
    for (let k = 0; k <= AR; k++){ const a = -Math.PI / 2 + k / AR * Math.PI / 2; P.push([hw - rb + Math.cos(a) * rb, zb + rb + Math.sin(a) * rb]); }
    P.push([hw, zbelt]); P.push([(hw + rw) / 2 + 0.004, (zbelt + zt - rt) / 2]);
    for (let k = 0; k <= AR; k++){ const a = k / AR * Math.PI / 2; P.push([rw - rt + Math.cos(a) * rt, zt - rt + Math.sin(a) * rt]); }
    P.push([0, zt]); return {P, gh:zt - zbelt, zt, zb};
  };
  const H0 = AR * 2 + 6, iBelt = AR + 2, iWin = iBelt + 1, iSh = iWin + 1, ring = [];   // gauche (z < 0) de bas en haut, puis droite (z > 0) de haut en bas
  for (let j = 0; j < H0; j++) ring.push([j, -1]); for (let j = H0 - 2; j >= 1; j--) ring.push([j, 1]);
  const RN = ring.length, pos = [], uv = [], info = [];
  xs.forEach(x => { const h = half(x); info.push(h); let s = 0, prev = null; ring.forEach(([j, side]) => { const q = h.P[j]; pos.push(x - L / 2, q[1], side * q[0]); if (prev) s += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; uv.push(x, s); }); });
  const seg = {}, add = (m, a, b, c) => (seg[m] ??= []).push(a, b, c);
  for (let i = 0; i < xs.length - 1; i++){
    const xm = (xs[i] + xs[i + 1]) / 2, gh = (info[i].gh + info[i + 1].gh) / 2, sl = Math.abs(sp.top.slope(xm));
    for (let j = 0; j < RN - 1; j++){
      const a = i * RN + j, b = i * RN + j + 1, c = (i + 1) * RN + j + 1, d = (i + 1) * RN + j, lo = Math.min(ring[j][0], ring[j + 1][0]), side = ring[j][1];
      const zmid = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1] + pos[d * 3 + 1]) / 4;
      let m = 'body';
      if (lo === iBelt || lo === iWin) m = sp.glass(xm, 'side', side, zmid, gh) || 'body';
      else if (lo > iSh && gh > 0.1 && sl > 0.28) m = sp.glass(xm, 'top', side, zmid, gh) || 'body';
      if (m === 'body' && sp.sill && lo < iBelt && zmid < sp.bot(xm) + sp.sill) m = 'trim';
      if (m === 'body' && sp.paint) m = sp.paint(xm, lo < iBelt ? 'low' : lo < iSh ? 'win' : 'top', side, zmid) || 'body';
      add(m, a, b, c); add(m, a, c, d);
    }
  }
  // faces avant et arrière (éventail)
  for (const [i, dir] of [[0, -1], [xs.length - 1, 1]]){ const c0 = pos.length / 3, h = info[i]; pos.push(xs[i] - L / 2 + dir * 0.004, (h.zt + h.zb) / 2, 0); uv.push(xs[i], 0);
    const m = (dir > 0 ? sp.capF : sp.capR) || 'body'; for (let j = 0; j < RN - 1; j++){ const a = i * RN + j, b = i * RN + j + 1; dir > 0 ? add(m, c0, a, b) : add(m, c0, b, a); } }
  const all = Object.values(seg).flat(), tmp = new THREE.BufferGeometry(); tmp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tmp.setIndex(all); tmp.computeVertexNormals();
  const nor = tmp.attributes.normal.array, g = new THREE.Group(), mats = {body:bodyM, glass:VM.glass, trim:VM.trim, dark:VM.plastic, white:VM.white, ...(sp.mats || {})};
  for (const [m, idx] of Object.entries(seg)) g.add(part(subGeo(pos, nor, uv, idx), mats[m] || bodyM));
  return g;
}
/* ---------- roues ---------- */
const WGEO = {};
function tyreGeo(r, w, seg){ const k = `ty|${r}|${w}|${seg}`; if (WGEO[k]) return WGEO[k]; const sw = w / 2, rr = r * 0.66;
  const pts = [[rr, -sw * 0.8], [r * 0.8, -sw * 0.98], [r * 0.95, -sw * 0.95], [r - 0.01, -sw * 0.78], [r, -sw * 0.45], [r, sw * 0.45], [r - 0.01, sw * 0.78], [r * 0.95, sw * 0.95], [r * 0.8, sw * 0.98], [rr, sw * 0.8]].map(p => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(pts, seg); g.rotateX(Math.PI / 2); return WGEO[k] = g; }
function rimGeo(r, spokes, seg, holes){ const k = `rim|${r}|${spokes}|${seg}|${holes}`; if (WGEO[k]) return WGEO[k];
  const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false);
  if (holes) for (let i = 0; i < spokes; i++){ const a0 = i / spokes * Math.PI * 2 + 0.22, a1 = (i + 1) / spokes * Math.PI * 2 - 0.22, h = new THREE.Path(); h.absarc(0, 0, r * 0.82, a0, a1, false); h.absarc(0, 0, r * 0.36, a1, a0, true); s.holes.push(h); }
  const g = new THREE.ExtrudeGeometry(s, {depth:0.02, bevelEnabled:true, bevelSize:0.008, bevelThickness:0.01, bevelSegments:1, curveSegments:seg}); return WGEO[k] = g; }
/* roue complète, axe z, face extérieure vers +z ; style : 'alu' (jante à branches), 'steel' (tôle), 'truck' (poids lourd), 'eng' (engin) */
function wheelAssy(r, w, style = 'alu', lod = 0){
  const g = new THREE.Group(), seg = lod ? 12 : 26;
  g.add(new THREE.Mesh(tyreGeo(r, w, seg), VM.rubber));
  const rr = r * (style === 'eng' ? 0.6 : 0.64), face = w / 2 - 0.035;
  const rimM = style === 'alu' ? VM.rim : style === 'eng' ? VM.eng : style === 'truck' ? VM.alu : VM.rimDark;
  const disc = new THREE.Mesh(rimGeo(rr, style === 'truck' ? 10 : style === 'eng' ? 8 : 5, seg, !lod && (style === 'alu' || style === 'truck')), rimM); disc.position.z = face - 0.03; g.add(disc);
  if (!lod){ g.add(part(CYL(rr * 0.98, rr * 0.98, w * 0.7, seg), VM.rimDark, 0, 0, 0, Math.PI / 2)); g.add(part(CYL(rr * 0.25, rr * 0.3, 0.05, 12), style === 'eng' ? VM.engDark : VM.chrome, 0, 0, face + 0.005, Math.PI / 2)); }
  g.traverse(o => { if (o.isMesh){ o.castShadow = true; o.receiveShadow = true; } }); return g;
}
/* pose des roues : xs (centres le long de x), track (entraxe), dual (indices des essieux à roues jumelées) */
function addWheels(g, xs, r, w, track, style, lod, dual = []){
  xs.forEach((x, i) => { for (const s of [-1, 1]){ const dd = dual.includes(i) ? [-(w * 0.52), w * 0.52] : [0];
    for (const o of dd){ const wh = wheelAssy(r, w, style, lod); wh.position.set(x, r, s * (track / 2 + o)); if (s < 0) wh.rotation.y = Math.PI; wh.userData.wheel = r; g.add(wh); } } });
}
function lamps(g, xF, xR, yF, yR, zOff, wF = 0.32, hF = 0.1, wR = 0.3, hR = 0.12){ for (const s of [-1, 1]){ g.add(P(VM.head, RB(0.1, hF, wF, 0.03), xF, yF, s * zOff)); g.add(P(VM.tail, RB(0.1, hR, wR, 0.03), xR, yR, s * zOff)); } }
function plates(g, xF, xR, yF, yR){ const pm = plateMat(); const pl = new THREE.PlaneGeometry(0.52, 0.11); if (xF != null) g.add(P(pm, pl, xF, yF, 0, 0, Math.PI / 2)); if (xR != null) g.add(P(pm, pl, xR, yR, 0, 0, -Math.PI / 2)); }
function mirrors(g, x, y, z, big = false){ for (const s of [-1, 1]){ g.add(P(VM.plastic, RB(big ? 0.08 : 0.06, 0.05, big ? 0.3 : 0.14, 0.02), x, y, s * (z + (big ? 0.12 : 0.05)))); g.add(P(VM.plastic, RB(big ? 0.12 : 0.13, big ? 0.38 : 0.12, big ? 0.06 : 0.16, 0.03), x - 0.02, y + (big ? 0.1 : 0.04), s * (z + (big ? 0.28 : 0.15)))); } }

/* ---------- voitures particulières ---------- */
const CARS = {
  //  L longueur, W largeur, H hauteur, wb empattement, fo porte-à-faux avant, wr rayon de roue, belt ligne de caisse, hood capot, tail arrière, ws pare-brise [x bas, x haut], rs lunette [x haut, x bas]
  citadine:{L:4.05, W:1.76, H:1.48, wb:2.58, fo:0.82, wr:0.315, belt:0.98, hood:0.86, tail:1.0, ws:[3.15, 2.45], rs:[0.55, 0.12], hatch:true},
  berline:{L:4.72, W:1.83, H:1.45, wb:2.8, fo:0.92, wr:0.33, belt:0.98, hood:0.86, tail:1.02, ws:[3.62, 2.86], rs:[1.62, 0.92]},
  break:{L:4.72, W:1.82, H:1.49, wb:2.79, fo:0.92, wr:0.33, belt:0.98, hood:0.86, tail:1.02, ws:[3.62, 2.86], rs:[0.42, 0.14], hatch:true},
  suv:{L:4.5, W:1.85, H:1.66, wb:2.68, fo:0.9, wr:0.36, belt:1.1, hood:1.0, tail:1.12, ws:[3.48, 2.72], rs:[0.45, 0.16], hatch:true, sill:0.2},
  monospace:{L:4.55, W:1.84, H:1.72, wb:2.78, fo:0.88, wr:0.33, belt:1.02, hood:0.92, tail:1.05, ws:[3.85, 2.75], rs:[0.32, 0.1], hatch:true},
};
function makeCar(type = 'berline', color = 0xB3B8BD, lod = 0){
  const S = CARS[type] || CARS.berline, g = new THREE.Group(), L = S.L, W = S.W, bm = bodyMat(color);
  const xf = L - S.fo, xr = xf - S.wb, Hh = S.H, ws = S.ws, rs = S.rs;
  const top = curve(S.hatch
    ? [[0, S.tail - 0.25], [0.04, S.tail - 0.02], [Math.max(0.08, rs[1]), Hh - 0.12], [rs[0], Hh - 0.02], [ws[1] - 0.25, Hh], [ws[1], Hh - 0.04], [ws[0], S.belt + 0.04], [L - 0.35, S.hood], [L - 0.06, S.hood - 0.12], [L, S.hood - 0.3]]
    : [[0, S.tail - 0.25], [0.06, S.tail - 0.02], [rs[1] - 0.25, S.tail + 0.03], [rs[1], S.belt + 0.05], [rs[0], Hh - 0.03], [ws[1] - 0.15, Hh], [ws[1], Hh - 0.04], [ws[0], S.belt + 0.04], [L - 0.35, S.hood], [L - 0.06, S.hood - 0.12], [L, S.hood - 0.3]]);
  const belt = curve([[0, S.tail - 0.1], [0.3, S.belt + 0.02], [L / 2, S.belt], [ws[0], S.belt - 0.02], [L, S.hood - 0.1]]);
  const bot = archBottom(curve([[0, 0.42], [0.25, 0.26], [0.6, 0.2], [L - 0.6, 0.2], [L - 0.25, 0.26], [L, 0.36]]), [xr, xf], S.wr, 0.075);
  const hw = x => { const e = Math.min(x / 0.42, (L - x) / 0.5, 1); return W / 2 * (0.86 + 0.14 * Math.sqrt(Math.max(0, 1 - (1 - e) ** 2))); };
  const bx = (ws[1] + Math.max(rs[0], 0.5)) / 2 + (S.hatch ? 0.15 : -0.05);
  const glass = (x, kind, side, z, gh) => { if (gh < 0.16) return null;
    if (kind === 'top') return 'glass';
    if (x < (S.hatch ? 0.24 : rs[0] + 0.04) || x > ws[1] + 0.32) return null; if (Math.abs(x - bx) < 0.06) return null;
    if (S.hatch && type !== 'citadine' && Math.abs(x - (rs[0] + 0.62)) < 0.05) return null; return 'glass'; };
  g.add(loftBody({L, top, belt, bot, hw, glass, tumble:S.hatch ? 0.17 : 0.16, rt:0.1, sill:S.sill || 0.05}, bm, lod));
  g.add(P(VM.trim, BOX(L - 1.0, 0.2, W - 0.55), 0, 0.32, 0));   // soubassement
  addWheels(g, [xr - L / 2, xf - L / 2], S.wr, 0.215, W - 0.27, lod ? 'steel' : 'alu', lod);
  lamps(g, L / 2 - 0.1, -L / 2 + 0.06, S.hood - 0.16, S.tail - 0.14, W / 2 - 0.27, 0.34, 0.08, 0.32, 0.1);
  if (!lod){ g.add(P(VM.trim, RB(0.08, 0.16, W * 0.42, 0.03), L / 2 - 0.04, S.hood - 0.33, 0)); plates(g, L / 2 + 0.005, -L / 2 - 0.005, 0.36, S.tail - 0.33); mirrors(g, ws[0] - L / 2 - 0.1, S.belt + 0.06, W / 2 - 0.05); }
  g.userData = {L, W, kind:'vl'}; return g;
}
/* ---------- utilitaires ---------- */
function makeVan(color = 0xF4F5F3, lod = 0, opt = {}){ // fourgon (≈ 3,5 t)
  const g = new THREE.Group(), L = opt.L || 5.45, W = 2.02, Hh = opt.H || 2.5, bm = bodyMat(color), xf = L - 0.95, xr = xf - (opt.wb || 3.45);
  const top = curve([[0, Hh - 0.2], [0.05, Hh - 0.04], [0.3, Hh], [L - 1.55, Hh], [L - 1.25, Hh - 0.12], [L - 0.62, 1.38], [L - 0.2, 1.08], [L, 0.78]]);
  const belt = curve([[0, 1.1], [L - 1.5, 1.12], [L - 0.62, 1.15], [L, 0.75]]);
  const bot = archBottom(curve([[0, 0.45], [0.3, 0.32], [L - 0.4, 0.32], [L, 0.4]]), [xr, xf], 0.36, 0.06);
  const hw = x => { const e = Math.min(x / 0.2, (L - x) / 0.55, 1); return W / 2 * (0.9 + 0.1 * Math.sqrt(Math.max(0, 1 - (1 - e) ** 2))); };
  const glass = (x, kind, side, z, gh) => kind === 'top' ? (x > L - 1.4 ? 'glass' : null) : (x > L - 1.95 && x < L - 0.75 && Math.abs(x - (L - 1.4)) > 0.05 && z < Hh - 0.35 ? 'glass' : null);
  g.add(loftBody({L, top, belt, bot, hw, glass, tumble:0.08, rt:0.16, rb:0.1, sill:0.1}, bm, lod)); g.add(P(VM.trim, BOX(L - 1.2, 0.22, W - 0.6), 0, 0.38, 0));
  addWheels(g, [xr - L / 2, xf - L / 2], 0.355, 0.225, W - 0.28, 'steel', lod, opt.dual ? [0] : []);
  lamps(g, L / 2 - 0.12, -L / 2 + 0.03, 0.95, 0.85, W / 2 - 0.22, 0.28, 0.12, 0.12, 0.42);
  if (!lod){ g.add(P(VM.trim, RB(0.1, 0.28, W - 0.3, 0.05), L / 2 - 0.03, 0.5, 0)); g.add(P(VM.trim, RB(0.1, 0.22, W - 0.1, 0.05), -L / 2 + 0.02, 0.45, 0)); plates(g, L / 2 + 0.03, -L / 2 - 0.035, 0.52, 0.5);
    mirrors(g, L / 2 - 1.3, 1.3, W / 2, true); g.add(P(VM.trim, BOX(0.012, 1.7, 0.02), -0.3, 1.35, W / 2 + 0.003)); g.add(P(VM.trim, BOX(0.012, 0.02, 1.0), -L / 2 - 0.002, 1.4, 0)); }
  g.userData = {L, W, kind:'vul'}; return g;
}
/* ---------- poids lourds ---------- */
function truckCab(g, xFront, W, color, lod, H = 3.05, len = 2.25, bigWin = false){ // cabine avancée, avant à xFront
  const bm = bodyMat(color), L = len;
  const top = curve([[0, H - 0.15], [0.08, H], [L - 0.35, H], [L - 0.12, H - 0.18], [L - 0.04, 1.95], [L, 1.2], [L, 0.62]]);
  const belt = curve([[0, 1.85], [L - 0.2, 1.85], [L, 1.75]]), bot = curve([[0, 0.62], [L, 0.55]]);
  const hw = x => { const e = Math.min(x / 0.12, (L - x) / 0.32, 1); return W / 2 * (0.9 + 0.1 * Math.sqrt(Math.max(0, 1 - (1 - e) ** 2))); };
  const glass = (x, kind, side, z, gh) => kind === 'top' ? (z > 1.75 && z < H - 0.22 ? 'glass' : null) : (x > (bigWin ? 0.25 : L - 1.2) && x < L - 0.2 && z < H - 0.38 ? 'glass' : null);
  const cab = loftBody({L, top, belt, bot, hw, glass, tumble:0.02, rt:0.14, rb:0.08, paint:(x, zone, s, z) => x > L - 0.15 && z > 0.8 && z < 1.45 ? 'trim' : null}, bm, lod);
  cab.position.x = xFront - L / 2; g.add(cab);
  g.add(P(VM.trim, RB(0.25, 0.42, W - 0.02, 0.06), xFront - 0.08, 0.6, 0));                       // pare-chocs
  for (const s of [-1, 1]){ g.add(P(VM.head, RB(0.06, 0.13, 0.32, 0.03), xFront + 0.03, 0.72, s * (W / 2 - 0.3))); g.add(P(VM.plastic, RB(0.5, 0.06, 0.06, 0.02), xFront - 0.5, 0.45, s * (W / 2 - 0.15))); }
  if (!lod){ mirrors(g, xFront - 0.25, 2.15, W / 2, true); g.add(P(VM.plastic, RB(1.0, 0.1, 0.3, 0.03), xFront - 1.2, 0.5, W / 2 - 0.2)); plates(g, xFront + 0.05, null, 0.9, 0); }
}
function chassis(g, x0, x1, W, y = 0.85){ g.add(P(VM.trim, BOX(x1 - x0, 0.28, 0.9), (x0 + x1) / 2, y, 0)); }
function sideGuards(g, x0, x1, W){ for (const s of [-1, 1]) for (const yy of [0.5, 0.78]) g.add(P(VM.steel, BOX(x1 - x0, 0.08, 0.03), (x0 + x1) / 2, yy, s * (W / 2 - 0.08))); }
function tank(g, x, W){ g.add(P(VM.alu, CYL(0.3, 0.3, 1.0, 16), x, 0.75, -(W / 2 - 0.4), 0, 0, Math.PI / 2)); }
function ribTex(){ return TEX.rib ??= canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#E9ECEE'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16){ g.fillStyle = '#C9CED3'; g.fillRect(x, 0, 3, h); g.fillStyle = '#F7F8F9'; g.fillRect(x + 3, 0, 2, h); } }); }
function boxBody(g, x0, x1, y0, h, W, color = 0xF2F3F4){ const m = MAT['box|' + color] ??= new THREE.MeshStandardMaterial({color, map:ribTex(), roughness:0.5, metalness:0.2});
  const geo = RB(x1 - x0, h, W, 0.04); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (x1 - x0) * 1.6); g.add(P(m, geo, (x0 + x1) / 2, y0 + h / 2, 0));
  g.add(P(VM.steel, BOX(0.03, h - 0.1, W - 0.1), x0 - 0.012, y0 + h / 2, 0)); g.add(P(VM.trim, BOX(0.035, h - 0.15, 0.025), x0 - 0.02, y0 + h / 2, 0));
  for (const s of [-1, 1]) g.add(P(VM.tail, RB(0.05, 0.1, 0.24, 0.02), x0 - 0.02, 0.85, s * (W / 2 - 0.25))); }
function makeTruck(color = 0xE9ECEF, lod = 0, boxColor = 0xF2F3F4){ // porteur 19 t, caisse fourgon
  const g = new THREE.Group(), L = 9.8, W = 2.5, xF = L / 2; truckCab(g, xF, W, color, lod);
  chassis(g, -L / 2 + 0.3, xF - 0.5, W); boxBody(g, -L / 2, xF - 2.4, 1.15, 2.7, W, boxColor);
  addWheels(g, [xF - 1.45, -L / 2 + 2.4], 0.5, 0.31, W - 0.42, 'truck', lod, [1]);
  if (!lod){ tank(g, xF - 3.3, W); sideGuards(g, xF - 6.9, xF - 2.1, W); }
  g.userData = {L, W, kind:'pl'}; return g;
}
function makeSemi(color = 0x1F3F73, lod = 0){
  const g = new THREE.Group(), L = 16.5, W = 2.55, xF = L / 2; truckCab(g, xF, W, color, lod, 3.2, 2.35);
  chassis(g, xF - 5.6, xF - 0.5, W); g.add(P(VM.steel, CYL(0.35, 0.35, 0.08, 16), xF - 4.3, 1.2, 0));
  boxBody(g, -L / 2, xF - 2.9, 1.25, 2.85, W, 0xEEF0F2); g.add(P(VM.trim, BOX(12.2, 0.25, 1.1), -L / 2 + 6.1, 1.1, 0));
  for (const s of [-1, 1]) g.add(P(VM.steel, BOX(0.06, 0.9, 0.06), xF - 6.5, 0.6, s * 0.8));   // béquilles
  addWheels(g, [xF - 1.5, xF - 4.3, -L / 2 + 1.3, -L / 2 + 2.65, -L / 2 + 4.0], 0.5, 0.31, W - 0.42, 'truck', lod, [1]);
  if (!lod){ tank(g, xF - 3.0, W); sideGuards(g, -L / 2 + 4.6, xF - 6.8, W); }
  g.userData = {L, W, kind:'pl'}; return g;
}
function makeBus(color = 0xF2F4F6, lod = 0, stripe = 0x0E8FB0){ // autobus urbain 12 m, plancher bas
  const g = new THREE.Group(), L = 12, W = 2.55, Hh = 3.12, bm = bodyMat(color), xf = L - 2.7, xr = xf - 5.9;
  const top = curve([[0, Hh - 0.25], [0.12, Hh - 0.04], [0.5, Hh], [L - 0.5, Hh], [L - 0.15, Hh - 0.2], [L - 0.04, 2.0], [L, 0.9], [L, 0.45]]);
  const belt = curve([[0, 1.25], [L - 0.3, 1.1], [L, 1.0]]), bot = archBottom(curve([[0, 0.38], [L, 0.32]]), [xr, xf], 0.5, 0.06);
  const hw = x => { const e = Math.min(x / 0.25, (L - x) / 0.35, 1); return W / 2 * (0.9 + 0.1 * Math.sqrt(Math.max(0, 1 - (1 - e) ** 2))); };
  const doors = [[L - 1.0, L - 2.2], [L - 6.3, L - 7.5]], inDoor = (x, side) => side > 0 && doors.some(([a, b]) => x < a && x > b);
  const glass = (x, kind, side, z, gh) => { if (kind === 'top') return x > L - 0.4 ? 'glass' : null; if (z > Hh - 0.32) return null; if (inDoor(x, side)) return 'glass'; return (x % 1.32) > 0.09 && x > 0.3 ? 'glass' : null; };
  const paint = (x, zone, side, z) => zone === 'low' && inDoor(x, side) && z > 0.4 ? 'glass' : (z > 0.85 && z < 1.05 ? 'stripe' : null);
  g.add(loftBody({L, top, belt, bot, hw, glass, paint, tumble:0.03, rt:0.18, rb:0.1, mats:{stripe:matCol(stripe, {rough:0.4, metal:0.2})}}, bm, lod));
  addWheels(g, [xr - L / 2, xf - L / 2], 0.5, 0.3, W - 0.4, 'truck', lod, [0]);
  lamps(g, L / 2 + 0.01, -L / 2 - 0.01, 0.7, 0.7, W / 2 - 0.3, 0.36, 0.14, 0.2, 0.36);
  if (!lod){ mirrors(g, L / 2 - 0.1, 2.5, W / 2, true); g.add(P(matCol(0x111111, {emissive:0xFF9500, ei:0.5}), BOX(0.04, 0.22, 1.5), L / 2 - 0.02, Hh - 0.2, 0)); }
  g.userData = {L, W, kind:'bus'}; return g;
}
/* ---------- deux-roues et personnes ---------- */
function person(vest = true, pose = 'stand', col = 0x55606E){
  const g = new THREE.Group(), legs = vest ? VM.dark : matCol(0x2F4A6E, {rough:0.9}), top = vest ? matCol(0xF2D200, {rough:0.6}) : matCol(col, {rough:0.8}), skin = matCol(0xC99B7A, {rough:0.8});
  const cap = (r, l, m, x, y, z, rz = 0, rx = 0) => g.add(P(m, new THREE.CapsuleGeometry(r, l, 3, 8), x, y, z, rx, 0, rz));
  if (pose === 'ride'){ cap(0.075, 0.38, legs, 0.18, 0.72, -0.12, 1.25); cap(0.075, 0.38, legs, 0.18, 0.72, 0.12, 1.25); cap(0.065, 0.36, legs, 0.38, 0.45, -0.12, 0.1); cap(0.065, 0.36, legs, 0.38, 0.45, 0.12, 0.1); }
  else { cap(0.075, 0.72, legs, 0, 0.47, -0.1); cap(0.075, 0.72, legs, 0, 0.47, 0.1); }
  const ty = pose === 'ride' ? 0.95 : 0.88; g.add(P(top, RB(0.24, 0.58, 0.4, 0.1), pose === 'ride' ? 0.06 : 0, ty + 0.3, 0, 0, 0, pose === 'ride' ? -0.35 : 0));
  if (vest) for (const yy of [0.1, 0.24]) g.add(P(matCol(0xD8DCDF, {rough:0.3, metal:0.6}), BOX(0.245, 0.035, 0.405), 0, ty + yy, 0));
  if (pose === 'ride'){ cap(0.055, 0.42, top, 0.35, ty + 0.38, -0.2, 1.2); cap(0.055, 0.42, top, 0.35, ty + 0.38, 0.2, 1.2); }
  else { cap(0.055, 0.5, top, 0, ty + 0.26, -0.26, 0, 0.08); cap(0.055, 0.5, top, 0, ty + 0.26, 0.26, 0, -0.08); }
  const hx = pose === 'ride' ? 0.2 : 0, hy = ty + 0.72; g.add(P(skin, new THREE.SphereGeometry(0.105, 14, 12), hx, hy, 0));
  if (vest) g.add(P(VM.white, new THREE.SphereGeometry(0.125, 14, 8, 0, Math.PI * 2, 0, 1.45), hx, hy + 0.03, 0));
  else if (pose === 'ride') g.add(P(matCol(col, {rough:0.3, metal:0.3}), new THREE.SphereGeometry(0.14, 14, 10), hx, hy + 0.02, 0));
  return g;
}
function makeMoto(color = 0x1E1F22, lod = 0){
  const g = new THREE.Group(), bm = bodyMat(color);
  for (const x of [-0.72, 0.72]){ const w = wheelAssy(0.31, 0.13, 'alu', lod); w.position.set(x, 0.31, 0); g.add(w); }
  g.add(P(bm, profileExtrude([[-0.1, 0.62], [0.05, 0.95], [0.42, 1.02], [0.62, 0.9], [0.55, 0.62]], 0.32, 0.06)));       // réservoir et carénage
  g.add(P(VM.seat, profileExtrude([[-0.55, 0.82], [-0.1, 0.86], [0.05, 0.92], [-0.1, 0.95], [-0.6, 0.9]], 0.26, 0.04)));
  g.add(P(VM.engDark, RB(0.45, 0.32, 0.3, 0.06), 0.05, 0.45, 0)); g.add(P(VM.chrome, CYL(0.04, 0.05, 0.75, 8), -0.4, 0.38, 0.17, 0, 0, Math.PI / 2 - 0.12));
  g.add(P(VM.chrome, CYL(0.025, 0.025, 0.62, 8), 0.68, 0.62, 0, 0, 0, 0.35)); g.add(P(VM.head, RB(0.08, 0.1, 0.14, 0.03), 0.82, 0.95, 0)); g.add(P(VM.tail, RB(0.05, 0.05, 0.12, 0.02), -0.72, 0.85, 0));
  g.add(P(VM.plastic, CYL(0.015, 0.015, 0.62, 6), 0.55, 1.07, 0, Math.PI / 2));
  if (!lod){ const p = person(false, 'ride', 0x26292D); p.position.set(-0.32, 0.12, 0); g.add(p); }
  g.userData = {L:2.1, W:0.8, kind:'2r'}; return g;
}
function makeBike(color = 0x2C6EAF){
  const g = new THREE.Group(), fm = matCol(color, {rough:0.35, metal:0.5});
  for (const x of [-0.52, 0.52]){ g.add(P(VM.rubber, new THREE.TorusGeometry(0.34, 0.022, 8, 28), x, 0.35, 0)); g.add(P(VM.rim, new THREE.TorusGeometry(0.31, 0.012, 6, 28), x, 0.35, 0)); }
  const tube = (a, b, r = 0.018) => rod(g, a, b, r, fm);
  tube([-0.52, 0.35, 0], [-0.05, 0.37, 0]); tube([-0.05, 0.37, 0], [-0.15, 0.82, 0]); tube([-0.15, 0.82, 0], [0.4, 0.8, 0]); tube([-0.05, 0.37, 0], [0.4, 0.8, 0]); tube([0.4, 0.8, 0], [0.52, 0.35, 0]); tube([-0.52, 0.35, 0], [-0.15, 0.82, 0], 0.012);
  g.add(P(VM.seat, RB(0.24, 0.05, 0.12, 0.02), -0.17, 0.86, 0)); g.add(P(VM.plastic, CYL(0.012, 0.012, 0.52, 6), 0.42, 0.92, 0, Math.PI / 2));
  const p = person(false, 'ride', 0x3A5A8C); p.scale.setScalar(0.95); p.position.set(-0.3, 0.02, 0); g.add(p);
  g.userData = {L:1.8, W:0.6, kind:'2r'}; return g;
}

/* ============ Engins de chantier (jaune chantier générique, sans marque) ============ */
function planExt(pts, h, mat, bevel = 0.05, y = 0){ // forme en plan (x, z) extrudée vers le haut
  const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1]))), geo = new THREE.ExtrudeGeometry(s, {depth:Math.max(0.01, h - 2 * bevel), bevelEnabled:bevel > 0, bevelSize:bevel, bevelThickness:bevel, bevelSegments:2, curveSegments:10});
  geo.rotateX(-Math.PI / 2); geo.translate(0, y + bevel, 0); return part(geo, mat);
}
function rod(g, a, b, r, mat){ const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), m = new THREE.Mesh(CYL(r, r, d.length(), 10), mat); m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); m.castShadow = true; g.add(m); return m; }
function jack(g, a, b, r = 0.07){ const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), M = A.clone().lerp(B, 0.55); rod(g, a, M.toArray(), r, VM.engDark); rod(g, M.toArray(), b, r * 0.55, VM.chrome); }
/* chenille : ruban fermé (profil en stade) + patins + galets */
function crawler(g, z, L, h, w, x = 0){
  const c = new THREE.Group(); c.position.set(x, 0, z); g.add(c);
  const s = new THREE.Shape(), r = h / 2, hi = new THREE.Path(), t = 0.09;
  s.absarc(L / 2 - r, r, r, -Math.PI / 2, Math.PI / 2, false); s.absarc(-L / 2 + r, r, r, Math.PI / 2, Math.PI * 1.5, false);
  hi.absarc(L / 2 - r, r, r - t, -Math.PI / 2, Math.PI / 2, false); hi.absarc(-L / 2 + r, r, r - t, Math.PI / 2, Math.PI * 1.5, false); s.holes.push(hi);
  const geo = new THREE.ExtrudeGeometry(s, {depth:w, bevelEnabled:false, curveSegments:12}); geo.translate(0, 0, -w / 2); c.add(P(VM.trim, geo));
  const n = Math.round((L - h) / 0.2); for (let i = 0; i <= n; i++){ const xx = -L / 2 + r + i * (L - h) / n; c.add(P(VM.dark, BOX(0.06, 0.035, w + 0.02), xx, h + 0.012, 0)); c.add(P(VM.dark, BOX(0.06, 0.035, w + 0.02), xx, -0.012, 0)); }
  c.add(P(VM.engDark, BOX(L - h * 0.9, h * 0.62, w * 0.55), 0, r, 0));
  for (const xx of [L / 2 - r, -L / 2 + r]) c.add(P(VM.engDark, CYL(r - t - 0.01, r - t - 0.01, w * 0.8, 16), xx, r, 0, Math.PI / 2));
  const m = Math.max(2, Math.round(L / 0.7)); for (let i = 1; i < m; i++) c.add(P(VM.steel, CYL(0.09, 0.09, w * 0.7, 10), -L / 2 + r + i * (L - 2 * r) / m, t + 0.09, 0, Math.PI / 2));
  return c;
}
/* cabine d'engin vitrée (montants peints, vitres latérales et avant) */
function engCab(g, x, y, z, l = 1.05, h = 1.55, w = 0.95, col = VM.eng, slope = 0.15){
  const fr = new THREE.Group(); fr.position.set(x, y, z); g.add(fr);
  fr.add(P(col, profileExtrude([[-l / 2, 0], [-l / 2, h], [l / 2 - slope, h], [l / 2, h * 0.55], [l / 2, 0]], w, 0.05)));
  fr.add(P(VM.glass, profileExtrude([[-l / 2 + 0.12, h * 0.38], [-l / 2 + 0.12, h - 0.1], [l / 2 - slope - 0.05, h - 0.1], [l / 2 - 0.08, h * 0.52], [l / 2 - 0.08, h * 0.38]], w + 0.014, 0.02)));
  fr.add(P(VM.glass, profileExtrude([[l / 2 - 0.05, h * 0.12], [l / 2 - 0.05, h * 0.55], [l / 2 - slope + 0.02, h - 0.08], [l / 2 - slope - 0.06, h - 0.08], [l / 2 - 0.12, h * 0.55], [l / 2 - 0.12, h * 0.12]], w - 0.12, 0.02)));
  fr.add(P(col, RB(l + 0.08, 0.07, w + 0.08, 0.03), -0.02, h + 0.03, 0)); fr.add(P(VM.ind, CYL(0.06, 0.07, 0.12, 12), -l / 2 + 0.15, h + 0.12, -w / 2 + 0.15));
  return fr;
}
function rops(g, x, y, z, l, h, w, col = VM.eng){ for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(P(col, BOX(0.07, h, 0.07), x + sx * l / 2, y + h / 2, z + sz * w / 2)); g.add(P(col, RB(l + 0.15, 0.08, w + 0.15, 0.03), x, y + h, z)); }
function engHood(g, x0, x1, y, h, W, col = VM.eng){ // capot moteur arrondi, grille et ouïes
  const hd = new THREE.Group(); g.add(hd);
  hd.add(P(col, profileExtrude([[x0, y], [x0, y + h - 0.15], [x0 + 0.2, y + h], [x1, y + h], [x1, y]], W, 0.1)));
  hd.add(P(VM.trim, BOX(0.03, h * 0.55, W * 0.7), x0 - 0.01, y + h * 0.42, 0));
  for (let i = 0; i < 5; i++) hd.add(P(VM.engDark, BOX(x1 - x0 - 0.4, 0.03, 0.05), (x0 + x1) / 2 + 0.1, y + h + 0.01, -W * 0.3 + i * W * 0.15));
  return hd;
}
function makeExcavator(mini = false){
  const g = new THREE.Group(), k = mini ? 0.42 : 1, E = VM.eng;
  crawler(g, -1.2 * k, 4.45 * k, 0.92 * k, 0.6 * k); crawler(g, 1.2 * k, 4.45 * k, 0.92 * k, 0.6 * k);
  g.add(P(VM.engDark, BOX(1.4 * k, 0.4 * k, 1.9 * k), 0, 0.72 * k, 0)); g.add(P(VM.engDark, CYL(0.75 * k, 0.75 * k, 0.18 * k, 24), 0, 1.0 * k, 0));
  if (mini){ g.add(P(E, profileExtrude([[0, 0], [0.32, 0], [0.38, 0.4], [0.05, 0.42]], 1.95, 0.02), 1.95 * k, 0.05)); jack(g, [1.3 * k, 0.6 * k, 0], [1.95 * k, 0.35 * k, 0], 0.03); }
  const up = new THREE.Group(); up.position.y = 1.1 * k; g.add(up);
  const plan = [...Array(13)].map((_, i) => { const a = Math.PI / 2 + i / 12 * Math.PI; return [-0.55 * k + Math.cos(a) * 1.35 * k, Math.sin(a) * 1.35 * k]; }); plan.push([1.45 * k, -1.35 * k], [1.45 * k, 1.35 * k]);
  up.add(planExt(plan, 0.95 * k, E, 0.06 * k));                                                                     // tourelle
  const cw = [...Array(11)].map((_, i) => { const a = Math.PI * 0.62 + i / 10 * Math.PI * 0.76; return [-0.55 * k + Math.cos(a) * 1.4 * k, Math.sin(a) * 1.4 * k]; }); cw.push([-1.6 * k, -0.9 * k], [-1.6 * k, 0.9 * k]);
  up.add(planExt(cw.reverse(), 0.85 * k, VM.engDark, 0.06 * k, 0.05 * k));                                         // contrepoids
  up.add(P(VM.engDark, BOX(1.4 * k, 0.04, 1.2 * k), -0.6 * k, 0.97 * k, -0.25 * k)); if (!mini) up.add(P(VM.trim, CYL(0.06, 0.06, 0.5, 10), -0.4, 1.2, -0.8));
  if (mini){ rops(up, 0.35 * k, 0.95 * k, 0.55 * k, 1.6 * k, 1.45, 1.6 * k); up.add(P(VM.seat, RB(0.4, 0.5, 0.45, 0.08), 0.3 * k, 0.95 * k + 0.25, 0.55 * k)); }
  else { engCab(up, 0.75 * k, 0.95 * k, 0.78 * k, 1.05, 1.6, 0.98); for (const s of [-1, 1]) up.add(P(VM.steel, BOX(1.2, 0.04, 0.04), 0.1, 1.95, s * 0.2 - 0.6)); }
  // flèche, balancier, godet
  const arm = new THREE.Group(); arm.position.set(1.15 * k, 1.05 * k, -0.25 * k); up.add(arm);
  arm.add(P(E, profileExtrude([[0, -0.2], [0, 0.25], [1.4, 1.35], [3.0, 1.55], [3.25, 1.2], [3.1, 0.95], [1.6, 0.85], [0.45, -0.3]].map(p => [p[0] * k, p[1] * k]), 0.46 * k, 0.04 * k)));
  arm.add(P(E, profileExtrude([[3.0, 1.45], [3.2, 1.25], [3.95, -0.85], [3.75, -1.0], [2.85, 1.15]].map(p => [p[0] * k, p[1] * k]), 0.34 * k, 0.03 * k)));
  arm.add(P(VM.bucket, profileExtrude([[3.65, -0.85], [4.05, -0.95], [4.35, -1.3], [4.25, -1.75], [3.75, -1.85], [3.6, -1.55]].map(p => [p[0] * k, p[1] * k]), 0.85 * k, 0.03 * k)));
  for (let i = -2; i <= 2; i++) arm.add(P(VM.steel, BOX(0.16 * k, 0.07 * k, 0.07 * k), 3.7 * k, -1.85 * k, i * 0.17 * k, 0, 0, 0.4));
  jack(arm, [0.55 * k, -0.05 * k, 0.22 * k], [1.7 * k, 0.95 * k, 0.22 * k], 0.09 * k); jack(arm, [0.55 * k, -0.05 * k, -0.22 * k], [1.7 * k, 0.95 * k, -0.22 * k], 0.09 * k);
  jack(arm, [1.75 * k, 1.3 * k, 0], [3.05 * k, 1.65 * k, 0], 0.08 * k); jack(arm, [3.2 * k, 1.1 * k, 0], [3.85 * k, -0.75 * k, 0], 0.065 * k);
  g.userData = {L:(mini ? 4.2 : 9.6), W:(mini ? 1.6 : 2.9), kind:'engin'}; return g;
}
function makeLoader(){ // chargeuse sur pneus articulée
  const g = new THREE.Group(), E = VM.eng;
  engHood(g, -3.1, -0.9, 0.95, 1.25, 2.1); g.add(P(VM.engDark, RB(0.5, 1.1, 2.2, 0.08), -3.2, 1.1, 0));
  g.add(P(E, RB(1.6, 0.6, 1.9, 0.08), -0.35, 1.25, 0)); engCab(g, -0.55, 1.55, 0, 1.45, 1.75, 1.5);
  g.add(P(VM.engDark, CYL(0.25, 0.25, 0.6, 12), 0.55, 1.05, 0)); g.add(P(E, RB(1.5, 0.6, 1.6, 0.08), 1.35, 1.2, 0));
  addWheels(g, [-1.9, 1.35], 0.8, 0.58, 2.25, 'eng', 0);
  for (const s of [-1, 1]){ g.add(P(E, profileExtrude([[0.5, 1.2], [0.8, 1.7], [3.1, 1.15], [3.0, 0.75], [2.6, 0.75]], 0.2, 0.04), 0, 0, s * 0.62)); jack(g, [0.9, 1.0, s * 0.35], [2.3, 1.45, s * 0.35], 0.09); }
  g.add(P(VM.bucket, profileExtrude([[2.85, 0.1], [3.85, 0.05], [3.95, 0.25], [3.4, 0.55], [3.05, 1.35], [2.75, 1.25]], 2.6, 0.03)));
  for (const s of [-1, 1]){ g.add(P(VM.trim, RB(1.0, 0.1, 0.5, 0.03), 1.35, 1.65, s * 1.05)); g.add(P(VM.trim, RB(1.0, 0.1, 0.5, 0.03), -1.9, 1.65, s * 1.05)); }
  g.userData = {L:7.6, W:2.7, kind:'engin'}; return g;
}
function makeBackhoe(){ // tractopelle
  const g = new THREE.Group(), E = VM.eng;
  g.add(P(E, profileExtrude([[0.3, 0.75], [0.3, 1.55], [1.9, 1.45], [2.05, 1.25], [2.05, 0.75]], 1.0, 0.08)));             // capot
  g.add(P(VM.engDark, RB(2.6, 0.35, 1.0, 0.05), 0.3, 0.75, 0)); engCab(g, -0.6, 1.05, 0, 1.6, 1.85, 1.55);
  addWheels(g, [-1.1], 0.78, 0.5, 1.75, 'eng', 0); addWheels(g, [1.4], 0.55, 0.38, 1.65, 'eng', 0);
  for (const s of [-1, 1]){ g.add(P(E, profileExtrude([[0.2, 1.2], [1.4, 1.55], [2.8, 0.8], [2.65, 0.55], [1.3, 1.25]], 0.14, 0.03), 0, 0, s * 0.62)); g.add(P(E, BOX(0.25, 0.25, 0.25), -1.7, 0.6, s * 1.05)); g.add(P(VM.steel, BOX(0.18, 0.7, 0.18), -1.75, 0.3, s * 1.25)); }
  g.add(P(VM.bucket, profileExtrude([[2.55, 0.05], [3.25, 0.05], [3.3, 0.22], [2.95, 0.45], [2.7, 0.95], [2.5, 0.85]], 2.25, 0.03)));
  const b = new THREE.Group(); b.position.set(-1.85, 1.05, 0); g.add(b); b.add(P(E, RB(0.35, 0.6, 0.6, 0.05), 0, 0, 0));
  b.add(P(E, profileExtrude([[0, 0], [-0.1, 0.35], [-1.3, 1.65], [-1.55, 1.5], [-0.3, -0.1]], 0.32, 0.03))); b.add(P(E, profileExtrude([[-1.35, 1.7], [-1.55, 1.5], [-2.3, -0.4], [-2.12, -0.5]], 0.25, 0.03)));
  b.add(P(VM.bucket, profileExtrude([[-2.1, -0.35], [-2.5, -0.45], [-2.6, -0.8], [-2.3, -0.95], [-2.05, -0.75]], 0.6, 0.02))); jack(b, [-0.2, 0.25, 0.22], [-1.1, 1.4, 0.22], 0.06); jack(b, [-1.3, 1.85, 0], [-2.0, -0.2, 0], 0.05);
  g.userData = {L:7.2, W:2.3, kind:'engin'}; return g;
}
function drum(g, x, r, w){ g.add(P(VM.drum, CYL(r, r, w, 28), x, r, 0, Math.PI / 2)); for (const s of [-1, 1]) g.add(P(VM.engDark, CYL(r * 0.85, r * 0.85, 0.04, 24), x, r, s * (w / 2 + 0.01), Math.PI / 2)); }
function makeRoller(){ // compacteur monocylindre
  const g = new THREE.Group(), E = VM.eng; drum(g, 1.55, 0.78, 2.1);
  g.add(P(E, profileExtrude([[0.75, 0.55], [0.75, 1.85], [2.35, 1.85], [2.5, 1.2], [2.2, 0.75], [1.6, 1.62], [1.0, 1.62], [1.0, 0.55]], 2.35, 0.05)));
  engHood(g, -2.5, -0.5, 0.85, 1.05, 1.9); g.add(P(E, RB(1.4, 0.7, 1.9, 0.08), 0.15, 1.15, 0)); addWheels(g, [-1.55], 0.78, 0.6, 1.95, 'eng', 0); engCab(g, -0.05, 1.75, 0, 1.25, 1.6, 1.45);
  g.userData = {L:5.9, W:2.35, kind:'engin'}; return g;
}
function makeTandem(){ // compacteur tandem (enrobés)
  const g = new THREE.Group(), E = VM.eng; drum(g, 1.3, 0.55, 1.5); drum(g, -1.3, 0.55, 1.5);
  for (const x of [1.3, -1.3]) g.add(P(E, profileExtrude([[x - 0.75, 0.65], [x - 0.7, 1.25], [x + 0.75, 1.25], [x + 0.8, 0.65]], 1.65, 0.05)));
  g.add(P(E, RB(1.4, 1.0, 1.4, 0.1), 0, 1.25, 0)); rops(g, 0, 1.75, 0, 1.1, 1.3, 1.3); g.add(P(VM.seat, RB(0.45, 0.5, 0.45, 0.08), -0.1, 2.0, 0)); g.add(P(VM.trim, CYL(0.04, 0.04, 0.5, 8), -0.4, 2.0, -0.5));
  g.userData = {L:4.3, W:1.7, kind:'engin'}; return g;
}
function makeFinisher(){ // finisseur
  const g = new THREE.Group(), E = VM.eng; crawler(g, -0.95, 3.0, 0.62, 0.42); crawler(g, 0.95, 3.0, 0.62, 0.42);
  g.add(P(E, RB(2.8, 0.9, 2.5, 0.08), -0.1, 1.1, 0));
  g.add(P(E, profileExtrude([[0, 0], [1.3, 0.05], [1.6, 0.85], [-0.05, 0.85]], 3.1, 0.03), 1.2, 0.6)); for (const s of [-1, 1]) g.add(P(E, profileExtrude([[0, 0], [1.3, 0], [1.6, 0.85], [0, 0.85]], 0.06, 0.01), 1.2, 0.6, s * 1.6));
  g.add(P(VM.engDark, RB(0.7, 0.55, 3.6, 0.04), -1.75, 0.35, 0)); g.add(P(E, RB(0.25, 0.6, 3.7, 0.04), -2.15, 0.6, 0));
  rops(g, -0.7, 1.55, 0, 1.4, 1.4, 2.3); g.add(P(VM.trim, RB(1.6, 0.05, 2.5, 0.02), -0.7, 2.98, 0)); g.add(P(VM.seat, RB(0.45, 0.5, 0.45, 0.08), -0.9, 1.8, 0.6)); g.add(P(VM.seat, RB(0.45, 0.5, 0.45, 0.08), -0.9, 1.8, -0.6));
  g.add(P(VM.trim, CYL(0.07, 0.07, 1.0, 10), 0.2, 2.0, -0.9));
  g.userData = {L:6.4, W:3.7, kind:'engin'}; return g;
}
function makeDozer(){ // bouteur sur chenilles
  const g = new THREE.Group(), E = VM.eng; crawler(g, -1.0, 3.4, 0.95, 0.55); crawler(g, 1.0, 3.4, 0.95, 0.55);
  engHood(g, 0.0, 1.9, 1.0, 1.0, 1.4); g.add(P(E, RB(1.6, 0.8, 2.0, 0.08), -0.7, 1.35, 0)); engCab(g, -0.8, 1.75, 0, 1.3, 1.6, 1.4); g.add(P(VM.trim, CYL(0.07, 0.07, 0.6, 10), 1.3, 2.2, -0.35));
  g.add(P(E, profileExtrude([[0, 0], [0.25, 0], [0.45, 0.4], [0.45, 1.25], [0.15, 1.3], [0.05, 0.6]], 3.6, 0.03), 2.35, 0.05)); for (const s of [-1, 1]){ g.add(P(E, BOX(1.4, 0.18, 0.18), 1.6, 0.75, s * 1.05, 0, 0, -0.3)); jack(g, [0.8, 1.6, s * 0.75], [2.35, 1.05, s * 0.75], 0.08); }
  for (let i = 0; i < 3; i++) g.add(P(VM.steel, BOX(0.12, 0.6, 0.1), -1.95, 0.35, (i - 1) * 0.5));
  g.userData = {L:5.6, W:3.6, kind:'engin'}; return g;
}
function makeGrader(){ // niveleuse
  const g = new THREE.Group(), E = VM.eng;
  g.add(P(E, profileExtrude([[-0.2, 1.2], [-0.1, 1.5], [3.9, 1.4], [4.0, 1.1], [3.8, 1.0], [0, 1.0]], 0.5, 0.06))); engHood(g, -3.4, -1.3, 0.9, 1.15, 1.9); g.add(P(E, RB(1.1, 0.7, 1.9, 0.08), -1.0, 1.3, 0));
  engCab(g, -0.9, 1.65, 0, 1.4, 1.75, 1.6, E, 0.05); addWheels(g, [3.7], 0.7, 0.45, 2.0, 'eng', 0); addWheels(g, [-1.9, -3.0], 0.7, 0.45, 2.0, 'eng', 0);
  g.add(P(VM.steel, profileExtrude([[0, 0], [0.1, 0], [0.25, 0.25], [0.2, 0.6], [0.05, 0.55]], 3.6, 0.02), 1.4, 0.05, 0, 0, 0.35)); g.add(P(E, CYL(0.8, 0.8, 0.12, 24), 1.6, 0.9, 0)); jack(g, [3.3, 1.5, 0.35], [1.6, 0.85, 1.1], 0.06); jack(g, [3.3, 1.5, -0.35], [1.6, 0.85, -1.1], 0.06);
  g.userData = {L:8.4, W:2.6, kind:'engin'}; return g;
}
function makeDumper(){ // tombereau articulé
  const g = new THREE.Group(), E = VM.eng; engHood(g, 2.2, 4.4, 1.0, 1.2, 2.4); engCab(g, 1.4, 1.6, 0, 1.4, 1.7, 1.7);
  g.add(P(E, profileExtrude([[-4.6, 1.4], [-4.8, 2.9], [0.6, 3.1], [0.9, 1.6], [0.4, 1.3]], 2.9, 0.06))); g.add(P(VM.engDark, BOX(1.5, 0.4, 1.5), 0.6, 1.0, 0));
  addWheels(g, [3.2], 0.85, 0.65, 2.3, 'eng', 0); addWheels(g, [-1.4, -3.4], 0.85, 0.65, 2.3, 'eng', 0);
  g.userData = {L:9.9, W:2.9, kind:'engin'}; return g;
}
function makeMiniDumper(){ // dumper de chantier
  const g = new THREE.Group(), E = VM.eng; addWheels(g, [0.75, -0.75], 0.45, 0.35, 1.25, 'eng', 0);
  g.add(P(E, RB(1.2, 0.5, 1.3, 0.06), -0.5, 0.75, 0)); g.add(P(E, profileExtrude([[0, 0], [0.9, 0], [1.4, 0.75], [-0.2, 0.75]], 1.5, 0.04), 0.15, 0.6)); g.add(P(VM.seat, RB(0.4, 0.4, 0.4, 0.06), -0.6, 1.15, 0));
  rops(g, -0.95, 1.0, 0, 0.1, 1.2, 1.2); g.add(P(VM.trim, CYL(0.012, 0.012, 0.4, 6), -0.25, 1.3, 0, Math.PI / 2));
  g.userData = {L:2.9, W:1.6, kind:'engin'}; return g;
}
function makeTelehandler(){ // chariot télescopique
  const g = new THREE.Group(), E = VM.eng; g.add(P(E, RB(4.6, 0.65, 1.2, 0.08), 0, 0.95, 0)); engCab(g, 0.4, 0.7, 0.8, 1.6, 1.85, 0.9); engHood(g, -0.7, 1.4, 0.65, 0.9, 0.7).position.z = -0.85;
  addWheels(g, [1.6, -1.6], 0.62, 0.48, 1.95, 'eng', 0);
  const boom = new THREE.Group(); boom.position.set(-2.1, 1.35, 0); boom.rotation.z = 0.22; g.add(boom); boom.add(P(E, RB(4.8, 0.55, 0.55, 0.04), 2.3, 0.2, 0)); boom.add(P(E, RB(1.6, 0.42, 0.42, 0.03), 5.2, 0.2, 0));
  const fk = new THREE.Group(); fk.position.set(4.35, 0.45, 0); g.add(fk); fk.add(P(VM.engDark, BOX(0.12, 0.9, 1.2), 0, 0.2, 0)); for (const s of [-1, 1]) fk.add(P(VM.steel, BOX(1.1, 0.06, 0.12), 0.55, -0.22, s * 0.38));
  g.userData = {L:6.0, W:2.4, kind:'engin'}; return g;
}
function makeColdPlaner(){ // fraiseuse (rabotage des enrobés)
  const g = new THREE.Group(), E = VM.eng; for (const x of [-1.6, 1.6]) for (const z of [-0.8, 0.8]) crawler(g, z, 1.7, 0.7, 0.4, x);
  g.add(P(E, RB(5.0, 1.3, 2.4, 0.1), 0, 1.4, 0)); g.add(P(VM.engDark, RB(1.5, 0.9, 2.5, 0.06), 0.1, 0.55, 0)); rops(g, -0.3, 2.05, 0, 1.6, 1.4, 2.2); g.add(P(VM.trim, RB(1.9, 0.05, 2.5, 0.02), -0.3, 3.48, 0));
  const c = new THREE.Group(); c.position.set(2.5, 1.2, 0); c.rotation.z = 0.32; g.add(c); c.add(P(E, RB(6.0, 0.45, 0.85, 0.06), 3.0, 0, 0)); c.add(P(VM.engDark, BOX(5.8, 0.06, 0.7), 3.0, 0.25, 0));
  g.userData = {L:13, W:2.5, kind:'engin'}; return g;
}
function tipperBody(g, x0, x1, y, W, col = VM.steel, h = 1.4){ const s = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(x1 - x0 - 0.3, 0), new THREE.Vector2(x1 - x0, h + 0.2), new THREE.Vector2(x1 - x0 - 0.15, h + 0.35), new THREE.Vector2(-0.1, h), new THREE.Vector2(-0.2, 0.3)]);
  const b = new THREE.ExtrudeGeometry(s, {depth:W, bevelEnabled:true, bevelSize:0.03, bevelThickness:0.03, bevelSegments:1}); b.translate(0, 0, -W / 2); g.add(P(col, b, x0, y)); g.add(P(VM.trim, BOX(x1 - x0 - 0.6, 0.02, W - 0.15), (x0 + x1) / 2 - 0.1, y + h - 0.12, 0));
  for (let x = x0 + 0.6; x < x1 - 0.3; x += 0.9) for (const s2 of [-1, 1]) g.add(P(col, BOX(0.08, h - 0.1, 0.05), x, y + h / 2 + 0.05, s2 * (W / 2 + 0.03))); }
function makeTipper(lod = 0){ const g = new THREE.Group(), L = 9.3, W = 2.5, xF = L / 2; truckCab(g, xF, W, 0xE9ECEF, lod, 3.1, 2.25);
  chassis(g, -L / 2 + 0.2, xF - 0.5, W); tipperBody(g, -L / 2 + 0.1, xF - 2.45, 1.25, W, MAT.tip ??= matCol(0x8E959C, {rough:0.45, metal:0.6}));
  addWheels(g, [xF - 1.4, xF - 3.0, -L / 2 + 2.6, -L / 2 + 1.25], 0.52, 0.32, W - 0.42, 'truck', lod, [2, 3]); g.userData = {L, W, kind:'pl'}; return g; }
function makeMixer(lod = 0){ const g = new THREE.Group(), L = 9.0, W = 2.5, xF = L / 2; truckCab(g, xF, W, 0xE9ECEF, lod, 3.05, 2.2); chassis(g, -L / 2 + 0.2, xF - 0.5, W);
  const prof = [[0.12, 0], [0.75, 0.25], [1.18, 1.2], [1.22, 2.6], [0.95, 4.3], [0.42, 5.3], [0.32, 5.45]].map(p => new THREE.Vector2(p[0], p[1]));
  const d = new THREE.LatheGeometry(prof, 28); d.rotateZ(Math.PI / 2 - 0.18); g.add(P(MAT.mix ??= matCol(0xF06A12, {rough:0.4, metal:0.2}), d, xF - 2.15, 1.95, 0));
  for (let i = 0; i < 9; i++){ const t = i / 9, a = t * Math.PI * 4; g.add(P(VM.white, BOX(0.5, 0.05, 0.08), xF - 2.3 - t * 4.8, 2.0 + Math.sin(a) * 1.15 + t * 0.85, Math.cos(a) * 1.15, a, 0, 0)); }
  g.add(P(VM.steel, profileExtrude([[0, 0], [0.8, -0.2], [0.8, -0.05], [0, 0.15]], 0.4, 0.02), -L / 2 + 0.3, 1.8)); g.add(P(VM.steel, BOX(0.4, 1.4, 1.6), -L / 2 + 0.9, 1.6, 0));
  addWheels(g, [xF - 1.4, -L / 2 + 2.5, -L / 2 + 1.15], 0.52, 0.32, W - 0.42, 'truck', lod, [1, 2]); g.userData = {L, W, kind:'pl'}; return g; }
function makeAerial(){ const g = makeVan(0xF4F5F3, 0, {L:6.2, wb:3.7, H:2.2, dual:true}); g.add(P(VM.eng, CYL(0.3, 0.35, 0.35, 16), -1.8, 2.4, 0));
  g.add(P(VM.eng, RB(3.6, 0.25, 0.28, 0.05), -0.2, 2.55, 0)); g.add(P(VM.alu, RB(2.0, 0.18, 0.2, 0.04), 1.9, 2.55, 0)); g.add(P(VM.eng, BOX(0.7, 0.05, 0.9), 3.0, 2.3, 0));
  for (const s of [-1, 1]) for (const yy of [2.75, 3.3]) g.add(P(VM.eng, BOX(0.7, 0.04, 0.04), 3.0, yy, s * 0.45)); for (const sx of [-1, 1]) for (const s of [-1, 1]) g.add(P(VM.eng, BOX(0.04, 1.0, 0.04), 3.0 + sx * 0.33, 2.8, s * 0.43));
  g.userData = {L:6.2, W:2.0, kind:'vul'}; return g; }
function makeCrane(){ const g = new THREE.Group(), L = 11.8, W = 2.55, xF = L / 2; truckCab(g, xF, W, 0xE8AE0C, 0, 2.9, 1.9);
  g.add(P(VM.eng, RB(9.6, 1.0, W, 0.08), -0.8, 1.35, 0)); addWheels(g, [xF - 1.3, xF - 2.9, -L / 2 + 2.9, -L / 2 + 1.4], 0.6, 0.38, W - 0.4, 'truck', 0);
  g.add(P(VM.eng, RB(2.6, 1.3, 2.3, 0.1), -3.6, 2.5, 0)); g.add(P(VM.engDark, RB(1.0, 1.0, 2.2, 0.06), -5.2, 2.4, 0)); engCab(g, -2.5, 1.85, 1.0, 1.1, 1.4, 0.75);
  const b = new THREE.Group(); b.position.set(-4.2, 3.2, 0); b.rotation.z = 0.12; g.add(b); [[10.5, 0.75], [9.0, 0.6], [6.5, 0.48]].forEach(([l, s], i) => b.add(P(VM.eng, RB(l, s, s, 0.05), l / 2 + i * 2.2, 0, 0))); jack(g, [-2.0, 2.0, 0], [-0.5, 3.4, 0], 0.15);
  for (const sx of [xF - 3.8, -L / 2 + 0.8]) for (const s of [-1, 1]){ g.add(P(VM.eng, BOX(0.3, 0.3, 1.2), sx, 1.0, s * 1.85)); g.add(P(VM.steel, BOX(0.2, 0.9, 0.2), sx, 0.45, s * 2.4)); g.add(P(VM.steel, BOX(0.6, 0.06, 0.6), sx, 0.03, s * 2.4)); }
  g.userData = {L, W, kind:'pl'}; return g; }
function makeSweeper(){ // balayeuse de voirie compacte
  const g = new THREE.Group(), bm = bodyMat(0xF2F3F1); addWheels(g, [1.15, -1.0], 0.38, 0.25, 1.35, 'steel', 0);
  const cab = loftBody({L:1.6, top:curve([[0, 2.05], [1.2, 2.1], [1.5, 1.9], [1.6, 1.0]]), belt:curve([[0, 1.0], [1.6, 0.95]]), bot:curve([[0, 0.4], [1.6, 0.45]]), hw:() => 0.72, tumble:0.02, rt:0.12, glass:(x, k, s, z) => x > 0.2 && z < 1.9 ? 'glass' : null}, bm, 0);
  cab.position.x = 1.2; g.add(cab);
  g.add(P(MAT.swp ??= matCol(0x2E7D32, {rough:0.5}), RB(2.0, 1.55, 1.5, 0.12), -1.15, 1.25, 0)); g.add(P(VM.trim, BOX(2.6, 0.25, 1.4), -0.4, 0.42, 0));
  for (const s of [-1, 1]) g.add(P(matCol(0x3B2A1A, {rough:1}), CYL(0.38, 0.38, 0.08, 18), 1.65, 0.05, s * 0.6));
  g.add(P(VM.ind, CYL(0.07, 0.08, 0.14, 12), 0.6, 2.2, 0)); g.userData = {L:4.4, W:1.6, kind:'vul'}; return g; }
function arrowPanel(){ const g = flr(); g.children.slice(2).forEach(c => g.remove(c)); return g; }   // panneau FLR seul (sans remorque)
function makeFLRTruck(){ // véhicule de signalisation avec flèche lumineuse de rabattement (FLR)
  const L = 5.9, g = makeVan(0xF4F5F3, 0, {L, wb:3.6, H:2.4, dual:true});
  g.add(P(stripeMat('#C8102E', '#F4F4F2', true, 8), BOX(0.02, 0.45, 1.9), -L / 2 - 0.04, 0.85, 0));
  const fl = arrowPanel(); fl.position.set(-L / 2 + 0.6, 0.45, 0); fl.rotation.y = Math.PI; g.add(fl);
  g.add(P(VM.ind, BOX(0.25, 0.1, 1.3), L / 2 - 1.4, 2.48, 0)); g.userData = {L, W:2.02, kind:'vul'}; return g; }
function makeTMA(){ // porteur équipé d'un atténuateur de chocs (TMA)
  const g = makeTruck(0xF2F3F1, 0, 0xF2F3F1), L = 9.8; const at = new THREE.Group(); at.position.set(-L / 2 - 1.5, 0.75, 0); g.add(at);
  at.add(P(stripeMat('#C8102E', '#F4F4F2', true, 10), RB(2.8, 0.8, 2.3, 0.08), 0, 0.3, 0)); at.add(P(VM.steel, BOX(0.3, 0.2, 1.8), 1.4, 0, 0));
  const fl = arrowPanel(); fl.position.set(-L / 2 + 0.2, 1.5, 0); fl.rotation.y = Math.PI; g.add(fl);
  g.userData = {L:L + 2.9, W:2.5, kind:'pl'}; return g; }
function makeLowLoader(){ // porte-engins surbaissé (avec mini-pelle chargée)
  const g = new THREE.Group(), L = 17.5, W = 2.55, xF = L / 2; truckCab(g, xF, W, 0x8E1B1B, 0, 3.2, 2.35); chassis(g, xF - 5.6, xF - 0.5, W);
  g.add(P(VM.trim, profileExtrude([[-8.75, 0.95], [-8.75, 0.6], [1.6, 0.6], [2.2, 1.25], [3.6, 1.3], [3.6, 1.05], [2.4, 1.0], [1.8, 0.95]], W, 0.04)));
  addWheels(g, [xF - 1.5, xF - 4.3, -L / 2 + 1.0, -L / 2 + 2.3, -L / 2 + 3.6], 0.44, 0.28, W - 0.42, 'truck', 0, [1]);
  const ex = makeExcavator(true); ex.scale.setScalar(1.5); ex.position.set(-3.0, 0.95, 0); g.add(ex); g.userData = {L, W, kind:'pl'}; return g; }
function makeVacTruck(){ // hydrocureuse
  const g = new THREE.Group(), L = 9.4, W = 2.5, xF = L / 2; truckCab(g, xF, W, 0xF2F3F1, 0, 3.0, 2.2); chassis(g, -L / 2 + 0.2, xF - 0.5, W);
  g.add(P(MAT.vac ??= matCol(0xF06A12, {rough:0.4, metal:0.3}), CYL(1.1, 1.1, 6.2, 28), -1.0, 2.35, 0, 0, 0, Math.PI / 2)); g.add(P(VM.steel, CYL(1.12, 1.12, 0.1, 28), -4.1, 2.35, 0, 0, 0, Math.PI / 2));
  g.add(P(VM.engDark, CYL(0.55, 0.55, 0.9, 20), -4.0, 2.35, 1.05, Math.PI / 2)); g.add(P(VM.trim, CYL(0.09, 0.09, 4.5, 8), 0.3, 3.55, 0, 0, 0, Math.PI / 2 - 0.08));
  addWheels(g, [xF - 1.4, -L / 2 + 2.5, -L / 2 + 1.15], 0.52, 0.32, W - 0.42, 'truck', 0, [1, 2]); g.userData = {L, W, kind:'pl'}; return g; }
function makeCraneTruck(){ // camion plateau avec grue auxiliaire
  const g = new THREE.Group(), L = 9.5, W = 2.5, xF = L / 2; truckCab(g, xF, W, 0x1F3F73, 0, 3.0, 2.2); chassis(g, -L / 2 + 0.2, xF - 0.5, W);
  g.add(P(VM.deck, BOX(6.0, 0.12, W), -1.75, 1.2, 0)); for (const s of [-1, 1]) g.add(P(VM.alu, BOX(6.0, 0.45, 0.04), -1.75, 1.45, s * W / 2)); g.add(P(VM.alu, BOX(0.04, 0.45, W), -L / 2 + 0.25, 1.45, 0));
  g.add(P(VM.eng, CYL(0.3, 0.35, 1.4, 16), xF - 2.55, 1.85, 0)); g.add(P(VM.eng, RB(3.6, 0.3, 0.3, 0.05), xF - 3.9, 2.9, 0, 0, 0, -0.35)); g.add(P(VM.eng, RB(3.0, 0.24, 0.24, 0.04), -0.6, 2.2, 0, 0, 0, 0.3));
  for (const s of [-1, 1]) g.add(P(VM.eng, BOX(0.25, 0.25, 1.0), xF - 2.55, 0.9, s * 1.6));
  addWheels(g, [xF - 1.4, -L / 2 + 2.3], 0.52, 0.32, W - 0.42, 'truck', 0, [1]); g.userData = {L, W, kind:'pl'}; return g; }
function makePickup(color = 0xF2F3F1){ // camionnette benne (services techniques)
  const L = 5.3, g = new THREE.Group(), bm = bodyMat(color), xf = L - 0.95, xr = xf - 3.3;
  const cab = loftBody({L:2.1, top:curve([[0, 2.0], [0.1, 2.15], [1.0, 2.15], [1.45, 1.35], [1.75, 1.08], [2.1, 0.8]]), belt:curve([[0, 1.1], [2.1, 0.78]]), bot:archBottom(curve([[0, 0.45], [2.1, 0.4]]), [2.1 - 0.95], 0.355, 0.06),
    hw:x => 1.0 - (x > 1.8 ? (x - 1.8) * 0.3 : 0), tumble:0.06, rt:0.12, sill:0.1, glass:(x, k, s, z) => k === 'top' ? (x > 1.0 ? 'glass' : null) : (x > 0.25 && x < 1.3 && z < 1.95 ? 'glass' : null)}, bm, 0);
  cab.position.x = L / 2 - 1.05; g.add(cab);
  g.add(P(VM.alu, BOX(3.1, 0.12, 2.0), -1.05, 1.0, 0)); for (const s of [-1, 1]) g.add(P(VM.alu, BOX(3.1, 0.4, 0.04), -1.05, 1.25, s * 1.0)); g.add(P(VM.alu, BOX(0.04, 0.4, 2.0), -2.6, 1.25, 0)); g.add(P(VM.trim, BOX(3.4, 0.3, 1.0), -1.0, 0.7, 0));
  addWheels(g, [xr - L / 2, xf - L / 2], 0.355, 0.225, 1.74, 'steel', 0, [0]); lamps(g, L / 2 - 0.08, -L / 2 + 0.05, 0.9, 0.85, 0.78, 0.26, 0.12, 0.12, 0.3);
  mirrors(g, L / 2 - 0.95, 1.25, 1.0, true); g.add(P(VM.ind, BOX(0.25, 0.1, 1.2), L / 2 - 1.5, 2.22, 0)); g.userData = {L, W:2.02, kind:'vul'}; return g; }
