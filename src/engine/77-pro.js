/* ============ Outils « pro » : alternat selon le trafic, piétons / cycles / bus / secours, planning des phases,
   export Waze (CIFS), devis, fiche de pose terrain, avis aux riverains, DXF du plan de signalisation ============ */

/* ---------- 1. trafic estimé et mode d'alternat (guide CEREMA « Voirie urbaine », vol. 3) ----------
   B15 + C18 : < 400 véh/h (deux sens), zone courte et visible (≤ 100 m) ; piquets K10 : jusqu'à 1 000 véh/h ;
   feux KR11 : jusqu'à ≈ 800 véh/h, rouge ≤ 2 min 30 s ; au-delà : alternat déconseillé (fermeture + déviation). */
const TMJA_CLASS = {1:30000, 2:12000, 3:6000, 4:2500, 5:600, 6:150, 7:80, 8:50};
function trafficEstimate(cl){ if (cl.vph > 0) return {vph:+cl.vph, src:'saisi'}; const cls = Math.min(...cl.ids.slice(1).map((id, k) => NET.roads[NET.segIdx.get(segKey(cl.ids[k], id))?.ri]?.cls || 8));
  return {vph:Math.round((TMJA_CLASS[cls] || 300) * 0.1), src:'estimé (classe de voie)'}; }   // heure de pointe ≈ 10 % du trafic journalier
function alternatAdvice(cl){
  const {vph, src} = trafficEstimate(cl), L = cl.len || plLen(cl.pts);
  const redS = Math.round(L / 5 + 20);   // dégagement de la zone à ≈ 18 km/h + 20 s de vert minimum
  if (vph < 400 && L <= 100) return {mode:'B15/C18', vph, src, txt:`${vph} véh/h (${src}) et ${Math.round(L)} m : priorité par panneaux B15 / C18 suffisante.`};
  if (vph <= 800 && redS <= 150) return {mode:'KR11', vph, src, txt:`${vph} véh/h (${src}) : feux tricolores KR11 (rouge ≈ ${redS} s, maximum 2 min 30).`};
  if (vph <= 1000) return {mode:'K10', vph, src, txt:`${vph} véh/h (${src}) : piquets K10 tenus par des agents (au-delà de 800 véh/h ou ${Math.round(L)} m, les feux ne suffisent plus).`};
  return {mode:'impossible', vph, src, txt:`${vph} véh/h (${src}) : alternat déconseillé au-delà de 1 000 véh/h → fermeture avec déviation ou travaux de nuit.`};
}

