/* ============ Chargement robuste, tuile par tuile ============
   Les gros services publics (Overpass, Géoplateforme) coupent les requêtes trop lourdes (délai, mémoire, quotas) :
   une grande zone en une seule requête échoue souvent, même avec une très bonne connexion.
   La zone est donc découpée en tuiles chargées 2 par 2, chacune :
   - réessayée jusqu'à 5 fois en alternant les serveurs, avec une attente croissante (429 / 504 / coupure) ;
   - redécoupée en 4 si le serveur la juge trop lourde ;
   - mise en cache dès réception : une reprise ne recharge que ce qui manque.
   Une tuile définitivement perdue n'empêche jamais l'ouverture du chantier : on affiche ce qui est chargé et on le signale. */
const tileKey = (kind, b) => `tile|${DATA_VER}|${kind}|${b.s.toFixed(5)}|${b.w.toFixed(5)}|${b.n.toFixed(5)}|${b.e.toFixed(5)}`;
function splitBounds(B, m){
  const lat0 = (B.s + B.n) / 2, dLat = m / 110540, dLon = m / (111320 * Math.cos(lat0 * Math.PI / 180));
  const ny = Math.max(1, Math.ceil((B.n - B.s) / dLat)), nx = Math.max(1, Math.ceil((B.e - B.w) / dLon)), out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){
    const s = B.s + (B.n - B.s) * j / ny, n = B.s + (B.n - B.s) * (j + 1) / ny, w = B.w + (B.e - B.w) * i / nx, e = B.w + (B.e - B.w) * (i + 1) / nx;
    out.push({s, w, n, e, cx:(w + e) / 2, cy:(s + n) / 2});
  }
  // les tuiles centrales d'abord : le chantier s'affiche correctement même si la périphérie traîne
  const cx = (B.w + B.e) / 2, cy = (B.s + B.n) / 2; return out.sort((a, b) => Math.hypot(a.cx - cx, a.cy - cy) - Math.hypot(b.cx - cx, b.cy - cy));
}
const quarter = b => { const ms = (b.s + b.n) / 2, mw = (b.w + b.e) / 2; return [{s:b.s, w:b.w, n:ms, e:mw}, {s:b.s, w:mw, n:ms, e:b.e}, {s:ms, w:b.w, n:b.n, e:mw}, {s:ms, w:mw, n:b.n, e:b.e}]; };
let opSlot = 0;
async function overpassTile(q){
  let wait = 1500;
  for (let a = 0; a < 6; a++){
    const url = OVERPASS[(opSlot++) % OVERPASS.length], c = new AbortController(), t = setTimeout(() => c.abort(), 60000);
    try {
      const r = await fetch(url, {method:'POST', body:'data=' + encodeURIComponent(q), headers:{'Content-Type':'application/x-www-form-urlencoded'}, signal:c.signal});
      if (r.status === 400) throw Object.assign(new Error('bad'), {fatal:true});
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      if (/runtime error|out of memory|timed out|Timeout/i.test(j.remark || '')) throw Object.assign(new Error('heavy'), {heavy:true});
      return j;
    } catch(e){ if (e.fatal || e.heavy && a >= 1) throw e; }
    finally { clearTimeout(t); }
    await sleep(wait + Math.random() * 800); wait = Math.min(wait * 2, 15000);
  }
  throw new Error('overpass injoignable');
}
/* q(bb) : texte de requête pour une emprise « (s,w,n,e) » ; renvoie {elements, lost} */
async function overpassTiled(kind, B, tileM, q, prog, depth = 0){
  const tiles = depth ? [B] : splitBounds(B, tileM), all = [], seen = new Set(); let lost = 0;
  if (!depth) prog.total += tiles.length;
  const take = els => { for (const e of els){ const k = e.type + e.id; if (seen.has(k)) continue; seen.add(k); all.push(e); } };
  const one = async b => {
    const key = tileKey(kind, b), hit = await IDB.get(key);
    if (hit && Date.now() - hit.at < 30 * 864e5){ take(hit.el); return; }
    try { const j = await overpassTile(q(`(${b.s},${b.w},${b.n},${b.e})`)); take(j.elements || []); IDB.set(key, {at:Date.now(), el:j.elements || []}); }
    catch(e){
      if (depth < 2 && !e.fatal){ for (const s of quarter(b)){ const r = await overpassTiled(kind, s, 0, q, prog, depth + 1); take(r.elements); lost += r.lost; } }
      else lost++;
    }
  };
  let i = 0; const worker = async () => { while (i < tiles.length){ const b = tiles[i++]; await one(b); if (!depth){ prog.done++; prog.tick(); } } };
  await Promise.all([worker(), worker()]);
  return {elements:all, lost};
}
/* BD TOPO par tuiles de 1 km (≈ 1 000 à 5 000 bâtiments en ville) */
async function bdtopoTiled(B, prog){
  const tiles = splitBounds(B, 1000), out = [], seen = new Set(); let lost = 0, i = 0; prog.total += tiles.length;
  const one = async b => {
    const key = tileKey('bdt', b), hit = await IDB.get(key);
    let f = hit && Date.now() - hit.at < 30 * 864e5 ? hit.f : null;
    for (let a = 0; !f && a < 4; a++){ try { f = await loadBDTopo(b); IDB.set(key, {at:Date.now(), f}); } catch(e){ await sleep(1200 * (a + 1)); } }
    if (!f){ lost++; return; }
    for (const x of f){ const id = x.id || x.properties?.cleabs; if (id && seen.has(id)) continue; if (id) seen.add(id); out.push(x); }
  };
  const worker = async () => { while (i < tiles.length){ await one(tiles[i++]); prog.done++; prog.tick(); } };
  await Promise.all([worker(), worker(), worker()]);
  return {f:out, lost};
}
/* relief : 3 essais du WMS, puis le service ponctuel, puis terrain plat (jamais bloquant) */
async function elevRobust(P, size, onStep){
  for (let a = 0; a < 2; a++){ try { return await loadElevation(P, size, onStep); } catch(e){ await sleep(700); } }
  const N = 41; return {N, z:new Float32Array(N * N).fill(0), src:'relief indisponible (terrain plat provisoire)', flat:true};
}
/* équipements du sous-sol (regards, armoires, poteaux incendie) : chargés seulement quand on active le calque Réseaux */
let utilsLoading = null;
async function ensureUtilities(){
  if (!WORLD || WORLD.W.utilsLoaded || utilsLoading) return utilsLoading;
  const P = WORLD.P, S = Math.min(WORLD.size, CORE), B = areaBounds(P, S + 40), prog = {total:0, done:0, tick:() => loadUI(true, 'Calque réseaux souterrains', `Regards, bouches à clé, armoires, poteaux incendie… ${prog.done}/${prog.total}`, prog.total ? prog.done / prog.total : 0)};
  loadUI(true, 'Calque réseaux souterrains', 'Équipements cartographiés (OpenStreetMap)…', 0.02);
  let stopped = false; LOAD_STOP = () => { stopped = true; DISPLAY.lay.nets = false; saveDisplay(); buildWorld(); toast('Calque réseaux annulé.', 3000); };
  utilsLoading = overpassTiled('utils', B, 1200, bb => `[out:json][timeout:50];(node["man_made"~"^(manhole|street_cabinet)$"]${bb};node["manhole"]${bb};node["emergency"="fire_hydrant"]${bb};);out body qt;`, prog)
    .then(r => { if (stopped) return; const W = WORLD.W; W.utils = []; for (const e of r.elements){ const xy = P.toXY(e.lon, e.lat), T = e.tags || {};
        if (T.man_made === 'manhole' || T.manhole) W.utils.push({x:xy[0], y:xy[1], k:'manhole', sub:String(T.manhole || T.utility || ''), tags:T});
        else if (T.man_made === 'street_cabinet') W.utils.push({x:xy[0], y:xy[1], k:'cabinet', sub:String(T.utility || T.street_cabinet || ''), tags:T});
        else if (T.emergency === 'fire_hydrant') W.utils.push({x:xy[0], y:xy[1], k:'hydrant', tags:T}); }
      W.utilsLoaded = true; loadUI(false); buildWorld(); renderLegend?.();
      if (r.lost) toast(`Réseaux : ${r.lost} secteur(s) non chargé(s), le reste est affiché.`, 5000); })
    .catch(() => { loadUI(false); toast('Équipements du sous-sol indisponibles pour le moment : le réseau présumé est affiché.', 5000); })
    .finally(() => { utilsLoading = null; });
  return utilsLoading;
}
