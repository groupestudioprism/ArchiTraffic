/* ============ Textures ============
   Deux niveaux : 1) textures procédurales dessinées dans l'app (immédiates, hors ligne) ;
   2) textures photographiques Poly Haven (CC0, domaine public : libres de droit, sans attribution obligatoire), chargées
   en arrière-plan et substituées dès qu'elles arrivent. Échelle : UV en mètres, « rep » = taille réelle d'une répétition. */
const PH_BASE = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/';
const PH = {   // id Poly Haven → texture de l'app
  asphalt:{id:'asphalt_02', rep:6}, asphaltNew:{id:'asphalt_floor', rep:5}, sidewalk:{id:'concrete_pavement', rep:3}, pavers:{id:'interlocking_concrete_pavers', rep:2.5},
  cobble:{id:'cobblestone_floor_001', rep:2.5}, grass:{id:'grass_ground', rep:4}, gravel:{id:'gravel_road', rep:4},
  roofTiles:{id:'clay_roof_tiles', rep:3}, roofSlate:{id:'roof_slates_02', rep:3}, roofZinc:{id:'grey_roof_01', rep:3}, concrete:{id:'concrete_floor_worn_001', rep:4},
};
const TEX = {}, TEX_LISTENERS = new Set();
const texOpts = {photo:true};
function canvasTex(w, h, draw, srgb = true){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData = {cv}; return t;
}
function speckle(g, w, h, R, base, amt, n, sz = 2, alpha = 0.5){ for (let i = 0; i < n; i++){ g.globalAlpha = alpha * R(); g.fillStyle = shadeHex(base, (R() - 0.5) * amt); const s = sz * (0.5 + R()); g.fillRect(R() * w, R() * h, s, s); } g.globalAlpha = 1; }
function shadeHex(hex, k){ const c = new THREE.Color(hex), o = {}; c.getHSL(o); c.setHSL(o.h, o.s, clamp(o.l + k, 0, 1)); return '#' + c.getHexString(); }
/* ---------- procédural ---------- */
const PROC = {
  asphalt:() => canvasTex(512, 512, (g, w, h) => { const R = rng(11); g.fillStyle = '#4C4F54'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#4C4F54', 0.22, 26000, 1.6, 0.8); speckle(g, w, h, R, '#5A5D61', 0.1, 900, 4, 0.25);
    g.strokeStyle = '#3A3C40'; g.globalAlpha = 0.35; g.lineWidth = 1.2; for (let i = 0; i < 6; i++){ g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++){ x += (R() - 0.5) * 50; y += (R() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; }),
  sidewalk:() => canvasTex(512, 512, (g, w, h) => { const R = rng(21); g.fillStyle = '#B9B4AA'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#B9B4AA', 0.14, 18000, 1.6, 0.7);
    g.strokeStyle = '#8F8A80'; g.lineWidth = 2; for (let i = 0; i <= 4; i++){ g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); } }),
  granite:() => canvasTex(256, 256, (g, w, h) => { const R = rng(31); g.fillStyle = '#A7A6A3'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#A7A6A3', 0.5, 9000, 1.4, 0.9); speckle(g, w, h, R, '#2B2B2E', 0.1, 1500, 1.2, 0.8); speckle(g, w, h, R, '#E8E4DC', 0.05, 1200, 1.2, 0.8);
    g.strokeStyle = '#6E6D69'; g.lineWidth = 2; for (let i = 0; i <= 2; i++){ g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); } }),
  gutter:() => canvasTex(512, 128, (g, w, h) => { // caniveau deux rangs de pavés de granit (rangs le long de la chaussée)
    const R = rng(41); g.fillStyle = '#4E4D4A'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 2; row++){ let x = row * 30 - 30; while (x < w){ const pw = 52 + R() * 16, col = shadeHex('#9C9A95', (R() - 0.5) * 0.22); g.fillStyle = col; g.fillRect(x + 2, row * h / 2 + 3, pw - 4, h / 2 - 6);
      for (let k = 0; k < 60; k++){ g.fillStyle = shadeHex(col, (R() - 0.5) * 0.4); g.fillRect(x + 2 + R() * (pw - 6), row * h / 2 + 3 + R() * (h / 2 - 8), 2, 2); } x += pw; } } }),
  cobble:() => canvasTex(512, 512, (g, w, h) => { const R = rng(51); g.fillStyle = '#55524D'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32){ let x = (y / 32 % 2) * 16 - 16; while (x < w){ const c = shadeHex('#8D8984', (R() - 0.5) * 0.25); g.fillStyle = c; g.beginPath(); g.roundRect ? g.roundRect(x + 2, y + 2, 28, 28, 5) : g.rect(x + 2, y + 2, 28, 28); g.fill(); x += 32; } } speckle(g, w, h, R, '#8D8984', 0.3, 8000, 1.3, 0.5); }),
  grass:() => canvasTex(512, 512, (g, w, h) => { const R = rng(61); g.fillStyle = '#5E7D3F'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#5E7D3F', 0.22, 40000, 2, 0.7); speckle(g, w, h, R, '#7E9A4E', 0.12, 6000, 3, 0.4); }),
  gravel:() => canvasTex(256, 256, (g, w, h) => { const R = rng(71); g.fillStyle = '#A59C8C'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#A59C8C', 0.35, 14000, 2.2, 0.9); }),
  concrete:() => canvasTex(256, 256, (g, w, h) => { const R = rng(81); g.fillStyle = '#B5B3AE'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#B5B3AE', 0.12, 8000, 2, 0.6); }),
  pavers:() => canvasTex(256, 256, (g, w, h) => { const R = rng(91); g.fillStyle = '#7C776F'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32 % 2) * 32; x < w + 32; x += 64){ g.fillStyle = shadeHex('#A49D93', (R() - 0.5) * 0.15); g.fillRect(x + 1.5, y + 1.5, 61, 29); } speckle(g, w, h, R, '#A49D93', 0.2, 4000, 1.3, 0.5); }),
  roofTiles:() => canvasTex(256, 256, (g, w, h) => { const R = rng(101); g.fillStyle = '#9A4B32'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 21){ for (let x = (y / 21 % 2) * 12; x < w + 24; x += 24){ g.fillStyle = shadeHex('#A6533A', (R() - 0.5) * 0.14); g.beginPath(); g.arc(x, y + 20, 12, Math.PI, 0); g.lineTo(x + 12, y); g.lineTo(x - 12, y); g.fill(); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 19, w, 2); } }),
  roofSlate:() => canvasTex(256, 256, (g, w, h) => { const R = rng(111); g.fillStyle = '#3F4650'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 14 - 14; x < w; x += 28){ g.fillStyle = shadeHex('#4A525C', (R() - 0.5) * 0.12); g.fillRect(x + 1, y + 1, 26, 14); } }),
  roofZinc:() => canvasTex(256, 256, (g, w, h) => { const R = rng(121); g.fillStyle = '#8E959C'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32){ g.fillStyle = '#B4BAC0'; g.fillRect(x, 0, 3, h); g.fillStyle = '#6F767D'; g.fillRect(x + 3, 0, 1.5, h); } speckle(g, w, h, R, '#8E959C', 0.08, 2500, 2, 0.4); }),
  roofFlat:() => canvasTex(256, 256, (g, w, h) => { const R = rng(131); g.fillStyle = '#8A8784'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, '#8A8784', 0.25, 12000, 1.8, 0.8); }),
};
/* façades : une travée (3 m) × un étage (3 m) ; fenêtres, volets, appuis — teinte selon le matériau */
const FACADE_PAL = {
  enduit:['#E9DFC9', '#EFE7D6', '#E3D3B5', '#DCCDB0', '#F2EEE6', '#D9C7A6', '#E8D9C0', '#CFC3AE'], pierre:['#D6C8AE', '#CDBE9F', '#E0D4BC'], meuliere:['#B8955F', '#A88655'],
  beton:['#C8C6C2', '#B9B7B3', '#D3D1CC'], brique:['#A0573D', '#B06446', '#8E4C36'], agglo:['#C9C3B8', '#BEB8AD'], bois:['#8E6A48', '#A37B54'],
};
const SHUTTER = ['#5E7C8A', '#7E9C83', '#E6E0D2', '#7A3B2E', '#3F5E8C', '#B4A88E', '#6D7F57'];
/* façade : 3 cartes dessinées ensemble — couleur, relief (hauteur → normales) et matière (vitres lisses et réfléchissantes) */
function facadeSet(kind, seed, shop){
  const key = `facset|${kind}|${seed}|${shop ? 1 : 0}`; if (TEX[key]) return TEX[key];
  const S = 256, cC = document.createElement('canvas'), cH = document.createElement('canvas'), cM = document.createElement('canvas'); for (const c of [cC, cH, cM]){ c.width = c.height = S; }
  const gC = cC.getContext('2d'), gH = cH.getContext('2d'), gM = cM.getContext('2d');
  const R = rng(hashStr(key)), pal = FACADE_PAL[kind] || FACADE_PAL.enduit, base = pal[Math.floor(R() * pal.length)], sh = SHUTTER[Math.floor(R() * SHUTTER.length)], vol = R() < (kind === 'beton' ? 0.15 : 0.6), bal = R() < 0.25, deep = kind === 'pierre' || kind === 'meuliere' ? 1 : 0.7;
  // r(x, y, w, h, couleur, hauteur 0..255, matière : 0 mur, 1 vitre, 2 métal)
  const r = (x, y, w, h, col, ht, mt = 0) => { gC.fillStyle = col; gC.fillRect(x, y, w, h); if (ht != null){ gH.fillStyle = `rgb(${ht},${ht},${ht})`; gH.fillRect(x, y, w, h); } gM.fillStyle = mt === 1 ? 'rgb(255,20,200)' : mt === 2 ? 'rgb(255,90,160)' : 'rgb(255,235,0)'; gM.fillRect(x, y, w, h); };
  r(0, 0, S, S, base, 140);
  if (kind === 'brique'){ for (let y = 0; y < S; y += 8) for (let x = (y / 8 % 2) * 10 - 10; x < S; x += 20){ gC.fillStyle = shadeHex(base, (R() - 0.5) * 0.14); gC.fillRect(x + 1, y + 1, 18, 6); gH.fillStyle = 'rgb(146,146,146)'; gH.fillRect(x + 1, y + 1, 18, 6); } }
  else if (kind === 'pierre' || kind === 'meuliere'){ for (let y = 0; y < S; y += 22){ let x = (y / 22 % 2) * 20 - 30; while (x < S){ const bw = 30 + R() * 24; gC.fillStyle = shadeHex(base, (R() - 0.5) * 0.12); gC.fillRect(x + 1, y + 1, bw - 2, 20); gH.fillStyle = 'rgb(152,152,152)'; gH.fillRect(x + 1, y + 1, bw - 2, 20); x += bw; } } }
  else { for (let i = 0; i < 5000; i++){ gC.globalAlpha = 0.5 * R(); gC.fillStyle = shadeHex(base, (R() - 0.5) * 0.08); const s2 = 2 * (0.5 + R()); const x = R() * S, y = R() * S; gC.fillRect(x, y, s2, s2); } gC.globalAlpha = 1; }
  if (shop){ // rez-de-chaussée commercial : vitrine en retrait, enseigne, porte
    r(10, 40, S - 20, S - 40, shadeHex(base, -0.35), 120);
    const gl = gC.createLinearGradient(0, 50, 0, S); gl.addColorStop(0, '#2C3640'); gl.addColorStop(1, '#55636E'); gC.fillStyle = gl; gC.fillRect(18, 52, S - 36, S - 60); gH.fillStyle = 'rgb(70,70,70)'; gH.fillRect(18, 52, S - 36, S - 60); gM.fillStyle = 'rgb(255,20,200)'; gM.fillRect(18, 52, S - 36, S - 60);
    r(126, 52, 4, S - 60, '#2A2E33', 110, 2); r(10, 18, S - 20, 22, SHUTTER[Math.floor(R() * SHUTTER.length)], 175);
  } else {
    const ww = 92, wh = 150, x = (S - ww) / 2, y = 44;
    r(x - 8, y - 8, ww + 16, wh + 18, shadeHex(base, -0.18), 150);               // encadrement en saillie
    r(x - 3, y - 3, ww + 6, wh + 6, '#F4F2EE', Math.round(110 * deep));          // dormant
    const gl = gC.createLinearGradient(0, y, 0, y + wh); gl.addColorStop(0, '#3A4652'); gl.addColorStop(1, '#6E7F8C'); gC.fillStyle = gl; gC.fillRect(x, y, ww, wh); gH.fillStyle = `rgb(${Math.round(70 * deep)},${Math.round(70 * deep)},${Math.round(70 * deep)})`; gH.fillRect(x, y, ww, wh); gM.fillStyle = 'rgb(255,20,200)'; gM.fillRect(x, y, ww, wh);
    r(x + ww / 2 - 2, y, 4, wh, '#F4F2EE', 95); r(x, y + wh * 0.33, ww, 3, '#F4F2EE', 95); r(x, y + wh * 0.66, ww, 3, '#F4F2EE', 95);
    r(x - 10, y + wh + 6, ww + 20, 7, shadeHex(base, -0.25), 200);             // appui de fenêtre
    if (vol){ for (const sx of [x - 48, x + ww + 6]){ r(sx, y - 2, 42, wh + 4, sh, 165); for (let k = 0; k < wh; k += 12){ gC.fillStyle = 'rgba(0,0,0,.18)'; gC.fillRect(sx, y + k, 42, 2); gH.fillStyle = 'rgb(150,150,150)'; gH.fillRect(sx, y + k, 42, 2); } } }
    if (bal){ gC.strokeStyle = '#22262B'; gC.lineWidth = 3; gC.strokeRect(x - 10, y + wh * 0.62, ww + 20, wh * 0.38); gH.strokeStyle = 'rgb(200,200,200)'; gH.lineWidth = 3; gH.strokeRect(x - 10, y + wh * 0.62, ww + 20, wh * 0.38);
      for (let k = x - 6; k < x + ww + 10; k += 8){ gC.beginPath(); gC.moveTo(k, y + wh * 0.62); gC.lineTo(k, y + wh); gC.stroke(); gH.beginPath(); gH.moveTo(k, y + wh * 0.62); gH.lineTo(k, y + wh); gH.stroke(); } }
    r(0, S - 5, S, 5, shadeHex(base, -0.06), 150);                               // cordon d'étage
  }
  // relief → carte de normales (Sobel)
  const hd = gH.getImageData(0, 0, S, S).data, nC = document.createElement('canvas'); nC.width = nC.height = S; const gN = nC.getContext('2d'), nd = gN.createImageData(S, S), hv = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){ const dx = (hv(x + 1, y) - hv(x - 1, y)) * 3.2, dy = (hv(x, y + 1) - hv(x, y - 1)) * 3.2, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
    nd.data[k] = (-dx / l * 0.5 + 0.5) * 255; nd.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[k + 3] = 255; }
  gN.putImageData(nd, 0, 0);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return TEX[key] = {map:mk(cC, true), normal:mk(nC, false), orm:mk(cM, false)};   // orm : g = rugosité, b = métal (canaux three.js)
}
function facadeTex(kind, seed, shop){ return facadeSet(kind, seed, shop).map; }
function facadeMat(kind, seed, shop){ const key = `facmat|${kind}|${seed}|${shop ? 1 : 0}`; if (MAT[key]) return MAT[key]; const F = facadeSet(kind, seed, shop);
  return MAT[key] = new THREE.MeshStandardMaterial({map:F.map, normalMap:F.normal, normalScale:new THREE.Vector2(1.1, 1.1), roughnessMap:F.orm, metalnessMap:F.orm, roughness:1, metalness:1, side:THREE.DoubleSide}); }