/* ---------- 2-3. piétons, cycles, bus, secours : contrôles ajoutés au contrôle du chantier ---------- */
function extraChecks(add, els){
  const W = WORLD?.W; if (!W) return;
  const cls = els.filter(e => e.t === 'closure' && e.pts?.length > 1), zones = els.filter(e => e.t === 'zone' && e.pts?.length > 2);
  // arrêts de bus sur une section barrée
  for (const p of W.points.filter(p => p.k === 'bus_stop')) for (const c of cls){ for (let k = 0; k + 1 < c.pts.length; k++) if (V.dist(segClosest([p.x, p.y], c.pts[k], c.pts[k + 1]).pt, [p.x, p.y]) < 18){ add('warn', `Arrêt de bus « ${p.tags?.name || 'sans nom'} » sur ${c.name} : prévoir un arrêt provisoire et prévenir l'exploitant`, [p.x, p.y]); break; } }
  // pistes cyclables coupées
  for (const c of cls){ const cyc = c.ids.slice(1).some((id, k) => { const r = NET.roads[NET.segIdx.get(segKey(c.ids[k], id))?.ri]; return r && /lane|track|share/.test(r.cycle || ''); }); if (cyc) add('warn', `${c.name} : aménagement cyclable coupé — déviation vélo ou cheminement partagé à signaler (panonceau M4d)`, plAt(c.pts, plLen(c.pts) / 2).pt); }
  // emprises qui mordent sur un trottoir : cheminement piéton ≥ 1,40 m à maintenir
  const walks = W.roads.filter(r => r.foot && /footway|pedestrian/.test(r.hw));
  for (const z of zones){ const hit = walks.some(r => r.pts.some(q => inPoly(q[0], q[1], z.pts))) || W.roads.some(r => r.drive && r.sidewalk && r.sidewalk !== 'no' && r.pts.some(q => inPoly(q[0], q[1], z.pts)));
    if (hit) add('warn', `${z.name || 'Emprise'} : trottoir occupé — cheminement piéton provisoire ≥ 1,40 m (PMR) avec barrières et panneau « Piétons, passez en face »`, centroid(z.pts)); }
  // impasses créées : nœuds encore desservis mais coupés du réseau → accès secours et demi-tour
  if (cls.length){ const C = closedSets(els), start = [...NET.nodes.values()].sort((a, b) => V.len(b.xy) - V.len(a.xy))[0]; const seen = new Set([start.id]), st = [start];
    while (st.length){ const n = st.pop(); for (const ei of n.out){ const e = NET.edges[ei]; if (seen.has(e.to) || C.both.has(e.key)) continue; seen.add(e.to); st.push(NET.nodes.get(e.to)); } for (const ei of n.inn){ const e = NET.edges[ei]; if (seen.has(e.from) || C.both.has(e.key)) continue; seen.add(e.from); st.push(NET.nodes.get(e.from)); } }
    const inCl = new Set(cls.flatMap(c => c.ids)), cut = [...NET.nodes.values()].filter(n => !seen.has(n.id) && !inCl.has(n.id) && nodeDeg(n) >= 2 && n.out.length && Math.abs(n.xy[0]) < WORLD.size / 2 - 50 && Math.abs(n.xy[1]) < WORLD.size / 2 - 50);
    if (cut.length > 2){ const c = cut.reduce((a, n) => [a[0] + n.xy[0] / cut.length, a[1] + n.xy[1] / cut.length], [0, 0]); add('err', `Secteur enclavé (${cut.length} carrefours) : plus aucun accès véhicules — maintenir un accès secours / riverains`, c); } }
  // virages serrés des déviations sur voie étroite (pompiers, PL : épure de giration conseillée)
  for (const d of els.filter(e => e.t === 'detour' && e.ids?.length > 2)) for (const t of routeTurns(d.ids)){ if (Math.abs(t.ang) < 1.9) continue; const nr = nearestRoad(t.xy, 12); if (nr && nr.r.w < 5.5){ add('warn', `${d.name} : virage serré sur voie étroite (${nr.r.w.toFixed(1)} m) — vérifier la giration des PL et engins de secours`, t.xy); break; } }
}

