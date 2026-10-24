/* ============ Mode simple, assistant pas à pas et visite guidée ============
   Mode simple (par défaut) : seuls les outils et exports utiles à un plan de déviation classique sont affichés.
   Mode expert : tout (balisage, emprises, cotes, giration, simulation, calques, tous les exports).
   L'assistant suit l'avancement du chantier : lieu → route barrée → déviation → signalisation → dates → dossier. */
const LS = {get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }};
let SIMPLE = LS.get('at.simple', '1') === '1', GUIDE_OPEN = LS.get('at.guide', '1') === '1';
const SIMPLE_EXPORTS = new Set(['dossier', 'a3', 'png', 'pngd', 'avis', 'arrete']);
function applySimple(){
  document.body.classList.toggle('simple', SIMPLE);
  $$('#exportMenu [data-act]').forEach(b => b.classList.toggle('adv', !SIMPLE_EXPORTS.has(b.dataset.act)));
  const m = $('#modeBtn'); if (m){ m.textContent = SIMPLE ? 'Mode simple' : 'Mode expert'; m.title = SIMPLE ? 'Passer en mode expert : tous les outils, la simulation et tous les exports' : 'Revenir au mode simple : l\'essentiel pour un plan de déviation'; m.setAttribute('aria-pressed', !SIMPLE); }
  if (SIMPLE && ['move', 'rotate', 'copy', 'zone', 'line', 'arrow', 'measure', 'swept'].includes(tool)) setTool('select');
  if (SIMPLE && activeTab === 'traffic') setTab('props');
  if (SIMPLE && SIM.on) $('#simPlay')?.click();
}
function setSimple(on){ SIMPLE = on; LS.set('at.simple', on ? '1' : '0'); applySimple(); toast(on ? 'Mode simple : l\'essentiel pour un plan de déviation.' : 'Mode expert : tous les outils, la simulation et tous les exports.', 2600); }