function tex(name){ // texture courante (procédurale, puis photo dès qu'elle est chargée)
  if (TEX[name]) return TEX[name];
  const t = PROC[name] ? PROC[name]() : PROC.concrete(); TEX[name] = t; const r = texRep(name); t.repeat.set(1 / r[0], 1 / r[1]);
  if (texOpts.photo && PH[name]) loadPhoto(name);
  return t;
}
const PHOTO = {};
function loadPhoto(name){
  if (PHOTO[name]) return; PHOTO[name] = 'loading';
  const P = PH[name], img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
  img.onload = () => { const t = TEX[name]; if (!t) return; t.image = img; t.userData.photo = true; t.needsUpdate = true; PHOTO[name] = 'ok'; TEX_LISTENERS.forEach(f => f(name)); };
  img.onerror = () => { PHOTO[name] = 'err'; };
  img.src = `${PH_BASE}${P.id}/${P.id}_diff_1k.jpg`;
}
const REP = {granite:[2, 2], gutter:[1.2, 0.3], roofFlat:[4, 4]};
const texRep = name => REP[name] || [PH[name]?.rep || 3, PH[name]?.rep || 3];
/* matériaux partagés */
const MAT = {};
function matTex(name, opts = {}){
  const key = 'tx|' + name + '|' + JSON.stringify(opts); if (MAT[key]) return MAT[key];
  const t = tex(name), m = new THREE.MeshStandardMaterial({map:t, roughness:opts.rough ?? 0.92, metalness:0, color:opts.color ?? 0xffffff, polygonOffset:!!opts.po, polygonOffsetFactor:opts.po || 0, polygonOffsetUnits:opts.po || 0, side:opts.side ?? THREE.FrontSide});
  m.userData.texName = name; return MAT[key] = m;
}
function matCol(color, opts = {}){
  const key = 'c|' + color + '|' + JSON.stringify(opts); if (MAT[key]) return MAT[key];
  if (opts.basic) return MAT[key] = new THREE.MeshBasicMaterial({color, transparent:!!opts.opacity, opacity:opts.opacity ?? 1, polygonOffset:!!opts.po, polygonOffsetFactor:opts.po || 0, polygonOffsetUnits:opts.po || 0, side:opts.side ?? THREE.FrontSide, depthWrite:opts.depthWrite ?? true});
  return MAT[key] = new THREE.MeshStandardMaterial({color, roughness:opts.rough ?? 0.85, metalness:opts.metal ?? 0, transparent:!!opts.opacity, opacity:opts.opacity ?? 1, polygonOffset:!!opts.po, polygonOffsetFactor:opts.po || 0, polygonOffsetUnits:opts.po || 0, side:opts.side ?? THREE.FrontSide, emissive:opts.emissive ?? 0x000000, emissiveIntensity:opts.ei ?? 1, depthWrite:opts.depthWrite ?? true, flatShading:!!opts.flat, vertexColors:!!opts.vc});
}