/* ---------- 4. planning des phases (frise) ---------- */
function phasePlanning(){
  const P = (state.phases || []).filter(p => p.from && p.to); if (!P.length){ toast('Donnez des dates aux phases (double-clic sur une phase) pour voir le planning.', 5000); return; }
  const t0 = Math.min(...P.map(p => Date.parse(p.from))), t1 = Math.max(...P.map(p => Date.parse(p.to) + 864e5)), span = t1 - t0, d = t => new Date(t).toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
  const rows = state.phases.map((p, i) => { const ok = p.from && p.to, a = ok ? (Date.parse(p.from) - t0) / span * 100 : 0, w = ok ? (Date.parse(p.to) + 864e5 - Date.parse(p.from)) / span * 100 : 0, n = state.els.filter(e => e.t === 'closure' && e.ph === p.id).length;
    return `<div class="gt-r"><span>${esc(p.name)}<small>${n} route${n > 1 ? 's' : ''} barrée${n > 1 ? 's' : ''}</small></span><i>${ok ? `<b style="left:${a}%;width:${Math.max(2, w)}%" title="${d(Date.parse(p.from))} → ${d(Date.parse(p.to))}">${d(Date.parse(p.from))} – ${d(Date.parse(p.to))}</b>` : '<em>sans dates</em>'}</i></div>`; }).join('');
  const over = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Date.parse(P[i].from) <= Date.parse(P[j].to) && Date.parse(P[j].from) <= Date.parse(P[i].to)) over.push(`${P[i].name} et ${P[j].name} se chevauchent`);
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Planning des travaux</p><h3 class="ed-name" style="margin:0">${d(t0)} → ${d(t1 - 864e5)}</h3></div></div><div class="ed-body gantt" style="display:block">${rows}${over.map(o => `<p class="ph-w">⚠ ${esc(o)} : les fermetures des deux phases seront en place en même temps</p>`).join('')}</div><div class="ed-f"><span style="flex:1"></span><button class="btn primary" id="gtOk">Fermer</button></div>`);
  $('#gtOk').onclick = closeEngine;
}

/* ---------- 5. export Waze / services GPS (format CIFS) ---------- */
function exportWaze(){
  const P = WORLD?.P; if (!P){ toast('Chargez d\'abord le lieu du chantier.'); return; } const m = state.meta || {};
  const iso = (d, end) => d ? new Date(d + (end ? 'T20:00:00' : 'T07:00:00')).toISOString().replace('.000Z', '+00:00') : undefined;
  const incidents = state.els.filter(e => e.t === 'closure').map((c, i) => { const ph = state.phases?.find(p => p.id === c.ph), ll = c.pts.map(q => P.toLL(q[0], q[1]));
    return {id:`architrafic-${c.id}`, type:c.mode === 'total' ? 'ROAD_CLOSED' : 'HAZARD', subtype:c.mode === 'total' ? 'ROAD_CLOSED_CONSTRUCTION' : 'HAZARD_ON_ROAD_CONSTRUCTION', polyline:ll.map(q => `${q[1].toFixed(6)} ${q[0].toFixed(6)}`).join(' '),
      street:c.name || '', starttime:iso(ph?.from || m.from), endtime:iso(ph?.to || m.to, true), description:`${c.mode === 'total' ? 'Route barrée' : c.mode === 'alternat' ? 'Circulation alternée' : 'Voie neutralisée'} — ${state.name}`, direction:c.mode === 'total' || c.mode === 'alternat' ? 'BOTH_DIRECTIONS' : 'ONE_DIRECTION', reference:m.arrete || undefined}; });
  if (!incidents.length){ toast('Aucune route barrée à transmettre.'); return; }
  downloadBlob(new Blob([JSON.stringify({incidents}, null, 2)], {type:'application/json'}), `${safeName(state.name)}-waze-cifs.json`);
  toast('Fichier CIFS enregistré : à transmettre via le programme partenaires Waze for Cities (ou à votre service mobilité).', 7000);
}

/* ---------- 7. devis estimatif (prix de location indicatifs, modifiables) ---------- */
const PRICE = {sign:2.5, K2:3, K5a:0.4, KR11:45, K10:0, eng:180, veh:90, def:2, pose:1.2, agent:38};
function exportDevis(){
  const m = state.meta || {}, days = m.from && m.to ? Math.max(1, Math.round((Date.parse(m.to) - Date.parse(m.from)) / 864e5) + 1) : 5, rows = new Map();
  for (const e of state.els) if (e.t === 'obj'){ const L = LIBK[e.k]; if (!L) continue; const k = (L.sign || e.k) + '|' + L.name;
    const pu = /^K2$/.test(e.k) ? PRICE.K2 : /^K5/.test(e.k) ? PRICE.K5a : /KR11/.test(e.k) ? PRICE.KR11 : L.cat === 'eng' ? PRICE.eng : L.cat === 'veh' ? PRICE.veh : L.sign ? PRICE.sign : PRICE.def; const r = rows.get(k) || {n:0, pu}; r.n++; rows.set(k, r); }
  let tot = 0; const n = [...rows.values()].reduce((s, r) => s + r.n, 0);
  const tr = [...rows].sort().map(([k, r]) => { const [ref, name] = k.split('|'), st = r.n * r.pu * days; tot += st; return `<tr><td>${esc(ref)}</td><td>${esc(name)}</td><td class="n">${r.n}</td><td class="n" contenteditable>${r.pu.toFixed(2)}</td><td class="n">${days}</td><td class="n">${st.toFixed(2)}</td></tr>`; }).join('');
  const pose = n * PRICE.pose * 2, alt = state.els.filter(e => e.t === 'closure' && e.mode === 'alternat').length, ag = alt ? alt * 2 * 8 * days * PRICE.agent : 0; tot += pose + ag;
  openDoc(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Devis estimatif · ${esc(state.name)}</title><style>body{font:12px/1.4 Inter,Arial;max-width:190mm;margin:10mm auto;color:#111}h1{font:700 17px Montserrat,Arial;color:#0B2A6B}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #E5E9F0;padding:4px 6px;text-align:left}.n{text-align:right}tfoot td{font-weight:700;border-top:2px solid #0B2A6B}.print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;cursor:pointer}@media print{.print{display:none}}</style></head><body>
    <button class="print" onclick="print()">Imprimer / PDF</button><h1>Devis estimatif — signalisation temporaire</h1><p>${esc(state.name)} · ${esc(state.site?.label || '')}<br>Durée : ${days} jour${days > 1 ? 's' : ''}${m.from ? ` (du ${esc(m.from)} au ${esc(m.to || '…')})` : ' (dates du chantier non renseignées : 5 jours par défaut)'}</p>
    <table><thead><tr><th>Réf.</th><th>Désignation</th><th class="n">Qté</th><th class="n">PU location / j (€ HT)</th><th class="n">Jours</th><th class="n">Montant (€ HT)</th></tr></thead><tbody>${tr}
    <tr><td></td><td>Pose et dépose (${n} éléments)</td><td class="n">${n * 2}</td><td class="n">${PRICE.pose.toFixed(2)}</td><td class="n">—</td><td class="n">${pose.toFixed(2)}</td></tr>${ag ? `<tr><td></td><td>Agents de régulation (piquets K10 / surveillance alternat)</td><td class="n">${alt * 2}</td><td class="n">${PRICE.agent.toFixed(2)} / h</td><td class="n">${days}</td><td class="n">${ag.toFixed(2)}</td></tr>` : ''}</tbody>
    <tfoot><tr><td></td><td>Total estimé</td><td></td><td></td><td></td><td class="n">${tot.toFixed(2)} € HT</td></tr></tfoot></table><p style="color:#6B7280;font-size:10.5px;margin-top:12px">Prix unitaires indicatifs, modifiables dans le tableau avant impression. Estimation sans valeur contractuelle.</p></body></html>`, `${safeName(state.name)}-devis.html`);
}

