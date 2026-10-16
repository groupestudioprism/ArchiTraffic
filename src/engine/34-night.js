/* ============ Vue de nuit ============
   Ciel nocturne, lune froide, éclairage public (halo au sol sous chaque lampadaire), feux et panneaux rétroréfléchissants
   qui ressortent : pour vérifier la visibilité de la signalisation temporaire de nuit. */
let nightSky = null, nightGlow = null, glowT = null;
const isNight = () => !!DISPLAY.night && view !== '2d' && !planLook();
function nightSkyTex(){ const cv = document.createElement('canvas'); cv.width = 16; cv.height = 512; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#04070F'); gr.addColorStop(0.5, '#0B1426'); gr.addColorStop(0.66, '#1B2740'); gr.addColorStop(0.72, '#2A2C38'); gr.addColorStop(1, '#0B0C10'); g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping; return t; }
function glowTex(){ const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.35, 'rgba(255,190,120,0.4)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
function applyNight(){
  const on = isNight();
  if (nightGlow){ nightGlow.parent?.remove(nightGlow); nightGlow.geometry.dispose(); nightGlow = null; }
  for (const k in MAT) if (k.startsWith('face|')) MAT[k].emissiveIntensity = on ? 0.55 : 0.08;   // films rétroréfléchissants : bien visibles dans les phares
  if (!on) return;
  nightSky ??= nightSkyTex(); scene.background = nightSky; scene.fog = new THREE.Fog(0x0B1020, FOGR[0] * 0.6, FOGR[1] * 0.8); scene.environment = null;
  hemi.intensity = 0.18; hemi.color.set(0x8FA6D8); sun.intensity = 0.25; sun.color.set(0xA9C1FF); renderer.toneMappingExposure = 1.15;
  // halos d'éclairage public au sol, sous chaque lampadaire
  let lamps = null; worldGroup.traverse(o => { if (o.name === 'Lampadaires') lamps = o; }); if (!lamps) return;
  const n = lamps.count, plane = new THREE.PlaneGeometry(1, 1); plane.rotateX(-Math.PI / 2); glowT ??= glowTex();
  const im = new THREE.InstancedMesh(plane, new THREE.MeshBasicMaterial({map:glowT, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}), n), m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++){ lamps.getMatrixAt(i, m4); m4.decompose(p, q, s); m4.compose(new THREE.Vector3(p.x, p.y + 0.15, p.z), new THREE.Quaternion(), new THREE.Vector3(16, 1, 16)); im.setMatrixAt(i, m4); }
  im.renderOrder = 3; im.name = 'Éclairage public (nuit)'; nightGlow = im; worldGroup.add(im);
}
