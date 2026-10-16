/* ============ Scène 3D, caméras, lumière, styles d'affichage ============ */
const canvas = $('#c'), vpEl = $('#vp');
const isNarrow = matchMedia('(max-width: 860px)');
/* tablettes et téléphones : écrans à 2-3 px par point mais GPU modestes → profil « basse consommation » :
   résolution plafonnée, pas d'anticrénelage matériel, ombres simples et désactivées par défaut, moins de véhicules simulés */
const LOWPOW = (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) || (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2 || /iPad|Android|Mobile/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/* qualité graphique réglable (Calques → Qualité graphique) ; « Auto » = Économie sur tablette/téléphone, Élevée sinon */
const GFX_PRESETS = {
  eco:{n:'Économie', pr:1, prLow:0.7, aa:false, shadows:false, sh:1024, soft:false, ground:2048, cap:150, fps:30},
  std:{n:'Équilibrée', pr:1.5, prLow:0.9, aa:true, shadows:true, sh:1024, soft:false, ground:2048, cap:250, fps:60},
  high:{n:'Élevée', pr:2, prLow:1.25, aa:true, shadows:true, sh:2048, soft:true, ground:4096, cap:360, fps:60}};
let GFXQ = (() => { try { return JSON.parse(localStorage.getItem('at.display') || '{}').gfx || 'auto'; } catch(e){ return 'auto'; } })();
const GFX = () => GFX_PRESETS[GFXQ === 'auto' ? (LOWPOW ? 'eco' : 'high') : GFXQ] || GFX_PRESETS.high;
document.documentElement.classList.toggle('gfx-eco', GFX() === GFX_PRESETS.eco);
const renderer = new THREE.WebGLRenderer({canvas, antialias:GFX().aa, powerPreference:'high-performance', preserveDrawingBuffer:false, logarithmicDepthBuffer:false});
renderer.debug.checkShaderErrors = false;   // shaders connus : on ne bloque pas sur le journal de compilation de chaque shader (chargements plus rapides)
renderer.setPixelRatio(Math.min(devicePixelRatio, GFX().pr));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = GFX().soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const persp = new THREE.PerspectiveCamera(45, 1, 0.3, 6000);
const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -2000, 3000);
persp.position.set(-160, 170, 220); ortho.position.set(0, 1500, 0); ortho.up.set(0, 0, -1);
function camRange(size){ const f = Math.max(6000, size * 1.8); persp.far = f; persp.updateProjectionMatrix(); ortho.near = -Math.max(2000, size); ortho.far = Math.max(3000, size * 1.5); ortho.updateProjectionMatrix(); c3.maxDistance = Math.max(3500, size * 1.3); FOGR = [Math.max(900, size * 0.45), Math.max(2600, size * 1.4)]; if (scene.fog){ scene.fog.near = FOGR[0]; scene.fog.far = FOGR[1]; } }
let FOGR = [900, 2600];
const c3 = new OrbitControls(persp, canvas); c3.enableDamping = true; c3.dampingFactor = 0.12; c3.maxPolarAngle = Math.PI * 0.497; c3.minDistance = 2; c3.maxDistance = 3500;
c3.touches = {ONE:THREE.TOUCH.ROTATE, TWO:THREE.TOUCH.DOLLY_PAN}; c3.mouseButtons = {LEFT:THREE.MOUSE.ROTATE, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.PAN}; c3.zoomToCursor = true;
const c2 = new OrbitControls(ortho, canvas); c2.enableRotate = false; c2.screenSpacePanning = true; c2.zoomToCursor = true; c2.minZoom = 0.05; c2.maxZoom = 60; c2.enabled = false;
c2.mouseButtons = {LEFT:THREE.MOUSE.PAN, MIDDLE:THREE.MOUSE.PAN, RIGHT:THREE.MOUSE.PAN}; c2.touches = {ONE:THREE.TOUCH.PAN, TWO:THREE.TOUCH.DOLLY_PAN};
let dirty = true;
[c2, c3].forEach(c => c.addEventListener('change', () => { dirty = true; }));
let view = '3d';   // '2d' plan | '3d' | 'render'
const cam = () => view === '2d' ? ortho : persp;
const ctl = () => view === '2d' ? c2 : c3;