/* ---------- 8. fiche de pose terrain (téléphone) : chaque élément avec ses coordonnées GPS, case à cocher et lien carte ---------- */
function exportTerrain(){
  const P = WORLD?.P; if (!P) return; const items = state.els.filter(e => e.t === 'obj' && !phOff(e)).map(e => { const L = LIBK[e.k], [lon, lat] = P.toLL(e.x, e.y), near = nearestRoad([e.x, e.y], 30, false); return {e, L, lat, lon, rue:near?.r.name || ''}; }).sort((a, b) => a.rue.localeCompare(b.rue) || a.lat - b.lat);
  const rows = items.map((it, i) => `<label class="it"><input type="checkbox" data-i="${i}"><img src="${it.L?.sign ? signThumb(it.L.sign, {...(it.L.p || {}), ...(it.e.p || {})}) : thumbLazy(it.L)}" alt=""><span><b>${esc(it.L?.sign || it.e.k)}</b> ${esc(it.L?.name || '')}<small>${esc(it.rue)} · ${it.lat.toFixed(6)}, ${it.lon.toFixed(6)}</small></span><a href="https://www.google.com/maps/search/?api=1&query=${it.lat.toFixed(6)},${it.lon.toFixed(6)}" target="_blank">Carte</a></label>`).join('');
  openDoc(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pose · ${esc(state.name)}</title><style>body{font:15px/1.35 Inter,Arial;margin:0;background:#F4F6FA;color:#111}header{position:sticky;top:0;background:#0B2A6B;color:#fff;padding:12px 16px}header b{display:block;font-size:16px}#bar{height:6px;background:rgba(255,255,255,.25);border-radius:9px;margin-top:8px;overflow:hidden}#bar i{display:block;height:100%;width:0;background:#F5B700}
    .it{display:flex;gap:10px;align-items:center;background:#fff;margin:8px 12px;padding:10px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.it input{width:24px;height:24px;flex:none}.it img{width:44px;height:44px;object-fit:contain;flex:none}.it span{flex:1;min-width:0}.it small{display:block;color:#6B7280;font-size:12px}.it a{font-size:13px;color:#1565C0;flex:none}.it:has(input:checked){opacity:.5}</style></head><body>
    <header><b>${esc(state.name)} — pose de la signalisation</b><span id="cnt">0 / ${items.length} posés</span><div id="bar"><i></i></div></header>${rows}
    <script>const k='pose-${state.id || safeName(state.name)}',st=JSON.parse(localStorage.getItem(k)||'{}'),bx=[...document.querySelectorAll('input[data-i]')];const up=()=>{const n=bx.filter(b=>b.checked).length;document.getElementById('cnt').textContent=n+' / '+bx.length+' posés';document.querySelector('#bar i').style.width=(n/bx.length*100)+'%';};bx.forEach(b=>{b.checked=!!st[b.dataset.i];b.onchange=()=>{st[b.dataset.i]=b.checked;localStorage.setItem(k,JSON.stringify(st));up();};});up();<\/script></body></html>`, `${safeName(state.name)}-fiche-pose.html`);
}

/* ---------- 9. avis aux riverains (affiche A4 avec plan) ---------- */
async function exportAvis(){
  const was = view; if (view !== '2d') setView('2d'); await sleep(120); const cv = await exportPNG(2, true); if (was !== '2d') setView(was);
  const m = state.meta || {}, fmt = d => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'}) : '…';
  const cls = state.els.filter(e => e.t === 'closure'), dets = state.els.filter(e => e.t === 'detour');
  openDoc(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avis aux riverains · ${esc(state.name)}</title><style>@page{size:A4;margin:12mm}body{font:13px/1.45 Inter,Arial;color:#111;max-width:186mm;margin:0 auto}h1{font:800 26px Montserrat,Arial;color:#C62828;text-transform:uppercase;margin:0}h2{font:700 15px Montserrat,Arial;color:#0B2A6B;margin:10px 0 4px}.bar{height:6px;background:linear-gradient(90deg,#1565C0,#0EA5C6 60%,#F5B700 80%,#E2541B);margin:8px 0 12px}img{width:100%;border:1px solid #C9D3DE;border-radius:4px}.box{background:#FFF8E1;border-left:5px solid #F5B700;padding:8px 12px;margin:10px 0}.print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;cursor:pointer}@media print{.print{display:none}}</style></head><body>
    <button class="print" onclick="print()">Imprimer / PDF</button><h1>Travaux — information aux riverains</h1><div class="bar"></div>
    <p><b>${esc(state.name)}</b> — ${esc(state.site?.label || '')}</p><div class="box"><b>Du ${fmt(m.from)} au ${fmt(m.to)}</b>${m.entreprise ? `<br>Entreprise : ${esc(m.entreprise)}` : ''}${m.moa ? ` — pour le compte de ${esc(m.moa)}` : ''}</div>
    <h2>Circulation</h2><ul>${cls.map(c => `<li><b>${esc(c.name)}</b> : ${c.mode === 'total' ? `fermée à la circulation${c.riv ? ' (accès riverains maintenu)' : ''}` : c.mode === 'alternat' ? 'circulation alternée' : 'voie neutralisée'}.</li>`).join('') || '<li>Pas de fermeture.</li>'}</ul>
    ${dets.length ? `<h2>Déviations</h2><ul>${dets.map(d => `<li>${esc(d.name)} : par ${esc(d.via || 'les rues voisines')}.</li>`).join('')}</ul>` : ''}
    <h2>Plan</h2><img src="${cv.toDataURL('image/jpeg', 0.88)}"><h2>Accès</h2><p>L'accès piéton aux habitations et commerces est maintenu. Les véhicules de secours peuvent intervenir à tout moment. Merci de votre compréhension pour la gêne occasionnée.</p></body></html>`, `${safeName(state.name)}-avis-riverains.html`);
}

/* ---------- 10. DXF du plan de signalisation (Lambert-93, calques par famille) ---------- */
function llToL93(lon, lat){ const a = 6378137, e = 0.0818191910428158, r = Math.PI / 180, m = p => Math.cos(p) / Math.sqrt(1 - e * e * Math.sin(p) ** 2), t = p => Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - e * Math.sin(p)) / (1 + e * Math.sin(p)), e / 2);
  const p1 = 44 * r, p2 = 49 * r, p0 = 46.5 * r, n = (Math.log(m(p1)) - Math.log(m(p2))) / (Math.log(t(p1)) - Math.log(t(p2))), F = m(p1) / (n * Math.pow(t(p1), n)), r0 = a * F * Math.pow(t(p0), n), rr = a * F * Math.pow(t(lat * r), n), th = n * (lon - 3) * r;
  return [700000 + rr * Math.sin(th), 6600000 + r0 - rr * Math.cos(th)]; }
