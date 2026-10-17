/* Zoom à la molette maîtrisé.
 * Le zoom intégré d'OrbitControls (three r160) divise l'écart de la molette par devicePixelRatio arrondi à l'entier :
 * avec un zoom navigateur < 100 % (devicePixelRatio 0,8 ou 0,9) il devient infini et la vue saute d'un coup au zoom
 * maximal ; avec certaines souris il fait aussi de trop grands pas. On le remplace par un pas fixe et doux :
 * un cran de molette ≈ 4 %, les petits mouvements du pavé tactile sont proportionnels, toujours plafonnés.
 * Le pincement à deux doigts (écran tactile) reste géré par OrbitControls.
 */
(() => {
  const STEP = 0.96;                  // facteur par cran « standard » (100 px)
  const ctls = [c2, c3];
  const rc = new THREE.Raycaster(), ndc = new THREE.Vector2(), v = new THREE.Vector3(), w = new THREE.Vector3(), pl = new THREE.Plane();
  /* zoom d'un facteur k (k < 1 : rapprocher) en gardant fixe le point sous le curseur */
  let hitP = null, hitC = null;
  const _q = new THREE.Vector3();
  const groundHit = (ray, maxD) => { if (typeof H !== 'function' || typeof WORLD === 'undefined' || !WORLD) return null;
    const at = d => _q.copy(ray.direction).multiplyScalar(d).add(ray.origin), above = d => { at(d); return _q.y - H(_q.x, -_q.z); };
    let a = 0, fa = above(0); if (fa < 0) return null; let step = Math.max(2, fa * 0.25);
    for (let d = step; d < maxD; d += step, step = Math.min(step * 1.25, 200)){ const f = above(d); if (f < 0){ let lo = a, hi = d; for (let i = 0; i < 18; i++){ const m = (lo + hi) / 2; if (above(m) < 0) hi = m; else lo = m; } return at(hi).clone(); } a = d; }
    return null; };
  const zoomBy = (c, k, nx, ny) => {
    const cam = c.object; ndc.set(nx, ny);
    if (cam.isOrthographicCamera){
      v.set(ndc.x, ndc.y, 0).unproject(cam);
      cam.zoom = Math.max(c.minZoom, Math.min(c.maxZoom, cam.zoom / k)); cam.updateProjectionMatrix();
      if (c.zoomToCursor !== false){ w.set(ndc.x, ndc.y, 0).unproject(cam); v.sub(w); cam.position.add(v); c.target.add(v); }
    } else {
      /* zoom « vers ce qui est sous le curseur » : la caméra ET le point visé se rapprochent du point du sol (ou de la maquette)
         pointé — on peut donc toujours aller au plus près, quel que soit l'endroit où se trouvait le point visé */
      /* point visé : calculé une seule fois par geste de molette (il reste sous le curseur pendant tout le zoom) et par
         lancer de rayon sur le relief (fonction de hauteur), pas sur le maillage du sol : sur 20 km, intersecter le
         maillage coûtait des dizaines de millisecondes à CHAQUE image du zoom */
      let P = c === hitC && hitP ? hitP : null;
      if (!P){ rc.setFromCamera(ndc, cam); P = groundHit(rc.ray, c.maxDistance * 2);
        if (!P){ pl.setFromNormalAndCoplanarPoint(w.set(0, 1, 0), c.target); P = rc.ray.intersectPlane(pl, new THREE.Vector3()); }
        if (!P || P.distanceTo(cam.position) > c.maxDistance * 2) P = c.target.clone();
        hitP = P.clone(); hitC = c; }
      const dC = cam.position.distanceTo(P), dT = cam.position.distanceTo(c.target); let kk = k;
      if (dC * kk < 1.5) kk = 1.5 / Math.max(dC, 1e-3);                        // jamais à moins de 1,5 m du point visé
      if (dT * kk > c.maxDistance) kk = c.maxDistance / Math.max(dT, 1e-3);     // ni plus loin que la limite
      cam.position.sub(P).multiplyScalar(kk).add(P); c.target.sub(P).multiplyScalar(kk).add(P);
      keepAbove(cam, c);
    }
    c.update();
  };
  /* la caméra ne passe jamais sous le sol / la maquette (relief NGF quand il est connu, sinon le plan du sol) */
  const keepAbove = (cam, c) => { if (cam.isOrthographicCamera) return; const g = typeof H === 'function' && typeof WORLD !== 'undefined' && WORLD ? H(cam.position.x, -cam.position.z) : 0, min = g + 1.2;
    if (cam.position.y < min){ cam.position.y = min; } if (c && c.target.y < g - 0.5) c.target.y = g - 0.5; };
  for (const c of ctls) c.addEventListener('change', () => keepAbove(c.object, c));
  /* glissement : chaque cran ajoute son zoom à une réserve, consommée en douceur sur ≈ 150 ms (même amplitude qu'avant, sans à-coup) */
  let pend = 0, pc = null, px = 0, py = 0, raf = 0, last = 0;
  const tick = now => { const dt = Math.min(50, now - (last || now)); last = now; if (!pc || Math.abs(pend) < 1e-4){ pend = 0; raf = 0; last = 0; return; }
    const part = Math.abs(pend) < 2e-3 ? pend : pend * (1 - Math.exp(-dt / 55));   /* fin du glissement : on applique le reste, le pas par cran est exact */ pend -= part; zoomBy(pc, Math.exp(part), px, py); raf = requestAnimationFrame(tick); };
  canvas.addEventListener('wheel', ev => {
    const c = ctls.find(x => x.enabled && x.enableZoom);
    if (!c || ev.defaultPrevented) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    let d = ev.deltaY * (ev.deltaMode === 1 ? 33 : ev.deltaMode === 2 ? 400 : 1);
    { const W = (window.PrismSettings?.wheel?.() || {k:1, inv:false}); d *= W.k * (W.inv ? -1 : 1); }   // Réglages : vitesse et sens de la molette
    if (!d || !isFinite(d)) return;
    if (ev.ctrlKey) d *= 2.5;         // pincement sur pavé tactile : petits écarts
    const n = Math.max(-1.5, Math.min(1.5, d / 100));   // au plus 1,5 cran par évènement
    const r = canvas.getBoundingClientRect();
    if (pc !== c || Math.abs(pend) < 1e-3) hitP = null;   // nouveau geste : nouveau point visé
    if (pc !== c) pend = 0; pc = c; px = ((ev.clientX - r.left) / r.width) * 2 - 1; py = -((ev.clientY - r.top) / r.height) * 2 + 1;
    pend += Math.abs(n) * Math.log(STEP) * (n < 0 ? 1 : -1);   // < 0 : rapprocher
    pend = Math.max(-1.2, Math.min(1.2, pend));                   // molette lancée très vite : pas d'emballement
    if (!raf) raf = requestAnimationFrame(tick);
  }, {capture:true, passive:false});
})();
/* la molette au-dessus d'une bulle ou d'une étiquette zoome quand même la vue */
document.getElementById('labels')?.addEventListener('wheel', ev => { ev.preventDefault(); canvas.dispatchEvent(new WheelEvent('wheel', ev)); }, {passive:false});