const hemi = new THREE.HemisphereLight(0xEAF2FF, 0x5B5446, 1.1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xFFF4E2, 2.4); sun.castShadow = true;
sun.shadow.mapSize.set(isNarrow.matches ? 1024 : GFX().sh, isNarrow.matches ? 1024 : GFX().sh);
Object.assign(sun.shadow.camera, {left:-120, right:120, top:120, bottom:-120, near:5, far:900}); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);
let pmrem = null, envTex = null;

const worldGroup = new THREE.Group(); worldGroup.name = 'Site';            // terrain, voirie, bâti, arbres (données IGN / OSM)
const projGroup = new THREE.Group(); projGroup.name = 'Chantier';          // éléments du projet (routes barrées, signalisation, engins…)
const simGroup = new THREE.Group(); simGroup.name = 'Trafic';              // véhicules simulés
const previewGroup = new THREE.Group(), markGroup = new THREE.Group();
scene.add(worldGroup, projGroup, simGroup, previewGroup, markGroup);

/* Réglages d'affichage, par appareil */
const DISPLAY = {style:'textured', bg:'', shadows:true, sunAz:215, sunEl:46, lay:{bld:true, trees:true, marks:true, names:true, sidewalks:true, areas:true, terrain:true, walls:true, lamps:true, nets:false, ngf:false, pins:true, oneway:true}};
try { const d = JSON.parse(localStorage.getItem('at.display') || '{}'); Object.assign(DISPLAY, d, {lay:{...DISPLAY.lay, ...(d.lay || {})}}); } catch(e){}
if (!GFX().shadows && !DISPLAY.shadowsUser) DISPLAY.shadows = false;   // tablette : ombres coupées sauf si réactivées dans Calques
const STYLES = {plan:'Plan', textured:'Textures', realistic:'Réaliste', aerial:'Photo aérienne'};
if (!STYLES[DISPLAY.style]) DISPLAY.style = 'textured';
function saveDisplay(){ try { localStorage.setItem('at.display', JSON.stringify(DISPLAY)); } catch(e){} }
const isDarkUI = () => document.documentElement.dataset.theme === 'dark';
const planLook = () => DISPLAY.style === 'plan';
const bgColor = () => DISPLAY.bg || (isDarkUI() ? '#121722' : '#F4F6F9');