function exportDXF(){
  const P = WORLD?.P; if (!P) return; const L = [], put = (...a) => L.push(...a.map(String)), xy = q => llToL93(...P.toLL(q[0], q[1]));
  const pl = (layer, pts, col) => { put(0, 'POLYLINE', 8, layer, 62, col, 66, 1, 70, 0); for (const q of pts){ const [x, y] = xy(q); put(0, 'VERTEX', 8, layer, 10, x.toFixed(3), 20, y.toFixed(3), 30, 0); } put(0, 'SEQEND', 8, layer); };
  put(0, 'SECTION', 2, 'ENTITIES');
  for (const e of state.els){
    if (e.t === 'closure' && e.pts?.length > 1) pl('TRAFIC_ROUTE_BARREE', e.pts, 1);
    else if (e.t === 'detour' && e.pts?.length > 1) pl('TRAFIC_DEVIATION', e.pts, 30);
    else if (e.t === 'zone' && e.pts?.length > 2) pl('CHANTIER_EMPRISE', [...e.pts, e.pts[0]], 4);
    else if (e.t === 'line' && e.pts?.length > 1) pl('BALISAGE', e.pts, 30);
    else if (e.t === 'obj'){ const Lb = LIBK[e.k], [x, y] = xy([e.x, e.y]), lay = Lb?.sign ? 'SIGNALISATION_' + (Lb.sign.match(/^[A-Z]+/)?.[0] || 'X') : 'MATERIEL'; put(0, 'POINT', 8, lay, 10, x.toFixed(3), 20, y.toFixed(3), 30, 0, 0, 'TEXT', 8, lay, 10, (x + 1).toFixed(3), 20, (y + 1).toFixed(3), 30, 0, 40, 1.2, 1, (Lb?.sign || e.k).replace(/_.*/, ''), 50, ((e.a || 0) * 180 / Math.PI).toFixed(1)); }
  }
  put(0, 'ENDSEC', 0, 'EOF');
  downloadBlob(new Blob([L.join('\r\n')], {type:'application/dxf'}), `${safeName(state.name)}-signalisation-L93.dxf`); toast('Plan DXF enregistré en Lambert-93 (EPSG:2154), calques par famille de panneaux.', 5000);
}
