await Promise.race([wmReady, sleep(4000)]);   // faces officielles des panneaux chargées avant les premiers rendus
/* ============ Démarrage, vues, boucle de rendu, pont avec le compte et le cloud ============ */
function setView(v){
  const prev = view; view = v === 'render' ? 'render' : v === '2d' ? '2d' : '3d';
  if (view === '2d'){ c3.enabled = false; c2.enabled = true; const t = c3.target; c2.target.set(t.x, 0, t.z); ortho.position.set(t.x, 1500, t.z); if (prev !== '2d'){ const d = persp.position.distanceTo(c3.target); ortho.zoom = clamp((vpEl.clientHeight || 600) / (2 * d * Math.tan(persp.fov * Math.PI / 360)), c2.minZoom, c2.maxZoom); } ortho.updateProjectionMatrix(); c2.update(); }
  else { c2.enabled = false; c3.enabled = true; if (prev === '2d'){ const t = c2.target, z = WORLD ? H(t.x, -t.z) : 0, d = clamp((vpEl.clientHeight || 600) / ortho.zoom / (2 * Math.tan(persp.fov * Math.PI / 360)), 20, 3000), dir = persp.position.clone().sub(c3.target).normalize(); c3.target.set(t.x, z, t.z); persp.position.copy(c3.target).add(dir.multiplyScalar(d)); c3.update(); } }
  document.body.dataset.mode = view; $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === view));
  const wasPlan = planLook(); if (view === 'render' && DISPLAY.style !== 'realistic' && DISPLAY.style !== 'aerial') DISPLAY.style = 'realistic';
  if (view === '2d' && prev !== '2d' && DISPLAY.style === 'realistic') DISPLAY.style = 'textured';
  projGroup.traverse(o => { if (o.userData.planOnly) o.visible = view === '2d'; });
  syncStyleBtns(); applyThemeToScene(); if (wasPlan !== planLook() || planLook() || prev === 'render' || view === 'render') buildWorld(); annoKey = ''; dirty = true;
}
function setStyle(st){ if (!STYLES[st]) return; DISPLAY.style = st; saveDisplay(); syncStyleBtns(); for (const k of Object.keys(MAT)) if (k.startsWith('c|')) { /* couleurs partagées : inchangées */ } applyThemeToScene(); buildWorld(); rebuildProjAll(); }
function rebuildProjAll(){ for (const c of projCache.values()){ projGroup.remove(c.grp); } projCache.clear(); rebuildProj(); }
function syncStyleBtns(){ $$('[data-style]').forEach(b => b.setAttribute('aria-pressed', b.dataset.style === DISPLAY.style)); }
function setTheme(t){ document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light'; try { localStorage.setItem('at.theme', document.documentElement.dataset.theme); } catch(e){} }
window.APTheme = setTheme;
new MutationObserver(() => { applyThemeToScene(); if (planLook()) buildWorld(); }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
$$('[data-mode]').forEach(b => b.addEventListener('click', () => setView(b.dataset.mode)));
$$('[data-style]').forEach(b => b.addEventListener('click', () => setStyle(b.dataset.style)));
$$('[data-cam]').forEach(b => b.addEventListener('click', () => camPreset(b.dataset.cam)));
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$$('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
function syncSnap(){ $$('[data-snap]').forEach(b => b.setAttribute('aria-pressed', !!SNAP[b.dataset.snap])); }
$$('[data-snap]').forEach(b => b.addEventListener('click', () => { SNAP[b.dataset.snap] = !SNAP[b.dataset.snap]; try { localStorage.setItem('at.snap', JSON.stringify(SNAP)); } catch(e){} syncSnap(); }));
$('#simPlay').addEventListener('click', () => SIM.on ? simStop(false) : simStart());
$('#simSpeed').addEventListener('change', e => { SIM.speed = +e.target.value || 1; });
$('#simDens').addEventListener('change', e => { state.sim.dens = +e.target.value; save(); });
$('#simReset').addEventListener('click', () => { const was = SIM.on; simStop(true); if (was) simStart(); });

/* boucle de rendu */
/* résolution adaptative : pendant un mouvement de caméra, rendu à résolution réduite (fluide même avec beaucoup d'éléments) ;
   dès que la vue s'arrête (200 ms), une image pleine résolution est redessinée. La réduction s'ajuste au temps réel d'une image. */
let PR_FULL = Math.min(devicePixelRatio, GFX().pr), prNow = PR_FULL, lastMove = 0, prLow = Math.min(PR_FULL, GFX().prLow), frameMs = 16, lastRender = 0;
/* change la qualité à chaud (seul l'anticrénelage attend le prochain chargement) */
function setGfx(q){ const aa0 = GFX().aa; GFXQ = q; DISPLAY.gfx = q; delete DISPLAY.shadowsUser; const G = GFX();
  DISPLAY.shadows = G.shadows; saveDisplay(); document.documentElement.classList.toggle('gfx-eco', G === GFX_PRESETS.eco); PR_FULL = Math.min(devicePixelRatio, G.pr); prLow = Math.min(PR_FULL, G.prLow); DYN.pr = PR_FULL; setPR(PR_FULL);
  renderer.shadowMap.type = G.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; sun.shadow.mapSize.set(G.sh, G.sh); sun.shadow.map?.dispose(); sun.shadow.map = null;
  if (!SIM.on) SIM.cap = G.cap; applyThemeToScene(); if (WORLD) buildWorld(); rebuildProj?.(); dirty = true;
  toast(`Qualité graphique : ${G.n}${G.aa !== aa0 ? ' — le lissage des bords changera au prochain chargement' : ''}.`, 3500); }
function setPR(pr){ if (Math.abs(pr - prNow) < 0.01) return; prNow = pr; renderer.setPixelRatio(pr); renderer.setSize(vpEl.clientWidth, vpEl.clientHeight, false); }
/* la vue reste sur le site : la cible de la caméra ne sort pas de l'emprise chargée (+ 50 % de marge), la caméra suit le même décalage */
function keepInSite(){
  const c = ctl(), t = c.target, m = WORLD.size * 0.75, x = clamp(t.x, -m, m), z = clamp(t.z, -m, m);
  if (x === t.x && z === t.z) return; const dx = x - t.x, dz = z - t.z; t.x = x; t.z = z; c.object.position.x += dx; c.object.position.z += dz;
}
/* mesure de performance (ATDebug.perf) : temps par poste et par image */
const DYN = {pr:PR_FULL, ema:16, last:0, sh:0}, LBL = {fast:false, t:0, el:document.getElementById('labels')};
for (const c of [c2, c3]) c.addEventListener('change', () => { LBL.t = performance.now(); });   // zoom molette, glisser, rotation
const PERF = {on:false, n:0, sim:0, sig:0, rnd:0, lab:0, tot:0, worst:0, last:0, orbit:0};
function loop(now){
  requestAnimationFrame(loop);
  const P = PERF.on, t0 = P ? performance.now() : 0;
  if (P && PERF.orbit){ const c = ctl(); if (c.object.isPerspectiveCamera){ const o = c.target, v = c.object.position.clone().sub(o); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), PERF.orbit); c.object.position.copy(o).add(v); } }
  simTick(now); const t1 = P ? performance.now() : 0;
  const moved = ctl().update() || (P && PERF.orbit); if (updateSignals()) dirty = true; if (moved && WORLD) keepInSite(); const t2 = P ? performance.now() : 0;
  /* résolution dynamique : on mesure l'intervalle RÉEL entre deux images (temps de la carte graphique compris) ;
     si l'on passe sous ~55 i/s, la résolution baisse un peu, puis remonte dès que la marge revient.
     En mouvement continu (rotation, simulation) on vise 60 i/s ; à l'arrêt complet, une image pleine résolution. */
  const busy = moved || SIM.on || (dirty && now - lastRender < 120);
  if (busy){ const dt = now - (DYN.last || now); DYN.last = now; if (dt > 0 && dt < 200) DYN.ema = DYN.ema * 0.85 + dt * 0.15;
    const tgt = 1000 / GFX().fps; const floor = Math.min(PR_FULL, Math.max(1, PR_FULL * 0.75)); /* jamais d'image floue : au plus -25 % de résolution, et pas sous 1 */ /* vue d'ensemble de toute la ville : on accepte une image moins fine */ if (DYN.ema > tgt * 1.12 && DYN.pr > floor) DYN.pr = Math.max(floor, DYN.pr - 0.06); else if (DYN.ema < tgt * 0.92 && DYN.pr < PR_FULL) DYN.pr = Math.min(PR_FULL, DYN.pr + 0.03);
    if (moved) lastMove = now; setPR(Math.round(DYN.pr * 20) / 20); }
  { const mv = now - Math.max(lastMove, LBL.t) < 300; if (mv !== LBL.fast){ LBL.fast = mv; LBL.el?.classList.toggle('fast', mv); } }
  if (!busy){ DYN.last = 0; if (prNow !== PR_FULL && now - lastMove > 250){ setPR(PR_FULL); dirty = true; } }
  if (!moved && dirty && GFX().fps < 60 && now - lastRender < 1000 / GFX().fps - 2) return;
  let t3 = t2, t4 = t2;
  if (moved || dirty){ const t = performance.now(); lastRender = now; updateLOD(); renderer.shadowMap.autoUpdate = false; if (!busy || (++DYN.sh % 3) === 0) renderer.shadowMap.needsUpdate = true; /* ombres recalculées 1 image sur 3 en mouvement : c'est un 2e dessin complet de la scène */ renderer.render(scene, cam()); t3 = performance.now(); updateLabels(); updateCompass(); t4 = performance.now(); dirty = false;
    if (moved){ frameMs = frameMs * 0.8 + (performance.now() - t) * 0.2; if (frameMs > 22 && prLow > 0.6) prLow = Math.max(0.6, prLow - 0.1); else if (frameMs < 9 && prLow < Math.min(PR_FULL, GFX().prLow)) prLow = Math.min(PR_FULL, prLow + 0.05); } }
  if (P){ PERF.n++; PERF.sim += t1 - t0; PERF.sig += t2 - t1; PERF.rnd += t3 - t2; PERF.lab += t4 - t3; PERF.tot += t4 - t0; if (PERF.last) PERF.worst = Math.max(PERF.worst, now - PERF.last); PERF.last = now; }
}
/* ATDebug.perf(s, orbite) : fait tourner la caméra et renvoie i/s, pire image et ms moyennes par poste */
async function perfRun(sec = 5, orbit = 0.01){
  Object.assign(PERF, {on:true, n:0, sim:0, sig:0, rnd:0, lab:0, tot:0, worst:0, last:0, orbit}); const t0 = performance.now();
  await new Promise(r => setTimeout(r, sec * 1000)); PERF.on = false; PERF.orbit = 0; const el = (performance.now() - t0) / 1000, n = Math.max(1, PERF.n), f = v => Math.round(v / n * 10) / 10;
  const I = renderer.info.render;
  return {fps:Math.round(PERF.n / el), worst:Math.round(PERF.worst), ms:{sim:f(PERF.sim), feux:f(PERF.sig), rendu:f(PERF.rnd), etiquettes:f(PERF.lab), total:f(PERF.tot)}, calls:I.calls, tris:I.triangles, pr:prNow, annos:typeof annos !== 'undefined' ? annos.length : 0, agents:SIM.agents.length, objs:scene.children.length};
}

/* ---------- exemple : rue barrée en centre-ville, déviation et balisage ---------- */
function sample(){ const s = blankState('Exemple · rue barrée'); s.site = {label:'Rue de Saint-Malo, 35000 Rennes', lat:48.11535, lon:-1.68255, size:1000}; s.sampleSetup = true; s.meta = {...s.meta, moa:'Ville de Rennes (exemple)', entreprise:'Entreprise de travaux publics', arrete:'2026-XXX'}; return s; }
function runSampleSetup(){
  if (!state.sampleSetup || !WORLD) return; delete state.sampleSetup;
  let best = null; for (const [ri, r] of NET.roads.entries()){ if (!r.drive || r.cls < 4 || r.cls > 5) continue; for (let k = 0; k + 1 < r.pts.length; k++){ const c = segClosest([0, 0], r.pts[k], r.pts[k + 1]), d = V.len(c.pt); if (!best || d < best.d) best = {ri, k, t:c.t, pt:c.pt, d, r, dir:V.norm(V.sub(r.pts[k + 1], r.pts[k]))}; } }
  if (!best) return;
  const keep = {...TOOLOPT}; Object.assign(TOOLOPT, {closeMode:'total', autoDetour:true, autoSigns:true}); makeClosure(best); Object.assign(TOOLOPT, keep);
  const cl = state.els.find(e => e.t === 'closure'); if (!cl) return;
  edit(() => {
    const mid = plAt(cl.pts, plLen(cl.pts) / 2), n = V.perp(mid.dir), a = Math.atan2(mid.dir[1], mid.dir[0]);
    state.els.push({id:uid8(), t:'obj', k:'pelle', x:mid.pt[0], y:mid.pt[1], a});
    state.els.push({id:uid8(), t:'obj', k:'benne', x:mid.pt[0] + mid.dir[0] * 14, y:mid.pt[1] + mid.dir[1] * 14, a});
    const z = [-9, 9].flatMap(s => [-1, 1].map(t => V.add(V.add(mid.pt, V.mul(mid.dir, s * (t > 0 ? 1 : 1))), V.mul(n, t * 3.2))));
    state.els.push({id:uid8(), t:'zone', name:'Tranchée réseau', pts:[V.add(V.add(mid.pt, V.mul(mid.dir, -12)), V.mul(n, 3)), V.add(V.add(mid.pt, V.mul(mid.dir, 22)), V.mul(n, 3)), V.add(V.add(mid.pt, V.mul(mid.dir, 22)), V.mul(n, -3)), V.add(V.add(mid.pt, V.mul(mid.dir, -12)), V.mul(n, -3))], fence:true});
    state.els.push({id:uid8(), t:'note', x:mid.pt[0] + n[0] * 8, y:mid.pt[1] + n[1] * 8, text:'Tranchée réseau d\'eau\nAccès riverains maintenu', col:'#1565C0'});
  });
  frameAt(cl.pts[0][0], cl.pts[0][1], 90); toast('Exemple prêt : rue barrée, déviation calculée, panneaux et engins posés. Lancez la simulation ▶', 6000);
}

/* ---------- démarrage ---------- */
state = blankState(); applyThemeToScene(); resize(); fit(); setTool('select'); setView('3d'); syncStyleBtns(); syncSnap(); syncUndo(); renderPanel(); renderLegend();
$('#simDens').value = String(state.sim.dens);
requestAnimationFrame(loop);

/* ---------- pont avec le compte et le cloud (script classique) ---------- */
window.APModel = {
  get: () => JSON.stringify(state),
  name: () => state.name,
  sample: () => sample(),
  load(s){
    quiet = true;
    try {
      simStop(true); state = migrate(s); hist.length = 0; redoS.length = 0; sel = null; cancelDraw(); setTool('select'); syncUndo();
      projCache.forEach(c => projGroup.remove(c.grp)); projCache.clear(); $('#simDens').value = String(state.sim.dens);
      $('#projName').textContent = state.name;
      if (state.site?.lat){ WORLD = null; buildWorld(); rebuildProj(); loadSite(false).then(() => { restoreModels(); if (state.sampleSetup) runSampleSetup(); }); }
      else { WORLD = null; buildWorld(); rebuildProj(); fit(); }
      refreshPanel(); renderLegend();
    } finally { quiet = false; }
    if (!state.site) setTimeout(() => { if (!state.site && document.getElementById('home')?.hidden !== false && document.getElementById('auth')?.hidden !== false) openSiteDialog(); }, 400);
  },
  thumb(){
    try { renderer.render(scene, cam()); const src = renderer.domElement; if (!src.width || !src.height) return '';
      const c = document.createElement('canvas'); c.width = 320; c.height = Math.max(120, Math.round(320 * src.height / src.width)); const g = c.getContext('2d'); g.fillStyle = '#EEF3F7'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height); dirty = true; return c.toDataURL('image/jpeg', 0.72); }
    catch(e){ return ''; }
  },
  setUserLib(){},
};
window.dispatchEvent(new Event('ap:ready'));
window.__apReady = true;
(() => { const sp = document.getElementById('splash'); if (!sp) return; if (window.__spHide){ window.__spHide(); return; } const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => { sp.classList.add('done'); setTimeout(() => sp.remove(), 600); }, Math.max(reduce ? 300 : 0, (reduce ? 600 : 3000) - performance.now())); })();
/* accès de diagnostic (console, tests automatiques) */
window.ATDebug = {signPng:(c, p) => signCanvas(c, p || {}, 128).toDataURL(), signCodes:() => Object.keys(SIGNS), objInst:() => objInstGroup.children.map(m => { const M = new THREE.Matrix4(); m.getMatrixAt(0, M); const p = new THREE.Vector3().setFromMatrixPosition(M); return [m.count, Math.round(p.x), Math.round(-p.z), Math.round(p.y), m.visible, m.parent?.visible]; }), azimuth(deg){ const t = c3.target, v = persp.position.clone().sub(t), r = Math.hypot(v.x, v.z), a = deg * Math.PI / 180; persp.position.set(t.x + Math.sin(a) * r, persp.position.y, t.z + Math.cos(a) * r); c3.update(); dirty = true; }, kdPins:() => annos.filter(a => a.go).map(a => ({go:a.go, v:a.kdv, show:a.show})), underGround(n = 300){ // contrôle : chaussées sous le sol affiché (lancer de rayons vertical sur le maillage du terrain)
    const terr = worldGroup.children.find(o => o.userData?.terrain); if (!terr) return null; const roads = worldGroup.children.filter(o => /^Chaussées/.test(o.name) && o.isMesh);
    const ray = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0); let under = 0, tot = 0, worst = 0; const rnd = (k => () => (k = (k * 1664525 + 1013904223) >>> 0) / 4294967296)(7);
    for (const m of roads){ const P = m.geometry.attributes.position, T = P.count / 3; for (let q = 0; q < n / roads.length; q++){ const t = Math.floor(rnd() * T) * 3, a = rnd(), b = rnd() * (1 - a), c = 1 - a - b;
      const x = P.getX(t) * a + P.getX(t + 1) * b + P.getX(t + 2) * c, y = P.getY(t) * a + P.getY(t + 1) * b + P.getY(t + 2) * c, z = P.getZ(t) * a + P.getZ(t + 1) * b + P.getZ(t + 2) * c;
      ray.set(new THREE.Vector3(x, 5000, z), dn); const h = ray.intersectObject(terr, false)[0]; if (!h) continue; tot++; const d = h.point.y - y; if (d > 0.001){ under++; worst = Math.max(worst, d); } } }
    return {tot, under, worst:Math.round(worst * 100) / 100}; }, perf:perfRun, gl(){ let meshes = 0, lines = 0, inst = 0; scene.traverse(o => { if (!o.visible) return; if (o.isInstancedMesh) inst++; else if (o.isMesh) meshes++; else if (o.isLine) lines++; }); renderer.render(scene, cam()); return {...renderer.info.render, ...renderer.info.memory, programs:renderer.info.programs?.length, meshes, lines, inst, pr:renderer.getPixelRatio()}; }, camPos:() => [persp.position.x, persp.position.y, -persp.position.z, c3.target.x, c3.target.y, -c3.target.z, WORLD ? H(persp.position.x, -persp.position.z) : 0].map(v => Math.round(v * 10) / 10), renderPanel:() => renderPanel(), selId:() => sel, sigHeads:() => SIGHEADS?.heads.map(h => [h.p, h.a]), sigSeq:() => SIGHEADS ? Array.from({length:16}, (_, i) => SIGHEADS.heads.map(h => sigState(h.n, h.d, i * 4)).join('')) : null, sigLast:() => SIGHEADS?.last, sigCheck:() => { const g = new Map(); for (const h of SIGHEADS?.heads || []){ const c = sigCtl(h.n); (g.get(c) || g.set(c, []).get(c)).push(h); } return [...g.entries()].map(([c, hs]) => { let run = 0, worst = 0; for (let t = 0; t < 128; t += 0.5){ const allR = hs.every(h => sigState(h.n, h.d, t) !== 'g'); run = allR ? run + 0.5 : 0; worst = Math.max(worst, run); } return {id:c.id, heads:hs.length, nodes:new Set(hs.map(h => h.n.id)).size, worstAllRed:worst}; }); }, simRun:(sec, h = 0.1) => { for (let t = 0; t < sec; t += h){ SIM.budget = performance.now() + 40; simReroute(); simJobs(); simStep(h); if (Math.round(t * 10) % 5 === 0) congRender(); } simRender(); simStatus(); congRender(); dirty = true; }, look:(px, py, pz, tx, ty, tz) => { setView('3d'); persp.position.set(px, H(px, py) + pz, -py); c3.target.set(tx, H(tx, ty) + tz, -ty); c3.update(); dirty = true; }, meshes:() => worldGroup.children.map(o => [o.name, o.geometry?.attributes?.position?.count || 0, o.count]), annos:() => annos.slice(0, 3).map(a => ({xy:a.xy, z:a.z, street:a.street, s:toScreen(W3(a.xy[0], a.xy[1], (WORLD ? H(a.xy[0], a.xy[1]) : 0) + a.z))})), cams:() => ({zoom:ortho.zoom, mpp:mPerPx(), view, top:ortho.top, bottom:ortho.bottom}), state:() => state, world:() => WORLD, net:() => NET, sim:() => SIM, setView, setStyle, setTool, frameAt, loadSite, makeClosure, nearestRoad, sectionAt, route, closedSets, proposeDetours, buildWorld, rebuildProj, parseWorld, buildNet, exportPNG, exportGLB, exportCSV, exportGeoJSON, loadGLB:u => new GLTFLoader().loadAsync(u), LIB, LIBK, libThumb, toolopt:TOOLOPT, loadBDTopo, rebuild:() => { rebuildProj?.(); dirty = true; }, THUMBS, renderPreview,
  toScreen:(x, y) => { const [sx, sy] = toScreen(W3(x, y, WORLD ? H(x, y) : 0)); const r = canvas.getBoundingClientRect(); return [r.left + sx, r.top + sy]; }, setWorldRaw:async (raw, site) => { const P = makeProj(site.lat, site.lon), W = parseWorld(raw, P, site.size); camRange(site.size); const z = Float32Array.from(raw.elev.z), N = raw.elev.N; const elev2 = raw.elev2 ? {N:raw.elev2.N, S:raw.elev2.S, z:Float32Array.from(raw.elev2.z)} : null; WORLD = {size:site.size, P, z0:z[(N >> 1) * N + (N >> 1)], elev:{N, z}, elev2, W, src:{...raw.src, bld:W.src.bld, at:Date.now()}}; buildNet(W); buildWorld(); rebuildProj(); fit(); refreshPanel(); }};