/* ---------- assistant ---------- */
const nOf = t => state?.els?.filter(e => e.t === t && !e.hidden).length || 0;
const GUIDE = [
  {k:'site', t:'Lieu du chantier', d:'Cherchez l\'adresse du chantier : le quartier (rues, bâtiments, relief) se charge tout seul.', done:() => !!state?.site, go:() => setTool('site'), btn:'Choisir l\'adresse'},
  {k:'close', t:'Barrer la rue', d:'Survolez la rue puis cliquez : le tronçon entre deux carrefours est barré. Cliquez sur d\'autres tronçons pour allonger.', done:() => nOf('closure') > 0, go:() => { if (view !== '2d') setView('2d'); setTool('close'); }, btn:'Outil route barrée'},
  {k:'det', t:'Vérifier la déviation', d:'La déviation est calculée automatiquement (poids lourds, écoles, zones 30…). Vérifiez son tracé ; vous pouvez la recalculer ou la redessiner.', done:() => nOf('detour') > 0 || state?.els?.some(e => e.t === 'closure' && ['alternat', 'voie'].includes(e.mode)), go:guideShowWork, btn:'Voir le chantier'},
  {k:'sig', t:'Contrôler la signalisation', d:'Les panneaux réglementaires sont posés automatiquement. Le contrôle signale ce qui manque ou ne va pas.', done:() => guideChecked, go:() => { guideChecked = true; checkDialog(); renderGuide(); }, btn:'Contrôler le chantier'},
  {k:'info', t:'Dates et intervenants', d:'Ils apparaissent sur le cartouche, l\'arrêté et l\'avis aux riverains.', done:() => !!(state?.meta?.from && state?.meta?.to), form:true},
  {k:'exp', t:'Sortir le dossier', d:'Un PDF prêt à signer : plan de chaque phase, routes barrées, déviations, panneaux et projet d\'arrêté.', done:() => guideExported, go:() => { guideExported = true; if (canExport()) exportDossier(); renderGuide(); }, btn:'Dossier d\'arrêté (PDF)', alt:[['Plan A3', () => { if (canExport()) exportA3(); }], ['Avis riverains', () => { if (canExport()) exportAvis(); }]]},
];
let guideChecked = false, guideExported = false, guideKey = '';
function guideShowWork(){ const W = workEls(); if (view !== '2d') setView('2d'); if (W.length) frameEls(W); const c = state.els.find(e => e.t === 'closure'); if (c){ sel = c.id; applySel(); if (activeTab !== 'props') setTab('props'); else refreshPanel(); } }
function renderGuide(){
  let g = $('#guide'); if (!g){ g = document.createElement('aside'); g.id = 'guide'; g.className = 'guide'; g.setAttribute('aria-label', 'Assistant'); vpEl.appendChild(g); }
  const show = GUIDE_OPEN && !!state && !$('#app')?.hidden; g.hidden = !show; $('#guideBtn')?.setAttribute('aria-pressed', show);
  if (!show) return;
  const st = GUIDE.map(s => !!s.done()), cur = st.indexOf(false), key = st.join() + cur + JSON.stringify([state.meta?.from, state.meta?.to, state.meta?.moa, state.meta?.entreprise]);
  if (key === guideKey && g.childElementCount) return; guideKey = key;
  const m = state.meta || {}, nDone = st.filter(Boolean).length;
  g.innerHTML = `<header><b>Votre plan en ${GUIDE.length} étapes</b><span>${nDone}/${GUIDE.length}</span><button type="button" class="g-x" aria-label="Fermer l'assistant" title="Fermer (le bouton Guide le rouvre)">×</button></header>
    <i class="g-bar"><i style="width:${nDone / GUIDE.length * 100}%"></i></i>
    <ol>${GUIDE.map((s, i) => `<li class="${st[i] ? 'ok' : i === cur ? 'cur' : ''}" data-i="${i}"><span class="g-n">${st[i] ? '✓' : i + 1}</span><div><b>${s.t}</b>${i === cur ? `<p>${s.d}</p>${s.form ? `<div class="g-form"><label>Du<input type="date" id="gFrom" value="${esc(m.from || '')}"></label><label>Au<input type="date" id="gTo" value="${esc(m.to || '')}"></label><label class="w">Maître d'ouvrage<input id="gMoa" value="${esc(m.moa || '')}" placeholder="Ville de…"></label><label class="w">Entreprise<input id="gEnt" value="${esc(m.entreprise || '')}" placeholder="Entreprise de travaux"></label></div>` : `<div class="g-acts"><button type="button" class="btn primary" data-go="${i}">${s.btn}</button>${(s.alt || []).map((a, j) => `<button type="button" class="btn" data-alt="${i}.${j}">${a[0]}</button>`).join('')}</div>`}` : ''}</div></li>`).join('')}</ol>
    ${cur < 0 ? '<p class="g-end">Tout est prêt. Vous pouvez encore ajuster le plan, puis réexporter.</p>' : ''}
    <footer><button type="button" class="g-link" id="gTour">Visite de l'interface</button></footer>`;
  g.querySelector('.g-x').onclick = () => { GUIDE_OPEN = false; LS.set('at.guide', '0'); renderGuide(); };
  g.querySelectorAll('[data-go]').forEach(b => b.onclick = () => GUIDE[+b.dataset.go].go());
  g.querySelectorAll('[data-alt]').forEach(b => { const [i, j] = b.dataset.alt.split('.'); b.onclick = () => GUIDE[+i].alt[+j][1](); });
  g.querySelectorAll('li.ok').forEach(li => li.onclick = () => GUIDE[+li.dataset.i].go?.());
  const setM = (id, k) => { const el = g.querySelector('#' + id); if (el) el.onchange = () => { edit(() => { state.meta[k] = el.value.trim(); }); save(); renderGuide(); }; };
  setM('gFrom', 'from'); setM('gTo', 'to'); setM('gMoa', 'moa'); setM('gEnt', 'entreprise');
  g.querySelector('#gTour').onclick = startTour;
}

/* ---------- visite guidée (bulles sur l'interface) ---------- */
const TOUR = [
  ['.tools', 'Les outils', 'À gauche : choisir le lieu, barrer une rue, dessiner une déviation, placer un panneau. Survolez un outil pour voir son raccourci clavier.'],
  ['.modes', 'Plan ou 3D', 'Le plan 2D sert à préparer et imprimer. La 3D aide à présenter le chantier aux élus et aux riverains.'],
  ['#panel', 'Le panneau de droite', 'Il montre les réglages de l\'élément sélectionné (rue barrée, déviation, panneau) et la bibliothèque de signalisation.'],
  ['#exportBtn', 'Exporter', 'Dossier d\'arrêté, plan A3, avis aux riverains : tout est cadré automatiquement sur le chantier.'],
  ['#modeBtn', 'Mode simple ou expert', 'Le mode expert ajoute le balisage, les emprises, les cotes, la giration, la simulation du trafic et tous les formats d\'export.'],
  ['#guideBtn', 'L\'assistant', 'Il vous accompagne étape par étape. Rouvrez-le ici à tout moment.'],
];
function startTour(){
  let i = 0; const ov = document.createElement('div'); ov.className = 'tour'; ov.innerHTML = '<i class="t-hole"></i><div class="t-bub" role="dialog" aria-live="polite"></div>'; document.body.appendChild(ov);
  const hole = ov.querySelector('.t-hole'), bub = ov.querySelector('.t-bub');
  const end = () => { ov.remove(); LS.set('at.tour', '1'); removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') end(); else if (e.key === 'ArrowRight' || e.key === 'Enter') next(); };
  const show = () => {
    const [q, t, d] = TOUR[i], el = $(q), r = el && el.offsetParent !== null ? el.getBoundingClientRect() : null;
    if (!r){ i++; return i < TOUR.length ? show() : end(); }
    const pad = 6; Object.assign(hole.style, {left:r.left - pad + 'px', top:r.top - pad + 'px', width:r.width + pad * 2 + 'px', height:r.height + pad * 2 + 'px'});
    bub.innerHTML = `<small>${i + 1} / ${TOUR.length}</small><b>${t}</b><p>${d}</p><div><button type="button" class="btn" data-t="skip">Passer</button><button type="button" class="btn primary" data-t="next">${i === TOUR.length - 1 ? 'Terminer' : 'Suivant'}</button></div>`;
    const bw = 300, bh = bub.offsetHeight || 160; let x = r.right + 14, y = r.top;
    if (x + bw > innerWidth - 10){ x = Math.max(10, r.left - bw - 14); }
    if (r.width > innerWidth * 0.5 || x < 10){ x = Math.min(innerWidth - bw - 10, Math.max(10, r.left)); y = r.bottom + 14; }
    if (y + bh > innerHeight - 10) y = Math.max(10, r.top - bh - 14);
    Object.assign(bub.style, {left:x + 'px', top:y + 'px'});
    bub.querySelector('[data-t=skip]').onclick = end; bub.querySelector('[data-t=next]').onclick = next;
  };
  const next = () => { i++; if (i >= TOUR.length) end(); else show(); };
  addEventListener('keydown', key); show();
}

/* ---------- boutons d'en-tête et démarrage ---------- */
(function initGuide(){
  const acts = $('.top .acts'); if (!acts) return;
  const mk = (id, html, title) => { const b = document.createElement('button'); b.className = 'ib g-hdr'; b.id = id; b.type = 'button'; b.innerHTML = html; b.title = title; acts.insertBefore(b, $('#fileBtn')); return b; };
  mk('guideBtn', '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/></svg><span>Guide</span>', 'Assistant pas à pas').onclick = () => { GUIDE_OPEN = !GUIDE_OPEN; LS.set('at.guide', GUIDE_OPEN ? '1' : '0'); guideKey = ''; renderGuide(); };
  mk('modeBtn', 'Mode simple', '').onclick = () => setSimple(!SIMPLE);
  applySimple();
  let wasOpen = false;
  setInterval(() => {   // suivi léger de l'avancement (pas d'abonnement aux nombreux points de modification du projet)
    const open = !!state && !$('#app')?.hidden && $('#home')?.hidden !== false;
    if (open) renderGuide(); else if ($('#guide')) $('#guide').hidden = true;
    if (open && !wasOpen && LS.get('at.tour', '') !== '1' && window.__apReady) setTimeout(startTour, 900);
    if (open !== wasOpen){ guideChecked = guideExported = false; guideKey = ''; }
    wasOpen = open;
    document.body.classList.toggle('has-ph', !!state?.phases?.length);
  }, 700);
})();
