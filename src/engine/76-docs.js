/* ============ Contrôle du chantier, plan A3 et projet d'arrêté ============
   Règles appliquées (IISR 8e partie, guides CEREMA « Voirie urbaine » et SETRA « signalisation temporaire ») :
   présignalisation AK5 (route barrée) ou AK3 (chaussée rétrécie) en amont, à ≈ 50 m en agglomération et ≈ 150 m hors agglomération ;
   barrage (K2 / KC1) à chaque entrée d'une route barrée ; alternat par feux KR11 aux deux extrémités (longueur ≤ 300 m conseillée) ;
   biseau de cônes K5a devant une voie neutralisée ; déviation jalonnée (KD22) pour chaque sens barré. */
function siteChecks(){
  const out = [], els = state.els.filter(e => !phOff(e) && !e.hidden), objs = els.filter(e => e.t === 'obj'), near = (k, q, r) => objs.filter(o => k.test(o.k) && Math.hypot(o.x - q[0], o.y - q[1]) <= r);
  const urbF = WORLD ? urbanIndex(WORLD.W) : null;
  const add = (lvl, txt, at) => out.push({lvl, txt, at});
  const cls = els.filter(e => e.t === 'closure' && e.pts?.length > 1);
  if (!cls.length) add('info', 'Aucune route barrée dans cette vue : rien à contrôler côté signalisation.', null);
  for (const c of cls){
    const mid = plAt(c.pts, plLen(c.pts) / 2).pt, agglo = !urbF || urbF(mid[0], mid[1]) >= 2, apD = agglo ? 100 : 150, name = c.name || 'Rue', L = c.len || plLen(c.pts);
    const ends = [c.pts[0], c.pts[c.pts.length - 1]];
    if (c.mode === 'total'){
      const ow = sectionOneway(c.ids);
      ends.forEach((q, i) => { if (ow !== 0 && (ow === 1) === (i === 1)) return; const lbl = `${name}, ${ow ? 'entrée (sens unique)' : `extrémité ${i ? 'B' : 'A'}`}`;
        if (!near(/^(K2|KR_ROUTE|KC1|barr|K8)/i, q, 15).length) add('err', `${lbl} : pas de barrage (K2 ou KC1) à l'entrée`, q); else add('ok', `${lbl} : barrage en place`, q);
        const ak = near(/^AK5$/, q, apD * 2.2); if (!ak.length) add('err', `${lbl} : présignalisation AK5 manquante (≈ ${apD} m en amont)`, q);
        else { const d = Math.min(...ak.map(o => Math.hypot(o.x - q[0], o.y - q[1]))); if (d < apD * 0.6) add('warn', `${lbl} : AK5 trop proche (${Math.round(d)} m, viser ≈ ${apD} m)`, q); else add('ok', `${lbl} : AK5 à ${Math.round(d)} m`, q); } });
      const dets = els.filter(d => d.t === 'detour' && d.cl === c.id);
      if (!dets.length) add('err', `${name} : aucune déviation (itinéraire à prévoir ou accès riverains seuls)`, mid);
      else { for (const d of dets){ const kd = objs.filter(o => /^KD/.test(o.k) && o.auto === c.id).length; if (!kd) add('warn', `${d.name} : déviation sans panneau KD22 de jalonnement`, plAt(d.pts, plLen(d.pts) / 2).pt); else add('ok', `${d.name} : ${kd} panneau${kd > 1 ? 'x' : ''} de jalonnement, +${fmtM(d.extra || 0)}`, null); }
        if (!objs.some(o => /^KD(69|9|10)/.test(o.k))) add('warn', `${name} : pas de panneau de fin de déviation (KD69) — à poser au retour sur l'itinéraire normal`, mid); }
      if (c.riv && !near(/KC1|KR_ROUTE/, mid, L / 2 + 40).length) add('warn', `${name} : « sauf riverains » coché mais pas de panonceau KC1 « Rue barrée sauf riverains »`, mid);
    } else if (c.mode === 'alternat'){
      const kr = ends.map(q => near(/^(KR11|K10|B15|C18)/, q, 20).length);
      kr.forEach((n, i) => n ? add('ok', `${name}, extrémité ${i ? 'B' : 'A'} : alternat réglé`, ends[i]) : add('err', `${name}, extrémité ${i ? 'B' : 'A'} : ni feu KR11 ni B15/C18 pour l'alternat`, ends[i]));
      if (L > 300) add('warn', `${name} : alternat sur ${Math.round(L)} m — au-delà de 300 m, temps de rouge trop long (max. 2 min 30 s)`, mid);
      if (!near(/^AK3/, ends[0], 160).length && !near(/^AK3/, ends[1], 160).length) add('err', `${name} : présignalisation AK3 « chaussée rétrécie » manquante`, mid);
    } else {
      const q = c.dir === -1 ? ends[1] : ends[0];
      if (near(/^K5/, q, 60).length < 3) add('err', `${name} : biseau de cônes K5a manquant devant la voie neutralisée`, q); else add('ok', `${name} : biseau de cônes en place`, q);
      if (!near(/^AK3/, q, apD * 2.2).length) add('err', `${name} : présignalisation AK3 manquante (≈ ${apD} m en amont)`, q);
      if (c.mode === 'sens' && !els.some(d => d.t === 'detour' && d.cl === c.id)) add('err', `${name} : sens fermé sans déviation`, q);
    }
  }
  for (const c of cls) if (c.mode === 'alternat'){ const A = alternatAdvice(c); add(A.mode === 'impossible' ? 'err' : 'info', `${c.name} — alternat : ${A.txt}`, plAt(c.pts, plLen(c.pts) / 2).pt); }
  extraChecks(add, els);
  // panneaux trop proches les uns des autres (lisibilité : ≥ 10 m entre deux panneaux successifs d'un même côté)
  const signs = objs.filter(o => LIBK[o.k]?.sign && !/^K5|^K2$/.test(o.k)); let close = 0;
  for (let i = 0; i < signs.length; i++) for (let j = i + 1; j < signs.length; j++){ const d = Math.hypot(signs[i].x - signs[j].x, signs[i].y - signs[j].y); if (d > 0.5 && d < 4 && Math.abs(((signs[i].a - signs[j].a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < 0.5) close++; }
  if (close) add('warn', `${close} paire${close > 1 ? 's' : ''} de panneaux à moins de 4 m l'un de l'autre dans le même sens : espacer d'au moins 10 m`, null);
  return out;
}
function checkDialog(){
  const R = siteChecks(), n = {err:R.filter(r => r.lvl === 'err').length, warn:R.filter(r => r.lvl === 'warn').length}, ic = {ok:'✔', warn:'⚠', err:'✖', info:'ℹ'};
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Contrôle du chantier${curPh() ? ' · ' + esc(phName(curPh())) : ''}</p><h3 class="ed-name" style="margin:0">${n.err ? `${n.err} point${n.err > 1 ? 's' : ''} bloquant${n.err > 1 ? 's' : ''}` : n.warn ? `${n.warn} point${n.warn > 1 ? 's' : ''} à vérifier` : 'Signalisation conforme'}</h3></div></div>
    <div class="ed-body chk-list" style="display:block;max-height:60vh;overflow:auto">${R.map((r, i) => `<div class="chk ${r.lvl}"${r.at ? ` data-i="${i}" title="Voir sur la carte"` : ''}><b>${ic[r.lvl]}</b><span>${esc(r.txt)}</span></div>`).join('')}
    <p class="hint" style="margin-top:10px">Règles : IISR 8e partie (signalisation temporaire), guides CEREMA et SETRA. Ce contrôle aide à la préparation ; il ne remplace pas la validation du gestionnaire de voirie.</p></div>
    <div class="ed-f"><span style="flex:1"></span><button class="btn primary" id="chkOk">Fermer</button></div>`);
  $('#chkOk').onclick = closeEngine;
  document.querySelectorAll('.chk[data-i]').forEach(d => d.onclick = () => { const r = R[+d.dataset.i]; closeEngine(); frameAt(r.at[0], r.at[1], 40); });
}
/* ---------- plan de signalisation A3 : vue en plan + cartouche + nomenclature, prêt à imprimer en PDF ---------- */
async function exportA3(){
  const was = view; if (view !== '2d') setView('2d'); await sleep(120);
  const cv = await exportPNG(3, true); if (was !== '2d') setView(was);
  const img = cv.toDataURL('image/jpeg', 0.92), counts = {};
  for (const e of state.els) if (e.t === 'obj' && !phOff(e) && !e.hidden){ const L = LIBK[e.k]; const k = L?.sign || e.k; (counts[k] ??= {n:0, name:L?.n || L?.name || e.k, thumb:L?.sign ? signThumb(L.sign, {...(L.p || {}), ...(e.p || {})}) : (L ? libThumb(L) : '')}).n++; }
  const rows = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `<tr><td>${v.thumb ? `<img src="${v.thumb}">` : ''}</td><td><b>${esc(k)}</b></td><td>${esc(v.name)}</td><td class="n">${v.n}</td></tr>`).join('');
  const m = state.meta || {}, ph = curPh() ? ` — ${phName(curPh())}` : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(state.name)} · plan de signalisation${esc(ph)}</title><style>
    @page{size:A3 landscape;margin:8mm}body{margin:0;font:11px/1.35 Inter,Arial,sans-serif;color:#111827}.pg{display:grid;grid-template-columns:1fr 92mm;gap:6mm;height:277mm}
    .map{border:1px solid #0B2A6B;display:flex;align-items:center;justify-content:center;overflow:hidden}.map img{max-width:100%;max-height:100%}
    aside{display:flex;flex-direction:column;gap:4mm}h1{font:700 15px Montserrat,Arial;color:#0B2A6B;margin:0}h2{font:700 11px Montserrat,Arial;color:#0B2A6B;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2mm}
    .box{border:1px solid #C9D3DE;border-radius:2mm;padding:3mm}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #E5E9F0;padding:1mm}td img{width:9mm;height:9mm;object-fit:contain}td.n{text-align:right;font-weight:700}
    .bar{height:2mm;background:linear-gradient(90deg,#1565C0,#0EA5C6 60%,#F5B700 80%,#E2541B)}.print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;font-weight:600;cursor:pointer}@media print{.print{display:none}}</style></head>
    <body><button class="print" onclick="print()">Imprimer / PDF</button><div class="pg"><div class="map"><img src="${img}"></div><aside><div class="bar"></div>
    <div class="box"><h1>${esc(state.name)}</h1><div>Plan de signalisation temporaire${esc(ph)}</div><div>${esc(state.site?.label || '')}</div>
    ${m.moa ? `<div>Maître d'ouvrage : <b>${esc(m.moa)}</b></div>` : ''}${m.entreprise ? `<div>Entreprise : <b>${esc(m.entreprise)}</b></div>` : ''}${m.from || m.to ? `<div>Travaux${m.from ? ' du ' + esc(m.from) : ''}${m.to ? ' au ' + esc(m.to) : ''}</div>` : ''}${m.arrete ? `<div>Arrêté n° ${esc(m.arrete)}</div>` : ''}<div style="color:#6B7280;margin-top:2mm">Édité le ${new Date().toLocaleDateString('fr-FR')} · ARCHITRAFIC</div></div>
    <div class="box" style="flex:1;overflow:hidden"><h2>Nomenclature de la signalisation</h2><table>${rows || '<tr><td>Aucun élément</td></tr>'}</table></div>
    <div class="box" style="font-size:9.5px;color:#4B5563">Signalisation conforme à l'IISR 8e partie. Présignalisation à ≈ 50 m en agglomération, ≈ 150 m hors agglomération. Plan indicatif à valider par le gestionnaire de voirie.</div></aside></div></body></html>`;
  openDoc(html, `${safeName(state.name)}-plan-A3.html`);
}
/* ---------- projet d'arrêté de circulation ---------- */
function exportArrete(){
  const m = state.meta || {}, phases = state.phases?.length ? state.phases : [null], art = [];
  const fmtD = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'}) : '…';
  const modeTxt = c => c.mode === 'alternat' ? `la circulation sera alternée${c.len ? ` sur ${Math.round(c.len)} m` : ''}, réglée par feux tricolores de chantier (KR11) ou piquets K10` : c.mode === 'voie' ? 'une file de circulation sera neutralisée, la circulation étant maintenue sur la file restante' : c.mode === 'sens' ? `la circulation sera interdite dans le sens ${c.dir === -1 ? 'inverse' : 'du tracé'} et maintenue dans l'autre sens` : `la circulation sera interdite à tous les véhicules${c.riv ? ', sauf riverains, véhicules de secours et de service' : ', sauf véhicules de secours et de service'}`;
  let n = 1;
  for (const p of phases){
    const cls = state.els.filter(e => e.t === 'closure' && (p ? e.ph === p.id : true)); if (!cls.length) continue;
    const per = p ? `${esc(p.name)}${p.from || p.to ? ` (du ${fmtD(p.from)} au ${fmtD(p.to)})` : ''}` : `du ${fmtD(m.from)} au ${fmtD(m.to)}`;
    art.push(`<h3>Article ${n++}${p ? ' — ' + esc(p.name) : ''}</h3><p>Pendant la période ${per}, sur les voies suivantes :</p><ul>${cls.map(c => `<li><b>${esc(c.name || 'voie')}</b> : ${modeTxt(c)}.</li>`).join('')}</ul>`);
    const dets = state.els.filter(e => e.t === 'detour' && cls.some(c => c.id === e.cl));
    if (dets.length) art.push(`<h3>Article ${n++} — Déviations${p ? ' (' + esc(p.name) + ')' : ''}</h3><ul>${dets.map(d => `<li>${esc(d.name)}${d.cls && d.cls !== 'tous' ? ` (${esc(d.cls)})` : ''} : par ${esc(d.via || 'les voies adjacentes')}${d.extra ? ` (allongement d'environ ${Math.round(d.extra)} m)` : ''}.</li>`).join('')}</ul>`);
  }
  if (!art.length) art.push('<p><i>Aucune fermeture n\'est encore dessinée dans le projet.</i></p>');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Projet d'arrêté · ${esc(state.name)}</title><style>
    @page{size:A4;margin:22mm 20mm}body{font:12pt/1.5 Georgia,'Times New Roman',serif;color:#111;max-width:170mm;margin:0 auto;padding:10mm 0}h1{font:700 15pt Arial;text-align:center;text-transform:uppercase;margin:0 0 4mm}
    h2{font:600 11pt Arial;text-align:center;margin:0 0 8mm;color:#333}h3{font:700 11.5pt Arial;margin:6mm 0 2mm}.brouillon{border:1px dashed #C62828;color:#C62828;font:600 9.5pt Arial;padding:2mm 3mm;margin-bottom:6mm}
    .sig{margin-top:14mm;text-align:right}.print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;font:600 12px Arial;cursor:pointer}@media print{.print,.brouillon{display:none}}</style></head><body>
    <button class="print" onclick="print()">Imprimer / PDF</button>
    <div class="brouillon">Projet généré par ARCHITRAFIC à partir du plan de chantier : à relire, compléter et faire signer par l'autorité compétente (maire, président du conseil départemental ou préfet selon la voie).</div>
    <h1>Arrêté ${m.arrete ? 'n° ' + esc(m.arrete) : 'temporaire'}</h1><h2>portant réglementation temporaire de la circulation<br>${esc(state.site?.label || '')}</h2>
    <p>L'autorité investie du pouvoir de police de la circulation,</p>
    <p>Vu le Code général des collectivités territoriales, notamment ses articles L2213-1 et suivants ;<br>Vu le Code de la route, notamment ses articles R411-8, R411-25 et R411-28 ;<br>Vu l'arrêté interministériel du 24 novembre 1967 modifié relatif à la signalisation des routes et autoroutes ;<br>Vu l'instruction interministérielle sur la signalisation routière, notamment sa 8e partie (signalisation temporaire) ;<br>Vu la demande présentée par ${esc(m.entreprise || "l'entreprise chargée des travaux")}${m.moa ? ` pour le compte de ${esc(m.moa)}` : ''} ;</p>
    <p>Considérant que la réalisation des travaux « ${esc(state.name)} » nécessite de réglementer temporairement la circulation afin d'assurer la sécurité des usagers et des intervenants ;</p>
    <p style="text-align:center;font:700 12pt Arial;margin:6mm 0">ARRÊTE</p>${art.join('')}
    <h3>Article ${n++} — Signalisation</h3><p>La signalisation réglementaire, conforme à l'instruction interministérielle (8e partie), sera mise en place, entretenue et déposée par ${esc(m.entreprise || "l'entreprise")}, qui en assure la surveillance de jour comme de nuit. Elle comprend notamment : ${signSummary()}.</p>
    <h3>Article ${n++} — Accès</h3><p>L'accès des riverains, des véhicules de secours et d'incendie et des services publics sera maintenu en permanence dans la mesure du possible. Les cheminements piétons seront maintenus avec une largeur d'au moins 1,40 m.</p>
    <h3>Article ${n++} — Infractions</h3><p>Les infractions au présent arrêté seront constatées et poursuivies conformément aux lois et règlements en vigueur.</p>
    <h3>Article ${n++} — Exécution</h3><p>Le présent arrêté sera affiché aux extrémités des sections concernées. Ampliation en sera adressée aux services de police ou de gendarmerie, au SDIS, aux services de transport en commun concernés et à ${esc(m.entreprise || "l'entreprise")}, chargés chacun en ce qui le concerne de son exécution.</p>
    <p class="sig">Fait à …………………, le ………………<br><br>L'autorité compétente</p></body></html>`;
  openDoc(html, `${safeName(state.name)}-projet-arrete.html`);
}
function signSummary(){ const c = {}; for (const e of state.els) if (e.t === 'obj'){ const s = LIBK[e.k]?.sign; if (s) c[s.replace(/_.*/, '')] = (c[s.replace(/_.*/, '')] || 0) + 1; }
  const t = Object.entries(c).map(([k, n]) => `${n} ${k}`).join(', '); return t || 'les panneaux de type AK, K et KD adaptés'; }
function openDoc(html, fname){
  const w = window.open('', '_blank'); if (w){ w.document.open(); w.document.write(html); w.document.close(); toast('Document ouvert dans un nouvel onglet : « Imprimer / PDF » pour l\'enregistrer.', 5000); }
  else { downloadBlob(new Blob([html], {type:'text/html'}), fname); toast('Fenêtre bloquée : document téléchargé (à ouvrir puis imprimer en PDF).', 5000); }
}
