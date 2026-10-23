/* ============ Heures de pointe et comparaison avant / après travaux ============
   Profil horaire : la densité choisie est celle de l'heure la plus chargée ; le profil module les entrées de véhicules
   selon l'heure de la simulation (horloge réglable). « Journée type » : courbe de trafic urbain en semaine (pointes
   8 h et 17-18 h, creux de nuit), proche des profils de comptage CEREMA.
   Comparaison : la même simulation est rejouée deux fois sans affichage (même tirage aléatoire), sans puis avec le
   chantier, sur la même durée ; on compare temps de parcours, retards, files d'attente et vitesses par rue. */
const DAY_PROFILE = [0.08, 0.05, 0.04, 0.04, 0.07, 0.2, 0.5, 0.85, 1, 0.75, 0.6, 0.62, 0.68, 0.62, 0.6, 0.65, 0.78, 0.95, 1, 0.8, 0.55, 0.4, 0.28, 0.15];
const PROFILE_NAMES = {const:'Constant', jour:'Journée type (pointes 8 h et 18 h)', perso:'Personnalisé'};
const simStartSec = () => Math.round((state?.sim?.start ?? 7.5) * 3600);
function simProfile(t = SIM.t){
  const p = state?.sim?.prof || 'const'; if (p === 'const') return 1;
  const tab = p === 'perso' && state.sim.hours?.length === 24 ? state.sim.hours : DAY_PROFILE, h = ((simStartSec() + t) / 3600) % 24, i = Math.floor(h), f = h - i;
  return Math.max(0, (+tab[i] || 0) * (1 - f) + (+tab[(i + 1) % 24] || 0) * f);
}
const hhmm = h => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
function profileBars(tab, cur){ const mx = Math.max(0.01, ...tab); return `<div class="prof-bars">${tab.map((v, i) => `<i style="height:${Math.round(4 + v / mx * 46)}px"${i === cur ? ' class="on"' : ''} title="${i} h : ${Math.round(v * 100)} %"></i>`).join('')}</div><div class="prof-ax"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>`; }
function profileDialog(){
  const S = state.sim, tab = (S.hours?.length === 24 ? S.hours : DAY_PROFILE).map(v => Math.round(v * 100));
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Simulation</p><h3 class="ed-name" style="margin:0">Profil horaire personnalisé</h3></div></div>
    <div class="ed-body" style="display:block"><p class="hint" style="margin-top:0">Trafic de chaque heure en % de l'heure la plus chargée (100 % = densité choisie). Reprenez par exemple un comptage de la rue.</p>
      <div id="prPrev">${profileBars(tab.map(v => v / 100))}</div>
      <div class="prof-grid">${tab.map((v, i) => `<label><span>${i} h</span><input type="number" min="0" max="200" step="5" data-h="${i}" value="${v}"></label>`).join('')}</div></div>
    <div class="ed-f"><button class="btn" id="prDay">Repartir de la journée type</button><span style="flex:1"></span><button class="btn" id="prNo">Annuler</button><button class="btn primary" id="prOk">Appliquer</button></div>`);
  const read = () => [...document.querySelectorAll('.prof-grid input')].map(i => clamp(+i.value || 0, 0, 200) / 100);
  document.querySelectorAll('.prof-grid input').forEach(i => i.oninput = () => { $('#prPrev').innerHTML = profileBars(read()); });
  $('#prDay').onclick = () => document.querySelectorAll('.prof-grid input').forEach((i, k) => { i.value = Math.round(DAY_PROFILE[k] * 100); i.oninput(); });
  $('#prNo').onclick = closeEngine;
  $('#prOk').onclick = () => { state.sim.hours = read(); state.sim.prof = 'perso'; save(); closeEngine(); renderPanel(); };
}
function profileFields(){
  const S = state.sim, p = S.prof || 'const', tab = p === 'perso' && S.hours?.length === 24 ? S.hours : p === 'jour' ? DAY_PROFILE : null;
  return `<label class="f wide"><span>Profil horaire</span><span class="in"><select id="tProf">${Object.entries(PROFILE_NAMES).map(([k, n]) => `<option value="${k}"${k === p ? ' selected' : ''}>${n}</option>`).join('')}</select></span></label>
    <label class="f"><span>Heure de départ</span><span class="in"><input id="tStart" type="time" step="900" value="${hhmm(S.start ?? 7.5)}"></span></label>
    ${p === 'perso' ? '<div class="f" style="align-self:end"><button class="btn" id="tProfEd">Modifier le profil…</button></div>' : '<div></div>'}
    ${tab ? `<div class="f wide">${profileBars(tab, Math.floor(((simStartSec() + SIM.t) / 3600) % 24))}<p class="hint" style="margin:4px 0 0">${SIM.t ? `Maintenant ${hhmm((simStartSec() + SIM.t) / 3600)} : ${Math.round(simProfile() * 100)} % de la pointe.` : 'La densité choisie correspond à l\'heure la plus chargée.'}</p></div>` : ''}`;
}
function bindProfileFields(){
  const p = $('#tProf'); if (!p) return;
  p.onchange = () => { state.sim.prof = p.value; if (p.value === 'perso' && state.sim.hours?.length !== 24) state.sim.hours = DAY_PROFILE.slice(); save(); renderPanel(); };
  $('#tStart').onchange = e => { const [h, m] = e.target.value.split(':').map(Number); if (Number.isFinite(h)){ state.sim.start = h + (m || 0) / 60; save(); simStatus(); renderPanel(); } };
  const ed = $('#tProfEd'); if (ed) ed.onclick = profileDialog;
}

/* ---------- comparaison avant / après ---------- */
function mulberry(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CMP = {run:null};
/* une simulation complète sans affichage ; C = routes fermées du scénario ; renvoie une promesse de statistiques */
function simBatch(C, dur, warm, seed, onProg, cancelled){
  return new Promise(resolve => {
    const trips = [], edges = new Map(), qmax = new Map(), qstep = new Map(); let devN = 0, spawned = 0;
    SIM.agents = []; SIM.t = 0; SIM.stats = {n:0, done:0, sumT:0, sumT0:0, dev:0}; SIM.occ = new Map(); SIM.resv = new Map(); SIM.nextSpawn = new Map(); SIM.lastAt = new Map();
    SIM.rc = new Map(); SIM.base = new Map(); SIM.jobs = new Map(); SIM.seq = 0; SIM.cKey = stateVer; SIM.cSet = C; SIM.cOpen = null;
    SIM.batch = {
      trip(a){ if (a.t0 < warm) return; trips.push({t:SIM.t - a.t0, free:a.free, dev:!!a.dev}); if (a.dev) devN++; },
      edge(ei, ratio, dt, q){ if (SIM.t < warm) return; const e = NET.edges[ei]; const o = edges.get(e.key) || edges.set(e.key, {r:e.r, sv:0, st:0, sp:e.sp}).get(e.key); o.sv += Math.min(1, ratio) * dt; o.st += dt; if (q) qstep.set(e.key, (qstep.get(e.key) || 0) + q); },
    };
    const rnd = mulberry(seed), DT = 0.5;
    const chunk = () => {
      if (cancelled()) { SIM.batch = null; resolve(null); return; }
      const mr = Math.random; Math.random = rnd; const end = performance.now() + 30;
      try {
        while (performance.now() < end && SIM.t < dur){
          SIM.cKey = stateVer; SIM.cSet = C; SIM.budget = Infinity; simJobs(); simStep(DT);
          for (const [k, q] of qstep) if (q > (qmax.get(k) || 0)) qmax.set(k, q); qstep.clear();
          spawned = SIM.stats.n;
        }
      } finally { Math.random = mr; }
      onProg(SIM.t / dur);
      if (SIM.t < dur) setTimeout(chunk, 0);
      else { SIM.batch = null; const left = SIM.agents.filter(a => a.t0 >= warm); resolve({trips, edges, qmax, devN:devN + left.filter(a => a.dev).length, spawned, enRoute:left.length, stuck:SIM.stats.stuck || 0, wait:left.reduce((s, a) => s + a.wait, 0)}); }
    };
    setTimeout(chunk, 0);
  });
}
function cmpStats(R){
  const T = R.trips.map(x => x.t).sort((a, b) => a - b), n = T.length, mean = n ? T.reduce((a, b) => a + b, 0) / n : 0, med = n ? T[Math.floor(n / 2)] : 0;
  const delay = n ? R.trips.reduce((s, x) => s + Math.max(0, x.t - x.free), 0) / n : 0, p90 = n ? T[Math.floor(n * 0.9)] : 0;
  const qByStreet = new Map(); for (const [k, q] of R.qmax){ const sg = NET.segIdx.get(k); const nm = sg ? NET.roads[sg.ri]?.name || 'voie sans nom' : '?'; qByStreet.set(nm, Math.max(qByStreet.get(nm) || 0, q)); }
  const qMax = Math.max(0, ...qByStreet.values());
  const street = new Map(); for (const [, o] of R.edges){ const nm = NET.roads[o.r]?.name; if (!nm) continue; const s = street.get(nm) || street.set(nm, {sv:0, st:0}).get(nm); s.sv += o.sv * o.sp; s.st += o.st; }
  return {n, mean, med, p90, delay, devN:R.devN, qByStreet, qMax, street, enRoute:R.enRoute, spawned:R.spawned};
}
/* moyenne de plusieurs tirages */
function cmpMean(L){
  const avg = k => L.reduce((s, x) => s + x[k], 0) / L.length, street = new Map(), qByStreet = new Map();
  for (const x of L){ for (const [nm, o] of x.street){ const s = street.get(nm) || street.set(nm, {sv:0, st:0}).get(nm); s.sv += o.sv; s.st += o.st / L.length; } for (const [nm, q] of x.qByStreet) qByStreet.set(nm, (qByStreet.get(nm) || 0) + q / L.length); }
  for (const s of street.values()) s.sv /= L.length;
  return {n:avg('n'), mean:avg('mean'), med:avg('med'), p90:avg('p90'), delay:avg('delay'), devN:avg('devN'), qMax:avg('qMax'), enRoute:avg('enRoute'), spawned:avg('spawned'), street, qByStreet};
}
function compareDialog(){
  if (!WORLD){ toast('Choisissez d\'abord le lieu du chantier.'); return; }
  const cls = state.els.filter(e => e.t === 'closure' && !phOff(e));
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Simulation${curPh() ? ' · ' + esc(phName(curPh())) : ''}</p><h3 class="ed-name" style="margin:0">Comparer avant / après travaux</h3></div></div>
    <div class="ed-body" style="display:block;overflow:auto"><p class="hint" style="margin-top:0">La même circulation est simulée deux fois, sans affichage : sans le chantier, puis avec ${cls.length ? `les ${cls.length} route${cls.length > 1 ? 's' : ''} barrée${cls.length > 1 ? 's' : ''} ${curPh() ? 'de la phase affichée' : 'du projet'}` : 'le chantier (aucune route barrée pour l\'instant !)'}. Même tirage des véhicules, même densité et même profil horaire.</p>
      <div class="fields"><label class="f"><span>Durée simulée</span><span class="in"><select id="cmpDur"><option value="600">10 min</option><option value="1200" selected>20 min</option><option value="1800">30 min</option><option value="3600">1 h</option></select></span></label>
      <label class="f"><span>Mise en route</span><span class="in"><select id="cmpWarm"><option value="120">2 min</option><option value="300" selected>5 min</option><option value="600">10 min</option></select></span></label></div>
      <div id="cmpProg" hidden><div class="cmp-bar"><i></i></div><p class="hint" id="cmpTxt" style="margin:6px 0 0"></p></div><div id="cmpRes"></div></div>
    <div class="ed-f"><span style="flex:1"></span><button class="btn" id="cmpNo">Fermer</button><button class="btn primary" id="cmpGo">Lancer la comparaison</button></div>`);
  let cancel = false;
  $('#cmpNo').onclick = () => { cancel = true; closeEngine(); };
  $('#cmpGo').onclick = async () => {
    const dur = +$('#cmpDur').value, warm = +$('#cmpWarm').value, total = dur + warm, go = $('#cmpGo'); go.disabled = true; $('#cmpProg').hidden = false; $('#cmpRes').innerHTML = '';
    const was = SIM.on; if (was) simStop(false);
    simBuildInstances(); if (!SIM.entries.length || SIM.entriesFor !== WORLD){ simEntries(); SIM.entriesFor = WORLD; }
    if (!SIM.entries.length){ toast('Aucune voie d\'entrée en bordure de zone.'); go.disabled = false; return; }
    const keep = {}; for (const k of ['agents', 't', 'stats', 'occ', 'resv', 'nextSpawn', 'lastAt', 'rc', 'base', 'jobs', 'seq', 'cKey', 'cSet', 'cOpen', 'cap']) keep[k] = SIM[k];
    const congKeep = {r:new Map(CONG.r), qmax:new Map(CONG.qmax)}, seed = (Math.random() * 1e9) | 0;
    const NS = 3, prog = (k, f) => { $('#cmpProg i').style.width = Math.round((k + f) / (2 * NS) * 100) + '%'; $('#cmpTxt').textContent = `${k % 2 ? 'Avec le chantier' : 'Sans le chantier'} · tirage ${Math.floor(k / 2) + 1}/${NS} : ${Math.round(f * 100)} %`; };
    let A = [], B = [];
    try {   // 3 tirages par scénario (mêmes graines des deux côtés) : la moyenne lisse le hasard des arrivées
      for (let s = 0; s < NS && !cancel; s++){
        const a = await simBatch(closedSets([]), total, warm, seed + s * 7919, f => prog(2 * s, f), () => cancel); if (!a) break; A.push(a);
        const b = await simBatch(closedSets(state.els), total, warm, seed + s * 7919, f => prog(2 * s + 1, f), () => cancel); if (!b) break; B.push(b);
      }
    } catch(err){ console.warn('comparaison', err); toast('La comparaison a échoué : ' + err.message); }
    finally {
      SIM.batch = null; Object.assign(SIM, keep); SIM.cKey = -1; CONG.r = congKeep.r; CONG.qmax = congKeep.qmax; CONG.q.clear();
      simRender(); simStatus(); if (was) simStart(); dirty = true;
    }
    if (cancel || A.length < NS || B.length < NS) return;
    $('#cmpProg').hidden = true; go.disabled = false; go.textContent = 'Relancer';
    CMP.last = {a:cmpMean(A.map(cmpStats)), b:cmpMean(B.map(cmpStats)), dur, warm, ph:curPh() ? phName(curPh()) : '', ncl:cls.length, at:new Date()};
    $('#cmpRes').innerHTML = compareHTML(CMP.last) + '<div class="btns" style="margin-top:10px"><button class="btn" id="cmpPrint">Imprimer / PDF</button></div>';
    $('#cmpPrint').onclick = () => openDoc(compareDoc(CMP.last), `${safeName(state.name)}-avant-apres.html`);
  };
}
function cmpVerdict(c){
  const d = c.b.mean - c.a.mean, q = c.b.qMax, loss = c.a.n ? 1 - c.b.n / c.a.n : 0;   // trajets écoulés en moins : le réseau absorbe moins de véhicules
  const lvl = d < 30 && q < 80 && loss < 0.1 ? ['ok', 'Impact faible'] : d < 120 && q < 200 && loss < 0.25 ? ['warn', 'Impact modéré'] : ['bad', 'Impact fort'];
  const txt = `${lvl[1]} : ${d >= 0 ? '+' : '−'}${fmtDur(Math.abs(d))} par trajet en moyenne${Math.round(c.b.devN) ? `, ${Math.round(c.b.devN)} véhicule${Math.round(c.b.devN) > 1 ? 's' : ''} dévié${Math.round(c.b.devN) > 1 ? 's' : ''}` : ''}${q >= 80 ? `, file jusqu'à ${Math.round(q)} m` : ''}.`;
  const tips = []; if (loss >= 0.1) tips.push(`Le réseau écoule ${Math.round(loss * 100)} % de trajets en moins pendant la même durée : la déviation et les carrefours voisins saturent.`);
  if (q >= 200) tips.push('File d\'attente importante : envisager un alternat plus court, des horaires hors pointe ou une déviation en amont.');
  if (d >= 120) tips.push('Allongement notable : vérifier le jalonnement de la déviation et prévenir les usagers (panneaux d\'information, Waze).');
  if (c.b.enRoute > c.a.enRoute * 1.4 + 10) tips.push('Le réseau se charge pendant la simulation : la capacité de la déviation est probablement insuffisante à cette heure.');
  return {cls:lvl[0], txt, tips};
}
function cmpStreets(c, n = 6){
  const out = [];
  for (const [nm, b] of c.b.street){ const a = c.a.street.get(nm); if (!a || a.st < 20 || b.st < 20) continue; const va = a.sv / a.st * 3.6, vb = b.sv / b.st * 3.6; out.push({nm, va, vb, d:va - vb, use:b.st}); }
  for (const [nm, a] of c.a.street) if (!c.b.street.has(nm) && a.st > 60) out.push({nm, va:a.sv / a.st * 3.6, vb:null, d:0, closed:true, use:a.st});
  return out.filter(x => x.closed || x.d > 2).sort((x, y) => (y.closed ? 1e6 : y.d * Math.log(10 + y.use)) - (x.closed ? 1e6 : x.d * Math.log(10 + x.use))).slice(0, n);
}
function compareHTML(c){
  const V = cmpVerdict(c), row = (lbl, a, b, f, worse = 1) => { const d = b - a; return `<tr><td>${lbl}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${d * worse > 0.5 ? 'up' : d * worse < -0.5 ? 'down' : ''}">${d >= 0 ? '+' : '−'}${f(Math.abs(d))}</td></tr>`; };
  const S = cmpStreets(c);
  return `<div class="cmp-v ${V.cls}"><b>${esc(V.txt)}</b>${V.tips.map(t => `<span>${esc(t)}</span>`).join('')}</div>
    <table class="cmp-t"><thead><tr><th></th><th>Sans chantier</th><th>Avec chantier</th><th>Écart</th></tr></thead><tbody>
      ${row('Temps de parcours moyen', c.a.mean, c.b.mean, fmtDur)}${row('Temps médian', c.a.med, c.b.med, fmtDur)}${row('9 trajets sur 10 en moins de', c.a.p90, c.b.p90, fmtDur)}
      ${row('Retard moyen (vs. circulation libre)', c.a.delay, c.b.delay, fmtDur)}${row('Véhicules déviés', c.a.devN, c.b.devN, v => String(Math.round(v)))}
      ${row('File d\'attente la plus longue', c.a.qMax, c.b.qMax, v => Math.round(v) + ' m')}${row('Trajets terminés', c.a.n, c.b.n, v => String(Math.round(v)), -1)}${row('Véhicules encore en route à la fin', c.a.enRoute, c.b.enRoute, v => String(Math.round(v)))}</tbody></table>
    <p class="eyebrow" style="margin:12px 0 4px">Rues les plus touchées (vitesse moyenne)</p>
    ${S.length ? `<table class="cmp-t"><tbody>${S.map(s => `<tr><td>${esc(s.nm)}</td><td>${Math.round(s.va)} km/h</td><td>${s.closed ? '<b style="color:#C62828">barrée</b>' : Math.round(s.vb) + ' km/h'}</td><td class="up">${s.closed ? '' : '−' + Math.round(s.d) + ' km/h'}</td></tr>`).join('')}</tbody></table>` : '<p class="hint">Aucune rue nettement ralentie.</p>'}
    <p class="hint" style="margin-top:8px">${Math.round(c.dur / 60)} min simulées après ${Math.round(c.warm / 60)} min de mise en route, densité « ${esc(String(state.sim.dens))} », profil ${esc(PROFILE_NAMES[state.sim.prof || 'const'])}, départ ${hhmm(state.sim.start ?? 7.5)}. Résultats indicatifs d'un modèle de trafic : à confirmer par des comptages.</p>`;
}
function compareDoc(c){
  const m = state.meta || {};
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Avant / après · ${esc(state.name)}</title><style>
    @page{size:A4;margin:16mm}body{font:11pt/1.45 Inter,Arial,sans-serif;color:#111827;max-width:180mm;margin:0 auto;padding:8mm 0}h1{font:700 17pt Montserrat,Arial;color:#0B2A6B;margin:0 0 2mm}.sub{color:#4B5563;margin-bottom:6mm}
    .cmp-v{border-radius:3mm;padding:3mm 4mm;margin:4mm 0;display:flex;flex-direction:column;gap:1.5mm}.cmp-v.ok{background:#E8F5E9}.cmp-v.warn{background:#FFF4E0}.cmp-v.bad{background:#FDECEA}
    table{border-collapse:collapse;width:100%;margin:2mm 0}td,th{border-bottom:1px solid #E5E9F0;padding:1.6mm 2mm;text-align:right}td:first-child,th:first-child{text-align:left}td.up{color:#C62828;font-weight:600}td.down{color:#2E7D32;font-weight:600}
    .eyebrow{font:700 9pt Montserrat,Arial;text-transform:uppercase;letter-spacing:.06em;color:#0B2A6B}.hint{color:#6B7280;font-size:9.5pt}.bar{height:2mm;background:linear-gradient(90deg,#1565C0,#0EA5C6 60%,#F5B700 80%,#E2541B);margin-bottom:6mm}
    .print{position:fixed;right:10px;top:10px;padding:8px 14px;border-radius:99px;border:0;background:#1565C0;color:#fff;font-weight:600;cursor:pointer}@media print{.print{display:none}}</style></head><body>
    <button class="print" onclick="print()">Imprimer / PDF</button><div class="bar"></div><h1>Impact du chantier sur la circulation</h1>
    <div class="sub">${esc(state.name)}${state.site?.label ? ' · ' + esc(state.site.label) : ''}${c.ph ? ' · ' + esc(c.ph) : ''}${m.moa ? ` · Maître d'ouvrage : ${esc(m.moa)}` : ''} · simulation du ${c.at.toLocaleDateString('fr-FR')}</div>
    ${compareHTML(c)}</body></html>`;
}
