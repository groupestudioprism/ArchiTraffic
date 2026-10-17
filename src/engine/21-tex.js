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
/* ---------- typologie française des façades ----------
   Une texture = une travée de 3 m × un étage de 3 m. Trois cartes dessinées ensemble : couleur, relief (→ normales), matière (vitres).
   Types : haus (immeuble haussmannien en pierre de taille), immeuble (immeuble ancien enduit, faubourg), mod (immeuble 1950-1980, béton),
   recent (logement collectif récent), pav (pavillon / maison individuelle), brique (maison de ville du Nord), pierre (bâti rural, granite ou calcaire),
   ind (bâtiment d'activité, bardage), eglise (édifice religieux), annexe (garage, abri). Palettes selon la région. */
const REGION_PAL = {
  idf:{enduit:['#E6DCC6', '#EDE4D2', '#DCCFB4', '#E9E1D0'], pierre:['#E3D6BC', '#DCCDAE', '#E8DDC6'], volet:['#E9E5DA', '#B9B4A6', '#55606A', '#7E8A80']},
  nord:{enduit:['#E7E2D8', '#D9D3C6'], pierre:['#B9B1A0'], brique:['#9A4A33', '#A3533A', '#8B4130', '#B0603F'], volet:['#F0EEE8', '#3B4A3E', '#24364F']},
  bzh:{enduit:['#F2F0EA', '#ECE9E1', '#E4E0D6'], pierre:['#9C9890', '#A8A399', '#8E8A82'], volet:['#2C5A86', '#3E6E4A', '#F2F0EA', '#A33A2E']},
  sud:{enduit:['#E8C9A0', '#E3B98F', '#D9A982', '#EAD2B0', '#E9C1A8', '#F0DCC0'], pierre:['#D9C6A3', '#CDB894'], volet:['#6E8F7C', '#7FA0B5', '#B45F3E', '#D8C49A', '#5F7E9C']},
  est:{enduit:['#E9DDB8', '#D9E2D0', '#E7CFC4', '#F0E6C8', '#D6DDE6'], pierre:['#C9A890', '#BE9C84'], volet:['#4E6E52', '#7A4E36', '#E9E5DA']},
  centre:{enduit:['#E9DFC9', '#EFE7D6', '#E3D3B5', '#DCCDB0', '#F2EEE6'], pierre:['#D6C8AE', '#CDBE9F', '#E0D4BC'], volet:['#5E7C8A', '#7E9C83', '#E6E0D2', '#7A3B2E', '#B4A88E']},
};
function frRegion(lat, lon){ if (lat > 48.45 && lat < 49.3 && lon > 1.6 && lon < 3.4) return 'idf'; if (lat > 49.75) return 'nord'; if (lon < -1.0 && lat > 47.0) return 'bzh'; if (lat < 44.9) return 'sud'; if (lon > 5.6 && lat > 47.4) return 'est'; return 'centre'; }
function facadeSet(kind, seed, shop, region = 'centre'){
  const key = `facset|${kind}|${seed}|${shop ? 1 : 0}|${region}`; if (TEX[key]) return TEX[key];
  const S = 256, cC = document.createElement('canvas'), cH = document.createElement('canvas'), cM = document.createElement('canvas'); for (const c of [cC, cH, cM]){ c.width = c.height = S; }
  const gC = cC.getContext('2d'), gH = cH.getContext('2d', {willReadFrequently:true}), gM = cM.getContext('2d'), R = rng(hashStr(key)), RP = REGION_PAL[region] || REGION_PAL.centre, pick = a => a[Math.floor(R() * a.length)];
  const r = (x, y, w, h, col, ht, mt = 0) => { gC.fillStyle = col; gC.fillRect(x, y, w, h); if (ht != null){ gH.fillStyle = `rgb(${ht},${ht},${ht})`; gH.fillRect(x, y, w, h); } gM.fillStyle = mt === 1 ? 'rgb(255,18,210)' : mt === 2 ? 'rgb(255,90,170)' : 'rgb(255,235,0)'; gM.fillRect(x, y, w, h); };
  const noise = (base, n = 5000, a = 0.08) => { for (let i = 0; i < n; i++){ gC.globalAlpha = 0.45 * R(); gC.fillStyle = shadeHex(base, (R() - 0.5) * a); const z = 2 * (0.5 + R()); gC.fillRect(R() * S, R() * S, z, z); } gC.globalAlpha = 1; };
  const glass = (x, y, w, h, deep = 70) => { const gl = gC.createLinearGradient(0, y, 0, y + h); gl.addColorStop(0, '#2E3A45'); gl.addColorStop(0.55, '#4F5F6C'); gl.addColorStop(1, '#6C7C88'); gC.fillStyle = gl; gC.fillRect(x, y, w, h); gH.fillStyle = `rgb(${deep},${deep},${deep})`; gH.fillRect(x, y, w, h); gM.fillStyle = 'rgb(255,18,210)'; gM.fillRect(x, y, w, h);
    gC.fillStyle = 'rgba(255,255,255,.13)'; gC.beginPath(); gC.moveTo(x + 4, y + 4); gC.lineTo(x + w * 0.35, y + 4); gC.lineTo(x + 4, y + h * 0.45); gC.fill(); };
  const sash = (x, y, w, h, col = '#F3F1EC', bars = 3) => { glass(x, y, w, h); r(x + w / 2 - 2, y, 4, h, col, 95); for (let k = 1; k < bars; k++) r(x, y + h * k / bars - 1.5, w, 3, col, 95); };
  const rail = (x, y, w, h, col = '#1E2226') => { gC.strokeStyle = col; gH.strokeStyle = 'rgb(205,205,205)'; for (const g of [gC, gH]){ g.lineWidth = 3; g.strokeRect(x, y, w, h); g.lineWidth = 2; for (let k = x + 5; k < x + w; k += 7){ g.beginPath(); g.moveTo(k, y); g.lineTo(k, y + h); g.stroke(); } } };
  const shutters = (x, y, w, h, col) => { for (const sx of [x - w * 0.5 - 4, x + w + 4]){ r(sx, y - 2, w * 0.5, h + 4, col, 168); for (let k = 0; k < h; k += 11){ gC.fillStyle = 'rgba(0,0,0,.16)'; gC.fillRect(sx, y + k, w * 0.5, 2); } } };
  let base;
  switch (kind){
    case 'haus': { // pierre de taille, refends, hautes fenêtres à garde-corps, cordon
      base = pick(RP.pierre || REGION_PAL.idf.pierre); r(0, 0, S, S, base, 140); noise(base, 3000, 0.06);
      for (let y = 0; y < S; y += 32){ r(0, y, S, 2, shadeHex(base, -0.12), 120); } for (let y = 0; y < S; y += 32) for (let x = ((y / 32) % 2) * 64; x < S; x += 128) r(x, y, 2, 32, shadeHex(base, -0.1), 122);
      if (shop){ r(0, 0, S, S, shadeHex(base, -0.04), 140); glass(20, 36, S - 40, S - 46, 60); r(S / 2 - 3, 36, 6, S - 46, '#22272C', 110, 2); r(14, 10, S - 28, 24, '#1F2A33', 175); r(0, S - 10, S, 10, shadeHex(base, -0.15), 160); break; }
      const ww = 96, wh = 178, x = (S - ww) / 2, y = 38; r(x - 14, y - 14, ww + 28, wh + 20, shadeHex(base, 0.04), 160); r(x - 14, y - 26, ww + 28, 12, shadeHex(base, -0.05), 185);
      sash(x, y, ww, wh, '#EFEDE7', 4); rail(x - 4, y + wh * 0.62, ww + 8, wh * 0.38); r(0, S - 12, S, 12, shadeHex(base, -0.08), 175); break; }
    case 'immeuble': { // immeuble ancien enduit (faubourg), encadrements, volets persiennés
      base = pick(RP.enduit); r(0, 0, S, S, base, 140); noise(base);
      if (shop){ r(10, 40, S - 20, S - 40, shadeHex(base, -0.35), 120); glass(18, 52, S - 36, S - 60); r(10, 18, S - 20, 22, pick(RP.volet), 175); break; }
      const ww = 88, wh = 150, x = (S - ww) / 2, y = 46; r(x - 10, y - 10, ww + 20, wh + 18, shadeHex(base, 0.06), 152); sash(x, y, ww, wh); r(x - 12, y + wh + 6, ww + 24, 8, shadeHex(base, -0.2), 200);
      if (R() < 0.8) shutters(x, y, ww, wh, pick(RP.volet)); if (R() < 0.3) rail(x, y + wh * 0.6, ww, wh * 0.4); r(0, S - 6, S, 6, shadeHex(base, -0.06), 150); break; }
    case 'mod': { // immeuble 1950-1980 : béton, fenêtres en bande, allèges en panneaux
      base = pick(['#CFCBC3', '#D8D4CC', '#C6C3BC', '#DDD8CC']); r(0, 0, S, S, base, 140); noise(base, 4000, 0.1);
      if (shop){ glass(0, 40, S, S - 50); r(0, 18, S, 22, '#3B444C', 170); break; }
      r(0, 150, S, 70, shadeHex(base, R() < 0.5 ? -0.1 : 0.06), 150); glass(8, 52, S - 16, 92, 80); for (const xx of [8, S / 3, 2 * S / 3, S - 12]) r(xx, 52, 4, 92, '#9AA1A6', 100, 2);
      r(0, 144, S, 6, '#B9B5AD', 190); for (let x = 0; x < S; x += 64) r(x, 150, 2, 70, shadeHex(base, -0.18), 120); if (R() < 0.35) rail(14, 104, S - 28, 40, '#5A6168'); break; }
    case 'recent': { // logement récent : enduit clair, bardage bois ou zinc, grandes baies, garde-corps vitrés
      base = pick(['#F1F0EC', '#E7E5DF', '#ECE8DE', '#DCDAD5']); r(0, 0, S, S, base, 140); noise(base, 2500, 0.05);
      if (R() < 0.4){ const bc = pick(['#8C6B4B', '#6E7378', '#A07C55']); r(0, 0, 70, S, bc, 145); for (let x = 0; x < 70; x += 9) r(x, 0, 2, S, shadeHex(bc, -0.2), 135); }
      if (shop){ glass(0, 30, S, S - 40); break; }
      glass(96, 40, 130, 186, 66); r(96, 40, 130, 4, '#3A3F44', 110, 2); r(160, 40, 3, 186, '#3A3F44', 105, 2); r(92, 168, 138, 58, 'rgba(180,200,210,.35)', 120, 1); r(92, 166, 138, 4, '#5A6168', 190, 2); break; }
    case 'pav': { // pavillon : enduit gratté, fenêtre à volets battants, appui
      base = pick(RP.enduit); r(0, 0, S, S, base, 140); noise(base, 7000, 0.12);
      const ww = 78, wh = 110, x = (S - ww) / 2, y = 70; r(x - 6, y - 6, ww + 12, wh + 10, shadeHex(base, 0.07), 150); sash(x, y, ww, wh, '#F4F2EE', 3); r(x - 10, y + wh + 4, ww + 20, 8, shadeHex(base, -0.18), 200); shutters(x, y, ww, wh, pick(RP.volet)); break; }
    case 'brique': { // maison de ville en brique (Nord), linteaux clairs
      base = pick(RP.brique || REGION_PAL.nord.brique); r(0, 0, S, S, '#C9C2B6', 135);
      for (let y = 0; y < S; y += 8) for (let x = ((y / 8) % 2) * 10 - 10; x < S; x += 20){ gC.fillStyle = shadeHex(base, (R() - 0.5) * 0.16); gC.fillRect(x + 1, y + 1, 18, 6); gH.fillStyle = 'rgb(148,148,148)'; gH.fillRect(x + 1, y + 1, 18, 6); }
      if (shop){ glass(18, 52, S - 36, S - 60); r(10, 20, S - 20, 26, '#2B3A2E', 175); break; }
      const ww = 80, wh = 150, x = (S - ww) / 2, y = 46; r(x - 8, y - 16, ww + 16, 14, '#E9E4DA', 175); sash(x, y, ww, wh, '#F4F2EE', 3); r(x - 10, y + wh + 4, ww + 20, 8, '#E2DDD2', 200); break; }
    case 'pierre': { // bâti rural / bourg : moellons de granite ou calcaire, petites ouvertures
      base = pick(RP.pierre); r(0, 0, S, S, shadeHex(base, -0.15), 125);
      for (let y = 0; y < S; y += 20){ let x = -((y * 7) % 30); while (x < S){ const bw = 22 + R() * 30, bh = 16 + R() * 3; gC.fillStyle = shadeHex(base, (R() - 0.5) * 0.18); gC.beginPath(); gC.roundRect ? gC.roundRect(x + 1, y + 1, bw - 2, bh, 4) : gC.rect(x + 1, y + 1, bw - 2, bh); gC.fill(); gH.fillStyle = `rgb(${150 + (R() * 18 | 0)},${150},${150})`; gH.fillRect(x + 2, y + 2, bw - 4, bh - 2); x += bw; } }
      const ww = 64, wh = 100, x = (S - ww) / 2, y = 80; r(x - 10, y - 14, ww + 20, 14, shadeHex(base, 0.1), 180); sash(x, y, ww, wh, '#EDEBE5', 2); shutters(x, y, ww, wh, pick(RP.volet)); break; }
    case 'ind': { // bâtiment d'activité : bardage métallique nervuré, bandeau vitré haut
      base = pick(['#B9BEC2', '#9DA6AD', '#C9CCC8', '#7F8C8D', '#D4D6D2', '#5C6B78']); r(0, 0, S, S, base, 140);
      for (let x = 0; x < S; x += 16){ r(x, 0, 5, S, shadeHex(base, 0.08), 175, 2); r(x + 5, 0, 2, S, shadeHex(base, -0.12), 120, 2); }
      if (seed % 2) glass(0, 10, S, 34, 90); if (shop) { r(40, 60, 176, 196, '#5D666E', 120, 2); for (let y = 66; y < S; y += 14) r(44, y, 168, 3, '#4A525A', 110, 2); } break; }
    case 'eglise': { // pierre de taille, baie en plein cintre
      base = pick(REGION_PAL.centre.pierre); r(0, 0, S, S, base, 140); for (let y = 0; y < S; y += 28) r(0, y, S, 2, shadeHex(base, -0.14), 120); for (let y = 0; y < S; y += 28) for (let x = ((y / 28) % 2) * 40; x < S; x += 80) r(x, y, 2, 28, shadeHex(base, -0.12), 120);
      const x = 98, w = 60; gC.fillStyle = '#3A4350'; gC.beginPath(); gC.moveTo(x, 210); gC.lineTo(x, 90); gC.arc(x + w / 2, 90, w / 2, Math.PI, 0); gC.lineTo(x + w, 210); gC.fill(); gH.fillStyle = 'rgb(70,70,70)'; gH.fillRect(x, 60, w, 150); gM.fillStyle = 'rgb(255,18,210)'; gM.fillRect(x, 60, w, 150); break; }
    default: { // annexe
      base = pick(['#CFCAC0', '#BEB8AE', '#D8D2C6']); r(0, 0, S, S, base, 140); noise(base, 5000, 0.12); if (seed % 2){ r(40, 70, 176, 186, '#8D949A', 150, 2); for (let y = 76; y < S; y += 12) r(44, y, 168, 3, '#6F767C', 125, 2); } }
  }
  // relief → normales (Sobel)
  const hd = gH.getImageData(0, 0, S, S).data, nC = document.createElement('canvas'); nC.width = nC.height = S; const gN = nC.getContext('2d'), nd = gN.createImageData(S, S), hv = (x, y) => hd[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){ const dx = (hv(x + 1, y) - hv(x - 1, y)) * 3.2, dy = (hv(x, y + 1) - hv(x, y - 1)) * 3.2, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
    nd.data[k] = (-dx / l * 0.5 + 0.5) * 255; nd.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[k + 3] = 255; }
  gN.putImageData(nd, 0, 0);
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return TEX[key] = {map:mk(cC, true), normal:mk(nC, false), orm:mk(cM, false)};
}
function facadeTex(kind, seed, shop, region){ return facadeSet(kind, seed, shop, region).map; }
function facadeMat(kind, seed, shop, region){ const key = `facmat|${kind}|${seed}|${shop ? 1 : 0}|${region}`; if (MAT[key]) return MAT[key]; const F = facadeSet(kind, seed, shop, region);
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
