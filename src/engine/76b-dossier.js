/* ============ Dossier d'arrêté de circulation (PDF) ============
   Un seul document A4 à joindre à la demande d'arrêté : couverture (projet, lieu, intervenants, phases), puis pour chaque
   phase le plan de signalisation, les routes barrées, les déviations et la nomenclature des panneaux, enfin le projet
   d'arrêté (modèle à compléter par l'autorité de police). Les plans sont capturés phase par phase dans la vue en plan. */
const DOS_MODE = {total:'Route barrée', alternat:'Alternat', sens:'Sens fermé (voie neutralisée)', voie:'File neutralisée'};
async function exportDossier(){
  if (!WORLD){ toast('Choisissez d\'abord le lieu du chantier.'); return; }
  const m = state.meta || {}, P = state.phases || [], wasPh = state.phase || 'all', wasView = view, wasSel = sel;
  const cam0 = {o:ortho.position.clone(), z:ortho.zoom, t2:c2.target.clone(), p:persp.position.clone(), t3:c3.target.clone()};
  const sheets = P.length ? P.filter(p => state.els.some(e => e.t === 'closure' && e.ph === p.id)) : [null];
  if (P.length && state.els.some(e => e.t === 'closure' && !e.ph)) sheets.unshift({id:'all', name:'Toutes phases (fermetures permanentes)'});
  const fmtD = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'}) : '…';
  toast('Préparation du dossier : capture des plans…', 6000);
  const out = [];
  try {
    if (view !== '2d') setView('2d');
    for (const p of sheets){
      setPhase(p ? p.id : 'all'); await sleep(60);
      const els = state.els.filter(e => !phOff(e) && !e.hidden), cls = els.filter(e => e.t === 'closure' && e.pts?.length > 1), dets = els.filter(e => (e.t === 'detour' || e.t === 'pdetour') && e.pts?.length > 1);
      // cadrage : fermetures et déviations de la phase
      frameEls([...cls, ...dets]);
      await sleep(450);
      const cv = await exportPNG(2.5, true), img = cv.toDataURL('image/jpeg', 0.88);
      // plans de détail : un par route barrée quand la phase en compte plusieurs (légende limitée à ce que montre le plan)
      const details = [];
      if (cls.length > 1) for (const c of cls){ const W = workEls(c), set = new Set(W), pts = W.flatMap(e => e.pts), m = 30, x0 = Math.min(...pts.map(q => q[0])) - m, x1 = Math.max(...pts.map(q => q[0])) + m, y0 = Math.min(...pts.map(q => q[1])) - m, y1 = Math.max(...pts.map(q => q[1])) + m;
        LEG_FILTER = e => set.has(e) || (e.t !== 'closure' && e.t !== 'detour' && e.t !== 'pdetour' && (e.cl ? e.cl === c.id : e.x == null || (e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1)));
        try { frameEls(W); await sleep(450); details.push({name:c.name || 'Voie', img:(await exportPNG(2.5, true)).toDataURL('image/jpeg', 0.88)}); } finally { LEG_FILTER = null; } }
      const counts = {}; for (const e of els) if (e.t === 'obj'){ const L = LIBK[e.k]; const k = L?.sign || e.k; (counts[k] ??= {n:0, name:L?.n || L?.name || e.k, ref:L?.ref || '', thumb:L?.sign ? signThumb(L.sign, {...(L.p || {}), ...(e.p || {})}) : (L ? libThumb(L) : '')}).n++; }
      out.push({p, img, details, cls:cls.map(c => ({name:c.name || 'Voie', mode:DOS_MODE[c.mode] || 'Route barrée', len:c.len || plLen(c.pts), riv:!!c.riv, ph:c.ph ? phName(c.ph) : 'toutes phases'})),
        dets:dets.map(d => ({name:d.name || 'Déviation', via:d.via || '', len:d.len || plLen(d.pts), extra:d.extra || 0, extraT:d.extraT || 0, vl:/PL|v[ée]hicules l[ée]gers/i.test(d.name || '') })),
        signs:Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])), warn:siteChecks().filter(r => r.lvl === 'err').map(r => r.txt)});
    }
  } catch(err){ console.warn('dossier', err); toast('Le dossier n\'a pas pu être préparé : ' + err.message); }
  finally {
    setPhase(wasPh); if (view !== wasView) setView(wasView);
    ortho.position.copy(cam0.o); ortho.zoom = cam0.z; ortho.updateProjectionMatrix(); c2.target.copy(cam0.t2); c2.update(); persp.position.copy(cam0.p); c3.target.copy(cam0.t3); c3.update();
    sel = wasSel; applySel(); dirty = true;
  }
  if (!out.length) return;
  // projet d'arrêté (même texte que l'export « Projet d'arrêté ») : on n'en garde que le corps
  const ar = exportArrete(true), arBody = (ar.match(/<body>([\s\S]*)<\/body>/) || [, ''])[1].replace(/<button class="print"[^>]*>.*?<\/button>/, '');
  const tot = {cl:out.reduce((s, x) => s + x.cls.length, 0), det:out.reduce((s, x) => s + x.dets.length, 0), sg:out.reduce((s, x) => s + x.signs.reduce((a, [, v]) => a + v.n, 0), 0)};
  const sheet = (x, i) => `<section class="pg"><div class="hd"><span>${esc(state.name)}</span><span>Planche ${i + 2}</span></div>
    <h2>${x.p ? esc(x.p.name) : 'Plan de signalisation temporaire'}${x.p?.from || x.p?.to ? ` <small>du ${fmtD(x.p.from)} au ${fmtD(x.p.to)}</small>` : ''}</h2>
    <div class="map"><img src="${x.img}"></div>
    <h3>Routes barrées et restrictions</h3>${x.cls.length ? `<table><thead><tr><th>Voie</th><th>Mesure</th><th class="n">Longueur</th><th>Accès</th></tr></thead><tbody>${x.cls.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(c.mode)}</td><td class="n">${fmtM(c.len)}</td><td>${c.riv ? 'sauf riverains et secours' : 'secours maintenus'}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Aucune fermeture dans cette phase.</p>'}
    <h3>Itinéraires de déviation</h3>${x.dets.length ? `<table><thead><tr><th>Déviation</th><th>Itinéraire</th><th class="n">Longueur</th><th class="n">Allongement</th></tr></thead><tbody>${x.dets.map(d => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.via || '—')}</td><td class="n">${fmtM(d.len)}</td><td class="n">${d.extra ? '+' + fmtM(d.extra) : '—'}${d.extraT ? ` · +${fmtDur(d.extraT)}` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Pas de déviation (circulation maintenue ou accès riverains seuls).</p>'}
    <h3>Signalisation à mettre en place</h3>${x.signs.length ? `<table class="sg"><tbody>${x.signs.map(([k, v]) => `<tr><td>${v.thumb ? `<img src="${v.thumb}">` : ''}</td><td><b>${esc(k)}</b></td><td>${esc(v.name)}</td><td class="n">${v.n}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Aucun panneau posé.</p>'}
    ${x.warn.length ? `<div class="warn"><b>Points à régler avant dépôt :</b><ul>${x.warn.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}</section>${x.details.map(d => `<section class="pg"><div class="hd"><span>${esc(state.name)}</span><span>Plan de détail</span></div><h2>Détail : ${esc(d.name)}${x.p ? ` <small>${esc(x.p.name)}</small>` : ''}</h2><div class="map big"><img src="${d.img}"></div><p class="hint">Route barrée, ses déviations et la signalisation correspondante. Légende limitée aux éléments de ce plan.</p></section>`).join('')}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier d'arrêté · ${esc(state.name)}</title><style>
    @page{size:A4;margin:12mm 12mm 14mm;@bottom-right{content:'Page ' counter(page) ' / ' counter(pages);font:8pt Inter,Arial,sans-serif;color:#6B7280}@bottom-left{content:'ARCHITRAFIC · Studio Prism';font:8pt Inter,Arial,sans-serif;color:#9CA3AF}}@page:first{@bottom-right{content:none}@bottom-left{content:none}}*{box-sizing:border-box}body{margin:0;font:10pt/1.4 Inter,Arial,sans-serif;color:#111827}.pg{page-break-after:always;padding:2mm 0;max-width:186mm;margin:0 auto}.pg:last-child{page-break-after:auto}
    .hd{display:flex;justify-content:space-between;font-size:8pt;color:#6B7280;border-bottom:1px solid #E5E9F0;padding-bottom:1.5mm;margin-bottom:4mm}
    .cover{display:flex;flex-direction:column;min-height:265mm}.bar{height:3mm;background:linear-gradient(90deg,#1565C0,#0EA5C6 60%,#F5B700 80%,#E2541B);margin-bottom:14mm}
    h1{font:800 24pt Montserrat,Arial;color:#0B2A6B;margin:0 0 3mm}h2{font:700 14pt Montserrat,Arial;color:#0B2A6B;margin:0 0 3mm}h2 small{font:500 10pt Inter,Arial;color:#4B5563}h3{font:700 9.5pt Montserrat,Arial;color:#0B2A6B;text-transform:uppercase;letter-spacing:.05em;margin:5mm 0 1.5mm}
    .kv{display:grid;grid-template-columns:44mm 1fr;gap:1.5mm 4mm;margin:8mm 0}.kv dt{color:#6B7280}.kv dd{margin:0;font-weight:600}
    .map.big{height:auto;max-height:225mm}.map{border:1px solid #0B2A6B;height:118mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.map img{max-width:100%;max-height:100%}
    table{border-collapse:collapse;width:100%}th{font-size:8pt;color:#6B7280;text-align:left;font-weight:600;border-bottom:1px solid #C9D3DE;padding:1mm 1.5mm}td{border-bottom:1px solid #E5E9F0;padding:1.2mm 1.5mm;vertical-align:middle}td.n,th.n{text-align:right;white-space:nowrap}
    table.sg td img{width:8mm;height:8mm;object-fit:contain}.hint{color:#6B7280;margin:1mm 0}.warn{margin-top:4mm;border:1px solid #F5C2C0;background:#FDF1F0;border-radius:2mm;padding:2mm 3mm;font-size:9pt}.warn ul{margin:1mm 0 0;padding-left:5mm}
    .toc li{margin:1mm 0}.foot{margin-top:auto;font-size:8.5pt;color:#6B7280;border-top:1px solid #E5E9F0;padding-top:3mm}
    .arr{font:11pt/1.5 Georgia,'Times New Roman',serif}.arr h1{font:700 14pt Arial;text-align:center;text-transform:uppercase;color:#111;margin:0 0 3mm}.arr h2{font:600 10.5pt Arial;text-align:center;color:#333;margin:0 0 6mm}.arr h3{font:700 10.5pt Arial;color:#111;text-transform:none;letter-spacing:0;margin:5mm 0 1.5mm}
    .arr .brouillon{border:1px dashed #C62828;color:#C62828;font:600 9pt Arial;padding:2mm 3mm;margin-bottom:5mm}.arr .sig{margin-top:12mm;text-align:right}
    .print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;font:600 12px Arial;cursor:pointer;z-index:9}@media print{.print{display:none}}</style></head><body>
    <button class="print" onclick="print()">Imprimer / PDF</button>
    <section class="pg cover"><div class="bar"></div><p style="font:700 10pt Montserrat,Arial;letter-spacing:.08em;color:#0EA5C6;margin:0 0 2mm">DOSSIER DE DEMANDE D'ARRÊTÉ DE CIRCULATION</p><h1>${esc(state.name)}</h1><div style="font-size:12pt;color:#374151">${esc(state.site?.label || '')}</div>
      <dl class="kv">${m.moa ? `<dt>Maître d'ouvrage</dt><dd>${esc(m.moa)}</dd>` : ''}${m.entreprise ? `<dt>Entreprise</dt><dd>${esc(m.entreprise)}</dd>` : ''}${m.from || m.to ? `<dt>Période des travaux</dt><dd>du ${fmtD(m.from)} au ${fmtD(m.to)}</dd>` : ''}${m.arrete ? `<dt>Référence</dt><dd>Arrêté n° ${esc(m.arrete)}</dd>` : ''}
        <dt>Mesures</dt><dd>${tot.cl} fermeture${tot.cl > 1 ? 's' : ''} ou restriction${tot.cl > 1 ? 's' : ''}, ${tot.det} déviation${tot.det > 1 ? 's' : ''}, ${tot.sg} panneau${tot.sg > 1 ? 'x' : ''} et équipements</dd>
        ${P.length ? `<dt>Phasage</dt><dd>${P.map(p => `${esc(p.name)}${p.from || p.to ? ` : du ${fmtD(p.from)} au ${fmtD(p.to)}` : ''}`).join('<br>')}</dd>` : ''}</dl>
      <h3>Sommaire</h3><ol class="toc">${out.map(x => `<li>${x.p ? esc(x.p.name) : 'Plan de signalisation temporaire'} — plan, fermetures, déviations, signalisation${x.details.length ? ` ; ${x.details.length} plans de détail` : ''}</li>`).join('')}<li>Projet d'arrêté (modèle à compléter)</li></ol>
      <div class="foot">Dossier établi avec ARCHITRAFIC (Studio Prism) le ${new Date().toLocaleDateString('fr-FR')}. Signalisation selon l'IISR 8e partie ; plans indicatifs à valider par le gestionnaire de voirie et l'autorité investie du pouvoir de police.</div></section>
    ${out.map(sheet).join('')}
    <section class="pg arr"><div class="hd" style="font-family:Inter,Arial"><span>${esc(state.name)}</span><span>Projet d'arrêté</span></div>${arBody}</section></body></html>`;
  openDoc(html, `${safeName(state.name)}-dossier-arrete.html`);
}
