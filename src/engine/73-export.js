/* ============ Exports : plan PNG avec cartouche et légende, maquette GLB, matériel CSV, itinéraires GeoJSON, projet ============ */
function canExport(){ const a = window.SPAccess; if (a && a.level !== 'pending' && !a.canExport){ window.SPLicense?.prompt('export'); return false; } window.SPLicense?.usage?.(); return true; }   // rappel d'usage (non commercial) une fois par session
/* Cadrage automatique des exports : la route barrée et ses déviations, vues du dessus, nord en haut,
   au lieu de l'endroit où se trouve la caméra. La vue de l'utilisateur est rétablie ensuite. */
function workEls(cl){ const els = state.els.filter(e => !phOff(e) && !e.hidden && e.pts?.length > 1);
  if (!cl) return els.filter(e => e.t === 'closure' || e.t === 'detour' || e.t === 'pdetour');
  return els.filter(e => e === cl || ((e.t === 'detour' || e.t === 'pdetour') && e.cl === cl.id)); }
function frameEls(els){
  const pts = els.flatMap(e => e.pts); if (!pts.length) return false;
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const w = vpEl.clientWidth || 800, h = vpEl.clientHeight || 600, side = Math.min(320, w * 0.3);   // place réservée à la légende (à droite) et au cartouche (en bas)
  const dx = Math.max(80, x1 - x0) * 1.12 + 40, dy = Math.max(80, y1 - y0) * 1.12 + 40;
  ortho.zoom = clamp(Math.min((w - side - 40) / dx, (h - 240) / dy), c2.minZoom, c2.maxZoom);   // 70 px en haut pour les panneaux, 170 px en bas pour le cartouche
  const cx = (x0 + x1) / 2 + side / 2 / ortho.zoom, cy = (y0 + y1) / 2 - 50 / ortho.zoom;   // décalage : le chantier reste dans la partie libre de l'image
  c2.target.set(cx, 0, -cy); ortho.position.set(cx, 1500, -cy); ortho.updateProjectionMatrix(); c2.update(); dirty = true; return true;
}
async function withWorkView(fn){
  const was = view, cam0 = {op:ortho.position.clone(), oz:ortho.zoom, ot:c2.target.clone(), pp:persp.position.clone(), pt:c3.target.clone()};
  if (view !== '2d') setView('2d'); await sleep(120);
  try { return await fn(); }
  finally { if (was !== '2d') setView(was); ortho.position.copy(cam0.op); ortho.zoom = cam0.oz; ortho.updateProjectionMatrix(); c2.target.copy(cam0.ot); c2.update();
    persp.position.copy(cam0.pp); c3.target.copy(cam0.pt); c3.update(); dirty = true; }
}
async function shotOf(els, k){ frameEls(els); await sleep(500); return exportPNG(k, true); }
const pngName = t => `${safeName(state.name)}-${t}-${new Date().toISOString().slice(0, 10)}.png`;
async function saveCanvas(cv, name){ const blob = await new Promise(res => cv.toBlob(res, 'image/png')); downloadBlob(blob, name); }
/* Plan d'ensemble : toutes les routes barrées et déviations (de la phase affichée) sur une seule image */
async function exportWorkPNG(k = 2){
  const els = workEls(); if (!els.length) return exportPNG(k);   // rien à cadrer : capture de la vue actuelle
  await withWorkView(async () => saveCanvas(await shotOf(els, k), pngName('plan-ensemble'))); toast('Plan d\'ensemble enregistré');
}
/* Plans détaillés : le plan d'ensemble, puis un plan par route barrée avec ses déviations */
async function exportDetailPNG(k = 2){
  const cls = state.els.filter(e => e.t === 'closure' && !phOff(e) && !e.hidden && e.pts?.length > 1);
  if (!cls.length){ toast('Aucune route barrée : export de la vue actuelle.', 3000); return exportPNG(k); }
  await withWorkView(async () => {
    if (cls.length > 1) await saveCanvas(await shotOf(workEls(), k), pngName('0-plan-ensemble'));
    for (const [i, c] of cls.entries()){ const W = workEls(c), set = new Set(W), pts = W.flatMap(e => e.pts), m = 30, x0 = Math.min(...pts.map(q => q[0])) - m, x1 = Math.max(...pts.map(q => q[0])) + m, y0 = Math.min(...pts.map(q => q[1])) - m, y1 = Math.max(...pts.map(q => q[1])) + m;
      LEG_FILTER = e => set.has(e) || (e.t !== 'closure' && e.t !== 'detour' && e.t !== 'pdetour' && (e.cl ? e.cl === c.id : e.x == null || (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1)));
      try { await saveCanvas(await shotOf(W, k), pngName(`${i + 1}-${safeName(c.name || 'route-barree')}`)); } finally { LEG_FILTER = null; } await sleep(300); }
  });
  toast(`${cls.length + (cls.length > 1 ? 1 : 0)} plans enregistrés`, 3000);
}
async function exportPNG(k = 2, asCanvas = false){
  const w = vpEl.clientWidth, h = vpEl.clientHeight, pr = renderer.getPixelRatio(), s = Math.min(k, 4096 / Math.max(w, h));
  markGroup.visible = previewGroup.visible = false; renderer.setPixelRatio(s); renderer.setSize(w, h, false); renderer.render(scene, cam());
  const src = renderer.domElement, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; const g = cv.getContext('2d'); g.drawImage(src, 0, 0);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); markGroup.visible = previewGroup.visible = true; dirty = true;
  const S = cv.width / w;
  // étiquettes
  // repères de panneaux : les panneaux proches sont regroupés dans une même bulle, les bulles ne se chevauchent pas (trait de rappel vers le point de pose)
  { const vr = vpEl.getBoundingClientRect(), items = [];
    for (const a of annos){ if (!a.pin || a.d.hidden) continue; const r = a.d.getBoundingClientRect(); if (!r.width) continue;
      items.push({ax:(r.left - vr.left + r.width / 2) * S, ay:(r.bottom - vr.top) * S + 6 * S, w:r.width * S, h:r.height * S, im:a.d.querySelector('img'), sig:a.sig, st:a.d.dataset.s}); }
    const cl = [];
    for (const it of items){ const c = cl.find(c => Math.hypot(c.ax - it.ax, c.ay - it.ay) < Math.max(it.w, it.h) * 0.9 && c.its.length < 6); if (c){ c.its.push(it); c.ax = c.its.reduce((t, q) => t + q.ax, 0) / c.its.length; c.ay = c.its.reduce((t, q) => t + q.ay, 0) / c.its.length; } else cl.push({ax:it.ax, ay:it.ay, its:[it]}); }
    const placed = [], pad = 3 * S, gap = 2 * S;
    for (const c of cl){ const n = c.its.length, cols = Math.min(n, 3), rows = Math.ceil(n / cols), u = Math.max(...c.its.map(q => q.w)), v = Math.max(...c.its.map(q => q.h)), cw = (u - 6 * S), ch = (v - 6 * S);
      const W = cols * cw + (cols - 1) * gap + pad * 2, Hh = rows * ch + (rows - 1) * gap + pad * 2; let x = c.ax - W / 2, y = c.ay - 6 * S - Hh;
      for (let k = 0; k < 12; k++){ const hit = placed.find(q => x < q.x + q.w + 2 * S && x + W + 2 * S > q.x && y < q.y + q.h + 2 * S && y + Hh + 2 * S > q.y); if (!hit) break; y = hit.y - Hh - 4 * S; }
      placed.push({x, y, w:W, h:Hh});
      g.save(); const lifted = c.ay - 6 * S - Hh - y > 2 * S;
      if (lifted){ g.strokeStyle = '#1E2226'; g.lineWidth = 1.2 * S; g.beginPath(); g.moveTo(x + W / 2, y + Hh); g.lineTo(c.ax, c.ay); g.stroke(); g.fillStyle = '#1E2226'; g.beginPath(); g.arc(c.ax, c.ay, 2.2 * S, 0, 7); g.fill(); }
      g.fillStyle = n === 1 && c.its[0].sig ? '#1E2226' : '#fff'; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 5 * S; g.beginPath(); g.roundRect ? g.roundRect(x, y, W, Hh, 9 * S) : g.rect(x, y, W, Hh); g.fill();
      if (!lifted){ g.beginPath(); g.moveTo(x + W / 2 - 5 * S, y + Hh); g.lineTo(x + W / 2, y + Hh + 6 * S); g.lineTo(x + W / 2 + 5 * S, y + Hh); g.fill(); }
      g.shadowBlur = 0;
      c.its.forEach((it, i) => { const ix = x + pad + (i % cols) * (cw + gap), iy = y + pad + Math.floor(i / cols) * (ch + gap);
        if (it.im?.complete && it.im.naturalWidth) g.drawImage(it.im, ix, iy, cw, ch);
        else if (it.sig){ ['r', 'y', 'g'].forEach((k, j) => { g.fillStyle = it.st === k ? ({r:'#FF2A1A', y:'#FFB300', g:'#18E070'})[k] : '#3a3f45'; g.beginPath(); g.arc(ix + cw / 2, iy + ch * (0.2 + j * 0.3), Math.min(cw, ch) * 0.12, 0, 7); g.fill(); }); } });
      g.restore(); } }
  for (const a of annos){ if (a.d.hidden || a.pin) continue; const r = a.d.getBoundingClientRect(), vr = vpEl.getBoundingClientRect(), cs = getComputedStyle(a.d);
    const x = (r.left - vr.left) * S, y = (r.top - vr.top) * S, ww = r.width * S, hh = r.height * S;
    g.save(); if (a.street && view === '2d'){ const t = a.d.style.transform.match(/rotate\(([-\d.]+)deg\)/); g.translate(x + ww / 2, y + hh / 2); if (t) g.rotate(+t[1] * Math.PI / 180); g.translate(-(x + ww / 2), -(y + hh / 2)); }
    if (!a.street){ g.fillStyle = cs.backgroundColor; g.strokeStyle = cs.borderColor; g.lineWidth = 1.5 * S; g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, 6 * S) : g.rect(x, y, ww, hh); g.fill(); if (cs.borderStyle !== 'none' && parseFloat(cs.borderWidth)) g.stroke(); }
    g.fillStyle = cs.color; g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * S}px ${cs.fontFamily}`; g.textBaseline = 'middle'; g.textAlign = 'center';
    const lines = a.d.textContent.split('\n'), lh = parseFloat(cs.fontSize) * 1.25 * S; lines.forEach((t, i) => g.fillText(t, x + ww / 2, y + hh / 2 + (i - (lines.length - 1) / 2) * lh)); g.restore(); }
  // légende
  const box = $('#legendBox'); if (!box.hidden){ const r = box.getBoundingClientRect(), vr = vpEl.getBoundingClientRect(); await drawLegendTo(g, (r.left - vr.left) * S, (r.top - vr.top) * S, S); }
  // cartouche
  drawCartouche(g, cv.width, cv.height, S);
  if (asCanvas) return cv;
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  downloadBlob(blob, `${safeName(state.name)}-${view === '2d' ? 'plan' : 'vue'}-${new Date().toISOString().slice(0, 10)}.png`); toast('Image enregistrée');
}
async function drawLegendTo(g, x, y, S){
  const L = legendEntries(), H0 = (20 + 22 + L.length * 22 + 14) * S, Wc = g.canvas.width, Hc = g.canvas.height, mg = 8 * S;
  S *= Math.min(1, (Hc - 2 * mg) / H0, (Wc - 2 * mg) / (250 * S));   // légende trop haute pour l'image : on la réduit
  const pad = 10 * S, rowH = 22 * S, w = 250 * S, h = pad * 2 + 22 * S + L.length * rowH + 14 * S;
  x = Math.max(mg, Math.min(x, Wc - w - mg)); y = Math.max(mg, Math.min(y, Hc - h - mg));   // toujours entièrement dans le cadre
  g.save(); g.fillStyle = 'rgba(255,255,255,.96)'; g.strokeStyle = '#C9D3DE'; g.lineWidth = 1.2 * S; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 10 * S) : g.rect(x, y, w, h); g.fill(); g.stroke();
  g.fillStyle = '#0B2A6B'; g.font = `700 ${12 * S}px Montserrat, Arial, sans-serif`; g.textBaseline = 'middle'; g.fillText((state.legend.title || 'Légende').toUpperCase(), x + pad, y + pad + 8 * S);
  const imgs = await Promise.all(L.map(e => new Promise(res => { const m = e.html.match(/src="([^"]+)"/); if (!m) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = m[1]; })));
  L.forEach((e, i) => { const yy = y + pad + 30 * S + i * rowH, sx = x + pad;
    if (imgs[i]){ const r = Math.min(26 * S / imgs[i].width, 18 * S / imgs[i].height); g.drawImage(imgs[i], sx, yy - imgs[i].height * r / 2, imgs[i].width * r, imgs[i].height * r); }
    else { const col = (e.html.match(/border-color:([^;"]+)/) || [])[1] || '#F28A1A'; if (/lg-zone/.test(e.html)){ g.fillStyle = col + '44'; g.strokeStyle = col; g.setLineDash([4 * S, 3 * S]); g.lineWidth = 2 * S; g.fillRect(sx, yy - 7 * S, 26 * S, 14 * S); g.strokeRect(sx, yy - 7 * S, 26 * S, 14 * S); g.setLineDash([]); }
      else { g.strokeStyle = col; g.lineWidth = 4 * S; if (/dash/.test(e.html)) g.setLineDash([5 * S, 4 * S]); g.beginPath(); g.moveTo(sx, yy); g.lineTo(sx + 26 * S, yy); g.stroke(); g.setLineDash([]); } }
    g.fillStyle = '#111827'; g.font = `500 ${11.5 * S}px Inter, Arial, sans-serif`; g.fillText(e.label + (e.n > 1 ? ` × ${e.n}` : ''), sx + 36 * S, yy, w - 50 * S); });
  g.restore();
}
function drawCartouche(g, W, Hh, S){
  const m = state.meta, w = 330 * S, lines = [state.name, state.site?.label || '', m.moa ? `Maître d'ouvrage : ${m.moa}` : '', m.entreprise ? `Entreprise : ${m.entreprise}` : '', m.from || m.to ? `Travaux${m.from ? ' du ' + new Date(m.from).toLocaleDateString('fr-FR') : ''}${m.to ? ' au ' + new Date(m.to).toLocaleDateString('fr-FR') : ''}` : '', m.arrete ? `Arrêté n° ${m.arrete}` : '', `Édité le ${new Date().toLocaleDateString('fr-FR')} · ARCHITRAFIC · Studio Prism`].filter(Boolean);
  const h = (18 + lines.length * 17) * S, x = 12 * S, y = Hh - h - 12 * S;
  g.save(); g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#0B2A6B'; g.lineWidth = 1.5 * S; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 8 * S) : g.rect(x, y, w, h); g.fill(); g.stroke();
  const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#1565C0'); gr.addColorStop(0.6, '#0EA5C6'); gr.addColorStop(0.8, '#F5B700'); gr.addColorStop(1, '#E2541B'); g.fillStyle = gr; g.fillRect(x, y, 5 * S, h);
  lines.forEach((t, i) => { g.fillStyle = i ? '#24324F' : '#0B2A6B'; g.font = i ? `500 ${11 * S}px Inter, Arial, sans-serif` : `700 ${13.5 * S}px Montserrat, Arial, sans-serif`; g.textBaseline = 'middle'; g.fillText(t, x + 16 * S, y + (17 + i * 17) * S, w - 26 * S); });
  // échelle (plan) et nord
  if (view === '2d'){ const mpp = mPerPx() / S, nice = [5, 10, 20, 25, 50, 100, 200, 250, 500], L = nice.find(v => v / mpp > 90 * S) || 500, px = L / mpp, sx = x + w + 20 * S, sy = Hh - 30 * S;
    g.fillStyle = '#fff'; g.fillRect(sx - 6 * S, sy - 22 * S, px + 50 * S, 32 * S); g.fillStyle = '#111'; g.fillRect(sx, sy, px / 2, 5 * S); g.strokeStyle = '#111'; g.lineWidth = 1.2 * S; g.strokeRect(sx, sy, px, 5 * S);
    g.font = `600 ${10.5 * S}px Inter, Arial`; g.textAlign = 'center'; g.fillText('0', sx, sy - 8 * S); g.fillText(`${L} m`, sx + px, sy - 8 * S); g.textAlign = 'left'; }
  const nx = W - 40 * S, ny = 40 * S; g.fillStyle = '#fff'; g.beginPath(); g.arc(nx, ny, 22 * S, 0, 7); g.fill(); g.strokeStyle = '#0B2A6B'; g.stroke();
  let a = 0; if (view !== '2d'){ const d = new THREE.Vector3(); persp.getWorldDirection(d); a = -Math.atan2(d.x, -d.z); } g.translate(nx, ny); g.rotate(a); g.fillStyle = '#C62828'; g.beginPath(); g.moveTo(0, -16 * S); g.lineTo(7 * S, 4 * S); g.lineTo(-7 * S, 4 * S); g.fill(); g.fillStyle = '#0B2A6B'; g.font = `700 ${10 * S}px Inter`; g.textAlign = 'center'; g.fillText('N', 0, 14 * S);
  g.restore();
}
function exportGLB(){
  const root = new THREE.Group(); root.name = state.name;
  const lieu = state.site ? {adresse:state.site.label || '', latitude:state.site.lat, longitude:state.site.lon, altitude:WORLD ? Math.round(WORLD.z0 * 100) / 100 : null, systemeAltimetrique:'NGF-IGN69'} : null;
  root.userData = {architrafic:{version:APP_VERSION, projet:state.name, unites:'m', axeHaut:'Y', origine:'point d\'adresse, altitude NGF de l\'origine = 0', lieu}, archiplan:{lieu:lieu ? {adresse:lieu.adresse, latitude:lieu.latitude, longitude:lieu.longitude, altitude:lieu.altitude} : null}};
  const site = worldGroup.clone(true); site.name = 'Site'; site.traverse(o => { if (o.isInstancedMesh) o.userData.instanced = true; }); root.add(site);
  const proj = projGroup.clone(true); proj.name = 'Chantier'; root.add(proj);
  new GLTFExporter().parse(root, buf => { downloadBlob(new Blob([buf], {type:'model/gltf-binary'}), `${safeName(state.name)}.glb`); toast('Maquette 3D (.glb) enregistrée'); }, err => { console.error(err); toast('Export GLB impossible.'); }, {binary:true, onlyVisible:true, maxTextureSize:2048});
}
function exportCSV(){
  const rows = [['Catégorie', 'Référence', 'Désignation', 'Quantité', 'Unité']], cnt = new Map();
  for (const e of state.els){
    if (e.t === 'obj'){ const L = LIBK[e.k]; if (!L) continue; const k = `${LIB_CATS[L.cat]}|${L.ref || ''}|${L.name}${e.p?.t ? ' (' + e.p.t.replace(/\|/g, ' ') + ')' : e.p?.v ? ' ' + e.p.v : ''}`; cnt.set(k, (cnt.get(k) || 0) + 1); }
    else if (e.t === 'line'){ const T = LINE_TYPES[e.k], L = plLen(e.pts); if (T.item){ const k = `Balisage|${LIBK[T.item].ref}|${LIBK[T.item].name}`; cnt.set(k, (cnt.get(k) || 0) + Math.floor(L / (e.sp || T.sp)) + 1); } else { const k = `Balisage||${T.n} (m)`; cnt.set(k, (cnt.get(k) || 0) + Math.round(L)); } }
    else if (e.t === 'zone' && e.fence){ const k = 'Chantier||Clôture de chantier (m)'; cnt.set(k, (cnt.get(k) || 0) + Math.round(plLen([...e.pts, e.pts[0]]))); }
  }
  for (const [k, n] of [...cnt].sort()){ const [c, r, d] = k.split('|'); rows.push([c, r, d, String(n), /\(m\)$/.test(d) ? 'm' : 'u']); }
  rows.push([]); rows.push(['Routes barrées', '', '', String(state.els.filter(e => e.t === 'closure').length), 'u']);
  for (const d of state.els.filter(e => e.t === 'detour')) rows.push(['Déviation', '', d.name, String(Math.round(d.len || plLen(d.pts))), 'm']);
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  downloadBlob(new Blob([csv], {type:'text/csv;charset=utf-8'}), `${safeName(state.name)}-materiel.csv`); toast('Liste du matériel enregistrée');
}
function exportGeoJSON(){
  if (!WORLD) return toast('Aucun lieu chargé.'); const P = WORLD.P, ll = p => p.map(q => P.toLL(q[0], q[1]).map(v => Math.round(v * 1e7) / 1e7));
  const F = state.els.filter(e => (e.t === 'closure' || e.t === 'detour') && e.pts?.length > 1).map(e => ({type:'Feature', properties:{type:e.t === 'closure' ? 'route barrée' : 'déviation', nom:e.name || '', mode:e.mode || undefined, longueur_m:Math.round(plLen(e.pts)), couleur:e.col || undefined}, geometry:{type:'LineString', coordinates:ll(e.pts)}}));
  for (const z of state.els.filter(e => e.t === 'zone')) F.push({type:'Feature', properties:{type:'emprise', nom:z.name}, geometry:{type:'Polygon', coordinates:[ll([...z.pts, z.pts[0]])]}});
  downloadBlob(new Blob([JSON.stringify({type:'FeatureCollection', name:state.name, features:F}, null, 1)], {type:'application/geo+json'}), `${safeName(state.name)}-itineraires.geojson`); toast('Itinéraires enregistrés (GeoJSON)');
}
function exportJSON(){ downloadBlob(new Blob([window.APModel.get()], {type:'application/json'}), `${safeName(state.name)}-${new Date().toISOString().slice(0, 10)}.architrafic.json`); toast('Sauvegarde enregistrée'); }