/* ---------- bouton Réglages (module commun Studio Prism) ---------- */
if (DISPLAY.dimDec != null) DIM_DEF.dec = DISPLAY.dimDec;
document.documentElement.style.setProperty('--pin-sz', DISPLAY.pinSz || 1);
PrismSettings.init({
  app:'ARCHITRAFIC',
  theme:{get:() => document.documentElement.dataset.theme || 'light', set:t => setTheme(t)},
  scaleSel:'.top, .ap-side, .panel, .phbar, .phinfo, .status, .vtools, .menu, .legend-box, #simBar, .simbar',
  onResize:() => { window.dispatchEvent(new Event('resize')); },
  sections:[
    {title:'Graphismes', fields:[
      {type:'seg', label:'Qualité graphique', sub:LOWPOW ? 'Auto = Économie sur cet appareil' : 'Auto = Élevée sur cet appareil', options:[['auto', 'Auto'], ['eco', 'Économie'], ['std', 'Équilibrée'], ['high', 'Élevée']], get:() => GFXQ, set:v => setGfx(v)},
      {type:'switch', label:'Ombres portées', get:() => !!DISPLAY.shadows, set:v => { DISPLAY.shadows = v; DISPLAY.shadowsUser = true; saveDisplay(); applyThemeToScene(); dirty = true; }},
      {type:'switch', label:'Vue de nuit', get:() => !!DISPLAY.night, set:v => { DISPLAY.night = v; saveDisplay(); applyThemeToScene(); dirty = true; }}]},
    {title:'Légende et repères', fields:[
      {type:'switch', label:'Légende repliée par défaut', sub:'Le bouton – / + de la légende la replie à tout moment', get:() => !!(DISPLAY.legMin ?? (isNarrow.matches || LOWPOW)), set:v => { DISPLAY.legMin = v; saveDisplay(); renderLegend(); }},
      {type:'seg', label:'Taille des bulles de panneaux', options:[[0.75, 'Petite'], [1, 'Normale'], [1.3, 'Grande']], get:() => DISPLAY.pinSz || 1, set:v => { DISPLAY.pinSz = v; saveDisplay(); document.documentElement.style.setProperty('--pin-sz', v); dirty = true; }},
      {type:'switch', label:'Sens uniques et sens interdits', get:() => DISPLAY.lay.oneway !== false, set:v => { DISPLAY.lay.oneway = v; saveDisplay(); applyLayers(); }},
      {type:'switch', label:'Noms des rues', get:() => DISPLAY.lay.names !== false, set:v => { DISPLAY.lay.names = v; saveDisplay(); annoKey = ''; dirty = true; }}]},
    {title:'Aide', fields:[
      {type:'switch', label:'Assistant pas à pas', sub:'Les 6 étapes du plan de déviation, en bas à gauche', get:() => GUIDE_OPEN, set:v => { GUIDE_OPEN = v; LS.set('at.guide', v ? '1' : '0'); guideKey = ''; renderGuide(); }},
      {type:'switch', label:'Revoir le tutoriel', sub:'La visite guidée se relance à la fermeture des réglages', get:() => LS.get('at.tour', '') !== '1', set:v => { LS.set('at.tour', v ? '' : '1'); LS.set('at.tourHome', v ? '' : '1'); if (v) setTimeout(() => { const h = $('#home'); if (h && !h.hidden) startTour(TOUR_HOME, 'at.tourHome'); else startTour(); }, 400); }}]},
    {title:'Cotes', fields:[
      {type:'seg', label:'Unité', options:[['m', 'Mètres'], ['cm', 'Centimètres']], get:() => DISPLAY.dimUnit || 'm', set:v => { DISPLAY.dimUnit = v; saveDisplay(); rebuildProj(); annoKey = ''; dirty = true; }},
      {type:'seg', label:'Précision par défaut des nouvelles cotes', options:[[0, '1 m'], [1, '0,1 m'], [2, '1 cm'], [3, '1 mm']], get:() => DIM_DEF.dec, set:v => { DIM_DEF.dec = v; DISPLAY.dimDec = v; saveDisplay(); }}]}],
  shortcuts:() => [...document.querySelectorAll('.tool[data-tool]')].map(b => [b.querySelector('kbd')?.textContent || '', b.querySelector('span')?.textContent || '']).filter(r => r[0]).concat([['Suppr', 'Effacer la sélection'], ['Ctrl+Z', 'Annuler'], ['Ctrl+Y', 'Rétablir'], ['Échap', 'Quitter l\'outil en cours']]),
  clearCache:async () => { await IDB.clearPrefix('site|'); }, cacheNote:'Efface les zones téléchargées (rues, bâtiments, relief) gardées 30 jours sur cet appareil. Vos chantiers et maquettes ne sont pas touchés.'
});
