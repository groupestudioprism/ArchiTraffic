/* ============ Lien ARCHIPLAN : emprise d'un projet de bâtiment ============
   Fichier → « Importer l'emprise d'un projet ARCHIPLAN » : on lit le projet (.archiplan / .json enregistré par ARCHIPLAN),
   on calcule l'emprise au sol du bâtiment (murs avec leur épaisseur, dalles, poteaux, volumes) et sa hauteur, puis on la pose
   comme emprise de chantier : à l'adresse du projet si ARCHIPLAN la connaît, sinon au centre de la vue. Elle se déplace et
   pivote ensuite comme toute emprise (outils Déplacer et Rotation). */
function hull2(P){
  const p = [...new Map(P.map(q => [q[0].toFixed(3) + ',' + q[1].toFixed(3), q])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()){ while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function archiplanFootprint(s){
  const lib = s.lib?.compos || {}, T = w => { const L = lib[w.type]?.layers; return L ? L.reduce((a, l) => a + (+l[1] || 0), 0) : /^CLO/.test(w.type || '') ? 0.07 : 0.3; };
  const lz = i => +(s.levels?.[i]?.z) || 0, pts = []; let top = 0, n = 0;
  for (const e of s.els || []){
    const z0 = lz(e.lvl | 0) + (+e.off || 0);
    if (e.kind === 'wall' && e.a && e.b){ const d = V.norm(V.sub(e.b, e.a)), nn = V.mul(V.perp(d), T(e) / 2); pts.push(V.add(e.a, nn), V.sub(e.a, nn), V.add(e.b, nn), V.sub(e.b, nn)); top = Math.max(top, z0 + (+e.h || 0)); n++; }
    else if ((e.kind === 'slab' || e.kind === 'vol' || e.kind === 'roof') && e.p && e.q){ const P = e.poly?.length >= 3 ? e.poly : [e.p, [e.q[0], e.p[1]], e.q, [e.p[0], e.q[1]]]; const ov = e.kind === 'roof' ? +(e.ov ?? 0.4) : 0;
      const xs = P.map(q => q[0]), ys = P.map(q => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      P.forEach(q => pts.push(ov ? [q[0] + Math.sign(q[0] - cx) * ov, q[1] + Math.sign(q[1] - cy) * ov] : q)); const span = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), ridge = e.shape === '0' ? 0.3 : Math.tan((+e.pitch || 35) * Math.PI / 180) * span / (e.shape === '1' ? 1 : 2);   // faîtage du toit
      top = Math.max(top, z0 + (e.kind === 'roof' ? ridge : e.kind === 'slab' ? 0.3 : +e.h || 0.3)); n++; }
    else if (e.kind === 'col' && e.c){ const hw = (+e.w || 0.25) / 2, hd = (+e.d || 0.25) / 2; pts.push([e.c[0] - hw, e.c[1] - hd], [e.c[0] + hw, e.c[1] + hd], [e.c[0] - hw, e.c[1] + hd], [e.c[0] + hw, e.c[1] - hd]); top = Math.max(top, z0 + (+e.h || 0)); n++; }
  }
  const H = hull2(pts); return H.length >= 3 ? {pts:H, h:Math.round(Math.max(2.5, top) * 100) / 100, n, area:Math.abs(ringArea(H))} : null;
}
async function importArchiplan(file){
  if (!state.site || !WORLD){ toast('Choisissez d\'abord le lieu du chantier.'); return; }
  let s; try { s = JSON.parse(await file.text()); } catch(e){ toast('Fichier illisible : ce n\'est pas un projet ARCHIPLAN.'); return; }
  if (s?.app === 'architrafic'){ toast('C\'est un chantier ARCHITRAFIC : utilisez « Importer un projet ».'); return; }
  if (!Array.isArray(s?.els) || !(s.format === 'archiplan' || s.levels)){ toast('Ce fichier n\'est pas un projet ARCHIPLAN (.archiplan).'); return; }
  const F = archiplanFootprint(s); if (!F){ toast('Le projet ne contient ni mur ni dalle : pas d\'emprise à poser.'); return; }
  let o = [0, 0], where = 'au centre de la vue';
  const lat = +(s.site?.lat ?? s.site?.latitude), lon = +(s.site?.lon ?? s.site?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)){ const q = WORLD.P.toXY(lon, lat); if (Math.max(Math.abs(q[0]), Math.abs(q[1])) < WORLD.size){ o = q; where = 'à l\'adresse du projet'; } }
  if (where !== 'à l\'adresse du projet'){ const t = view === '2d' ? c2.target : c3.target; const cx = F.pts.reduce((a, q) => a + q[0], 0) / F.pts.length, cy = F.pts.reduce((a, q) => a + q[1], 0) / F.pts.length; o = [t.x - cx, -t.z - cy]; }
  const id = uid8(), name = s.name || file.name.replace(/\.(archiplan|json)$/i, '');
  addEl({id, t:'zone', name:`Bâtiment · ${name}`, pts:F.pts.map(q => [Math.round((q[0] + o[0]) * 100) / 100, Math.round((q[1] + o[1]) * 100) / 100]), fence:false, bld:{h:F.h, src:'archiplan', n:F.n}});
  sel = id; applySel(); refreshPanel(); const c = elCenter(byId(id)); frameAt(c[0], c[1], Math.max(30, Math.sqrt(F.area) * 1.5));
  toast(`Emprise du bâtiment « ${name} » posée ${where} (${nf(F.area, 0)} m², ${nf(F.h, 1)} m de haut). Outils Déplacer (G) et Rotation (O) pour l'ajuster.`, 6500);
}
$('#apIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importArchiplan(f); });