function skyTexture(){
  const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#3F79BF'); gr.addColorStop(0.45, '#8DB8E3'); gr.addColorStop(0.62, '#D7E6F2'); gr.addColorStop(0.7, '#E9EEF1'); gr.addColorStop(1, '#C9CEC6');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
let skyTex = null;
function applyThemeToScene(){
  hemi.color.set(0xEAF2FF); sun.color.set(0xFFF4E2);
  const st = DISPLAY.style, real = st === 'realistic' || view === 'render', plan = planLook();
  if (real || st === 'textured' || st === 'aerial'){
    if (!pmrem){ pmrem = new THREE.PMREMGenerator(renderer); envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture; }
    scene.environment = real ? envTex : null;
  } else scene.environment = null;
  if (view !== '2d' && !plan){ skyTex ??= skyTexture(); scene.background = skyTex; scene.fog = new THREE.Fog(isDarkUI() && !real ? 0x1A2130 : 0xDCE6EE, FOGR[0], FOGR[1]); }
  else { scene.background = new THREE.Color(bgColor()); scene.fog = null; }
  renderer.toneMapping = plan ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = real ? 1.05 : 1.0;
  renderer.shadowMap.enabled = DISPLAY.shadows && !plan && view !== '2d';
  sun.castShadow = renderer.shadowMap.enabled;
  hemi.intensity = plan ? 2.2 : real ? 0.55 : 1.15; sun.intensity = plan ? 0.6 : real ? 3.4 : 2.3;
  positionSun(); applyNight(); dirty = true;
}
function positionSun(){
  const az = DISPLAY.sunAz * Math.PI / 180, el = DISPLAY.sunEl * Math.PI / 180, d = 400, t = c3.target;
  sun.target.position.set(t.x, 0, t.z);
  sun.position.set(t.x + d * Math.cos(el) * Math.sin(az), d * Math.sin(el), t.z - d * Math.cos(el) * Math.cos(az));
  const R = clamp(persp.position.distanceTo(c3.target) * 0.9, 60, 320);
  Object.assign(sun.shadow.camera, {left:-R, right:R, top:R, bottom:-R}); sun.shadow.camera.updateProjectionMatrix();
}
c3.addEventListener('change', () => { if (sun.castShadow) positionSun(); });

/* ---------- caméras ---------- */
const W3 = (x, y, z = 0) => new THREE.Vector3(x, z, -y);   // plan (x, y) + altitude → scène
function areaSize(){ return WORLD?.size || state?.site?.size || 400; }
function fit(){
  const S = areaSize(), r = S * 0.55, z0 = WORLD ? H(0, 0) : 0;
  c3.target.set(0, z0, 0); persp.position.set(-r * 0.55, z0 + r * 0.75, r * 0.85); c3.update();
  c2.target.set(0, 0, 0); ortho.position.set(0, 1500, 0); const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600;
  ortho.zoom = clamp(Math.min(w, h) / (S * 1.05), c2.minZoom, c2.maxZoom); ortho.updateProjectionMatrix(); c2.update();
  positionSun(); dirty = true;
}
function camPreset(k){
  if (k === 'fit') return fit();
  if (k === 'top'){ if (view !== '2d') setView('2d'); return; }
  if (view === '2d') setView('3d');
  const t = c3.target.clone();
  if (k === 'street'){ // vue piéton : 1,70 m au-dessus du sol, regard vers la cible
    const dir = persp.position.clone().sub(t); dir.y = 0; if (dir.length() < 1) dir.set(0, 0, 1); dir.normalize();
    const p = t.clone().add(dir.multiplyScalar(28)); const gz = WORLD ? H(p.x, -p.z) : 0; p.y = gz + 1.7; persp.position.copy(p); c3.target.set(t.x, (WORLD ? H(t.x, -t.z) : 0) + 1.5, t.z); c3.update(); dirty = true; return;
  }
  const r = Math.max(60, persp.position.distanceTo(t)); persp.position.copy(t).add(new THREE.Vector3(-0.55, 0.75, 0.85).normalize().multiplyScalar(r)); c3.update(); dirty = true;
}
function frameAt(x, y, r = 60){
  const z = WORLD ? H(x, y) : 0;
  if (view === '2d'){ c2.target.set(x, 0, -y); ortho.position.set(x, 1500, -y); const h = vpEl.clientHeight || 600; ortho.zoom = clamp(h / (r * 2.4), c2.minZoom, c2.maxZoom); ortho.updateProjectionMatrix(); c2.update(); }
  else { const dir = persp.position.clone().sub(c3.target).normalize(); c3.target.set(x, z, -y); persp.position.copy(c3.target).add(dir.multiplyScalar(r * 2.2)); c3.update(); }
  dirty = true;
}
function resize(){
  const w = vpEl.clientWidth, h = vpEl.clientHeight; vpW = w; vpH = h; if (!w || !h) return;
  renderer.setSize(w, h, false); persp.aspect = w / h; persp.updateProjectionMatrix();
  Object.assign(ortho, {left:-w / 2, right:w / 2, top:h / 2, bottom:-h / 2}); ortho.updateProjectionMatrix();
  dirty = true;
}
new ResizeObserver(resize).observe(vpEl);
const tmpV = new THREE.Vector3();
/* taille de la vue mémorisée (mise à jour au redimensionnement) : la relire à chaque point projeté forçait des recalculs */
let vpW = 0, vpH = 0; const vpSize = () => { if (!vpW){ vpW = vpEl.clientWidth; vpH = vpEl.clientHeight; } };
function toScreen(v){ vpSize(); tmpV.copy(v).project(cam()); return [(tmpV.x + 1) / 2 * vpW, (1 - tmpV.y) / 2 * vpH, tmpV.z]; }
/* mètres par pixel (pour régler la taille des symboles en plan) */
function mPerPx(){ if (view === '2d') return 1 / ortho.zoom; const d = persp.position.distanceTo(c3.target); return 2 * d * Math.tan(persp.fov * Math.PI / 360) / (vpEl.clientHeight || 600); }
