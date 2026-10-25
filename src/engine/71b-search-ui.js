/* ============ Recherche intelligente : bibliothèque, éléments du chantier, palette globale Ctrl+K ============ */
const SEARCH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
const whyTag = why => why && why.length ? `<em class="spk-why" title="Trouvé par le sens du mot">${esc(why.map(synLabel).join(', '))}</em>` : '';
/* propositions quand rien ne correspond : concepts proches de ce qui a été tapé */
function spkSuggest(q, attr = 'data-q'){
  const toks = sTokens(q), near = new Set();
  for (const t of toks){ if (t.length < 3) continue; for (const [w, set] of SYN_WORD){ if (w.startsWith(t) || t.startsWith(w) || (t.length >= 5 && sEdit(t, w, 2) <= 2)) for (const k of set) near.add(k); if (near.size > 6) break; } }
  const L = [...near].slice(0, 6); if (!L.length) return ' Essayez un autre mot (code du panneau, usage, famille d\'engins).';
  return ` Essayez : ${L.map(k => `<button type="button" class="spk-chip" ${attr}="${esc(synLabel(k).toLowerCase().split(' / ')[0])}">${esc(synLabel(k))}</button>`).join(' ')}`;
}

/* ---------- bibliothèque : remplace le filtre « contient » par la recherche intelligente ---------- */
function libSearchItems(q){
  const res = smartSearch(q, searchLib(), {limit:160});
  return res.map(r => ({...r.item.e, _why:r.why}));
}
let elQ = '';
/* ---------- palette globale ---------- */
const GS = {el:null, open:false, q:'', act:-1, rows:[], more:new Set()};
function gsEl(){
  if (GS.el) return GS.el;
  const d = document.createElement('div'); d.id = 'gsPal'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Recherche dans ARCHITRAFIC');
  d.innerHTML = `<div class="gs-box"><div class="gs-top">${SEARCH_ICON}<input type="search" class="gs-q" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" placeholder="Rechercher partout : panneau, code (AK5, B14), engin, outil, rue barrée, déviation, export…" aria-label="Rechercher"><kbd>Échap</kbd><button type="button" class="ib ghost gs-x" aria-label="Fermer">✕</button></div><div class="gs-list"></div><div class="gs-foot"><span>↑ ↓ parcourir · Entrée ouvrir</span><span class="gs-n"></span></div></div>`;
  document.body.appendChild(d); GS.el = d;
  const q = d.querySelector('.gs-q');
  q.addEventListener('input', () => { GS.q = q.value; GS.act = -1; GS.more.clear(); gsRender(); });
  d.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape'){ e.preventDefault(); closePalette(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = GS.rows.length; if (!n) return; GS.act = GS.act < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (GS.act + (e.key === 'ArrowDown' ? 1 : -1) + n) % n; gsMark(true); }
    else if (e.key === 'Enter'){ e.preventDefault(); const i = GS.act >= 0 ? GS.act : 0; if (GS.rows[i]) gsRun(GS.rows[i]); }
  });
  d.querySelector('.gs-x').addEventListener('click', closePalette);
  d.addEventListener('click', e => {
    if (e.target === d){ closePalette(); return; }
    const m = e.target.closest('[data-more]'); if (m){ GS.more.add(m.dataset.more); gsRender(); return; }
    const c = e.target.closest('.spk-chip'); if (c){ q.value = c.dataset.q; GS.q = q.value; GS.act = -1; gsRender(); q.focus(); return; }
    const r = e.target.closest('.gs-r'); if (r) gsRun(GS.rows[+r.dataset.i]);
  });
  d.addEventListener('pointermove', e => { const r = e.target.closest('.gs-r'); if (!r) return; const i = +r.dataset.i; if (i !== GS.act){ GS.act = i; gsMark(false); } });
  return d;
}
function openPalette(prefill){
  const d = gsEl(); $$('.menu').forEach(m => m.hidden = true);
  d.hidden = false; GS.open = true; const q = d.querySelector('.gs-q'); q.value = prefill || ''; GS.q = q.value; GS.act = -1; GS.more.clear(); gsRender();
  requestAnimationFrame(() => { q.focus({preventScroll:true}); q.select(); });
}
function closePalette(){ if (!GS.open) return; GS.open = false; GS.el.hidden = true; }
function placeFromLib(k){
  PLACE = {k, a:0, p:LIBK[k]?.p ? {...LIBK[k].p} : {}}; if (ghost){ previewGroup.remove(ghost); ghost = null; }
  tool = 'place'; $$('.tool').forEach(t => t.setAttribute('aria-pressed', t.dataset.tool === 'place')); syncHud(); setPrompt();
  libCat = LIBK[k]?.cat || libCat; libQ = ''; if (!isNarrow.matches) setTab('lib'); else renderPanel();
}
function gsTools(){
  const out = [];
  for (const b of $$('.tools .tool[data-tool]')){ const lbl = b.querySelector('span')?.textContent.trim() || b.dataset.tool, title = b.title || ''; const key = title.match(/\(([A-Z0-9])\)/)?.[1] || '', sub0 = title.replace(/\s*\([A-Z0-9]\)\s*:?/, '').trim();
    out.push({kind:'tool', id:b.dataset.tool, nom:lbl, sub:(!sub0 || sub0 === lbl ? 'Outil' : sub0) + (key ? ` · touche ${key}` : ''), key, ix:sIndex(lbl, {kw:title + ' ' + b.dataset.tool, tags:['outil']}), run:() => setTool(b.dataset.tool)}); }
  for (const b of $$('.modes button[data-mode]')) out.push({kind:'tool', id:'mode-' + b.dataset.mode, nom:`Vue ${b.textContent.trim()}`, sub:'Mode d\'affichage', ix:sIndex(`vue ${b.textContent} ${b.dataset.mode === '2d' ? 'plan 2d dessus' : b.dataset.mode === '3d' ? '3d maquette' : 'rendu réaliste'}`, {tags:['outil', 'rendu']}), run:() => b.click()});
  for (const b of $$('.tabs button[data-tab]')) out.push({kind:'tool', id:'tab-' + b.dataset.tab, nom:`Onglet ${b.textContent.trim()}`, sub:'Panneau', ix:sIndex(`onglet ${b.textContent} ${b.dataset.tab === 'lib' ? 'bibliothèque panneaux engins véhicules' : b.dataset.tab === 'traffic' ? 'trafic simulation comparaison heures de pointe' : b.dataset.tab === 'legend' ? 'légende plan' : 'chantier éléments informations'}`, {tags:['outil']}), run:() => { setTab(b.dataset.tab); openPanelMobile(); }});
  for (const [menuId, grp] of [['#fileMenu', 'Fichier'], ['#exportMenu', 'Exporter']]) for (const b of $$(`${menuId} button`)){ const t = b.querySelector('b')?.textContent.trim() || b.textContent.trim(); if (!t) continue; const s = b.querySelector('span')?.textContent.trim() || '';
    out.push({kind:'tool', id:menuId + t, nom:t, sub:`${grp}${s ? ' · ' + s : ''}`, ix:sIndex(t + ' ' + s, {tags:['plan', 'outil'], kw:grp}), run:() => { $$('.menu').forEach(m => m.hidden = true); b.click(); }}); }
  const extra = [
    ['Lieu du chantier…', 'Adresse, rues, bâtiments, relief', ['site'], () => openSiteDialog()],
    ['Lancer / arrêter la simulation', 'Barre d\'espace', ['simulation'], () => { SIM.on ? simStop(false) : simStart(); }],
    ['Annuler', 'Ctrl+Z', ['outil'], () => undo()], ['Rétablir', 'Ctrl+Y', ['outil'], () => redo()],
    ['Cadrer le chantier', 'Vue d\'ensemble', ['outil', 'rendu'], () => fit()],
  ];
  if (typeof openPhases === 'function') extra.push(['Phases du chantier…', 'Phasage, dates, phasage automatique', ['phases'], () => openPhases()]);
  for (const [t, s, tags, run] of extra) out.push({kind:'tool', id:'x-' + t, nom:t, sub:s, ix:sIndex(t + ' ' + s, {tags}), run});
  return out;
}
function gsAll(){
  const lib = searchLib().map(x => ({kind:'lib', id:x.id, nom:x.e.name, sub:`${LIB_CATS[x.e.cat] || ''}${x.e.ref ? ' · ' + x.e.ref : ''}`, e:x.e, ix:x.ix, run:() => placeFromLib(x.id)}));
  const lines = Object.entries(LINE_TYPES).map(([k, T]) => ({kind:'line', id:k, nom:T.n, sub:'Balisage en ligne', col:T.col, ix:sIndex(T.n, {kw:k + ' ' + (T.item || '') + ' balisage en ligne', tags:['balisage']}), run:() => { TOOLOPT.line = k; TOOLOPT.lineSp = ''; saveToolOpt(); setTool('line'); }}));
  const swept = Object.entries(SWEPT_VEH).map(([k, v]) => ({kind:'swept', id:k, nom:v.n, sub:'Épure de giration', ix:sIndex(v.n, {kw:k + ' giration epure', tags:['giration']}), run:() => { TOOLOPT.veh = k; saveToolOpt(); setTool('swept'); }}));
  const els = (state?.els || []).map(e => ({kind:'el', id:e.id, nom:elLabel(e), sub:`${EL_NAME[e.t] || e.t}${elSub(e) ? ' · ' + elSub(e) : ''}`, e, ix:elIndexAT(e), run:() => { sel = e.id; applySel(); const c = elCenter(e); frameAt(c[0], c[1], e.pts ? Math.max(30, plLen(e.pts) / 2) : 25); setTab('props'); openPanelMobile(); }}));
  const phases = (state?.phases || []).map((p, i) => ({kind:'phase', id:p.id, nom:p.name || `Phase ${i + 1}`, sub:`Phase${p.from ? ' · du ' + p.from : ''}${p.to ? ' au ' + p.to : ''}`, ix:sIndex((p.name || `Phase ${i + 1}`) + ' phase', {kw:'phase ' + (i + 1), tags:['phases']}), run:() => { if (typeof setPhase === 'function') setPhase(p.id); else if (typeof openPhases === 'function') openPhases(); }}));
  return {Outils:gsTools(), 'Bibliothèque':lib, 'Balisage en ligne':lines, 'Épures de giration':swept, 'Éléments du chantier':els, Phases:phases};
}
function gsRender(){
  const d = GS.el, list = d.querySelector('.gs-list'), q = GS.q; let h = '', rows = [];
  const all = gsAll();
  if (!sHasQuery(q)){
    h += `<div class="gs-hint">Tapez un mot : un code de panneau (AK5, B14), un usage (« vitesse » trouve toutes les limitations, « déviation » les KD et la route barrée, « piétons » le cheminement et les passages), un engin, un outil, un élément déjà posé ou un export.</div>`;
    h += `<div class="spk-chips">${[['vitesse', 'vitesse'], ['déviation', 'déviation'], ['piétons', 'piétons'], ['balisage', 'balisage'], ['feux de chantier', 'feux de chantier'], ['poids lourds', 'poids lourds'], ['pelle', 'engins'], ['pdf', 'export PDF']].map(([qq, n]) => `<button type="button" class="spk-chip" data-q="${esc(qq)}">${esc(n)}</button>`).join('')}</div>`;
    const tools = all.Outils.slice(0, 10); h += `<div class="gs-g">Outils</div>`; for (const it of tools){ rows.push(it); h += gsRow(it, rows.length - 1); }
    d.querySelector('.gs-n').textContent = '';
  } else {
    let total = 0;
    const found = Object.entries(all).map(([grp, items]) => [grp, smartSearch(q, items, {limit:60})]).filter(([, res]) => res.length);
    const GP = {Outils:0, 'Bibliothèque':1, 'Balisage en ligne':2, 'Épures de giration':3, 'Éléments du chantier':4, Phases:5};
    found.sort((a, b) => (Math.abs(b[1][0].s - a[1][0].s) > 0.02 ? b[1][0].s - a[1][0].s : 0) || (GP[a[0]] ?? 9) - (GP[b[0]] ?? 9));
    for (const [grp, res] of found){ total += res.length;
      const N = GS.more.has(grp) ? res.length : (grp === 'Outils' ? 6 : 6);
      h += `<div class="gs-g">${esc(grp)} <span>${res.length}</span></div>`;
      for (const r of res.slice(0, N)){ rows.push(r.item); h += gsRow(r.item, rows.length - 1, r.why); }
      if (res.length > N) h += `<button type="button" class="gs-more" data-more="${esc(grp)}">Voir les ${res.length - N} autres…</button>`;
    }
    if (!total) h += `<p class="spk-empty">Aucun résultat pour « ${esc(q)} ».${spkSuggest(q)}</p>`;
    d.querySelector('.gs-n').textContent = total ? `${total} résultat${total > 1 ? 's' : ''}` : '';
  }
  GS.rows = rows; list.innerHTML = h; list.scrollTop = 0;
  // vignettes des panneaux (générées à la demande)
  for (const img of list.querySelectorAll('img[data-gth]')){ const L = LIBK[img.dataset.gth]; if (L) img.src = THUMBS[L.k] || libThumb(L); }
}
function gsRow(it, i, why){
  const ico = it.kind === 'lib' ? `<span class="gs-th"><img data-gth="${esc(it.id)}" alt=""></span>` : it.kind === 'line' ? `<i class="gs-k" style="background:${it.col};color:#fff">—</i>` : it.kind === 'el' ? `<span class="gs-k gs-k-el">${elIcon(it.e)}</span>` : `<i class="gs-k gs-k-${it.kind}">${{tool:'⌘', swept:'↻', phase:'≡'}[it.kind] || '•'}</i>`;
  return `<button type="button" class="gs-r${i === GS.act ? ' act' : ''}" data-i="${i}">${ico}<span class="spk-t"><b>${sHighlight(it.nom, GS.q)}</b><small>${esc(it.sub || '')}</small></span>${whyTag(why)}${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}</button>`;
}
function gsMark(scroll){ const d = GS.el; d.querySelectorAll('.gs-r.act').forEach(r => r.classList.remove('act')); const r = d.querySelector(`.gs-r[data-i="${GS.act}"]`); if (r){ r.classList.add('act'); if (scroll) r.scrollIntoView({block:'nearest'}); } }
function gsRun(it){ if (!it) return; closePalette(); it.run(); }
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'){ e.preventDefault(); e.stopPropagation(); if (GS.open) closePalette(); else openPalette(); return; }
  if (GS.open) return;
  const t = e.target, inField = t.closest && t.closest('input,select,textarea,[contenteditable]');
  if (e.key === '/' && !inField && !e.ctrlKey && !e.metaKey && !e.altKey && $('#engDlg').hidden){ e.preventDefault(); openPalette(); }
}, true);
$('#searchBtn')?.addEventListener('click', () => openPalette());
if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)){ const k = $('#searchBtn .sb-k'); if (k) k.textContent = '⌘ K'; }
