/* ============ Menu clic droit (appui long au doigt) ============
   1) NOYAU COMMUN « PrismCtx » : le même code dans toutes les apps Studio Prism (ARCHITRAFIC, ARCHIPLAN, SPECTRA, Nexus…).
      Il ne connaît rien de l'app : on lui donne une liste d'actions { label, hint, checked, danger, disabled, onClick, sub:[…] }.
   2) ACTIONS D'ARCHITRAFIC : ce que propose le menu selon ce qu'on vise (route barrée, emprise, objet, plan vide, tracé en cours).
   Clic droit sans bouger = menu ; clic droit glissé = déplacement de la vue (comme avant). Au doigt : appui long. */

/* ---------- 1) noyau commun ---------- */
const PrismCtx = window.PrismCtx || (window.PrismCtx = (() => {
  let menus = [], prevFocus = null, armed = false;
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const close = () => {
    for (const m of menus) m.remove(); menus = [];
    if (armed){ armed = false; for (const [t, f, o] of LISTEN) window.removeEventListener(t, f, o); }
    if (prevFocus?.isConnected) try { prevFocus.focus({preventScroll:true}); } catch(_){ } prevFocus = null;
  };
  const isOpen = () => menus.length > 0;
  const place = (m, x, y, anchor) => {
    m.style.left = '0px'; m.style.top = '0px'; m.style.visibility = 'hidden'; document.body.appendChild(m);
    const w = m.offsetWidth, h = m.offsetHeight, W = innerWidth, H = innerHeight, g = 6;
    let l = x, t = y;
    if (anchor){ l = anchor.right - 3; if (l + w > W - g) l = Math.max(g, anchor.left - w + 3); t = anchor.top - 6; }
    else if (l + w > W - g) l = x - w;                 // pas la place à droite du curseur : le menu s'ouvre vers la gauche
    if (t + h > H - g) t = anchor ? H - g - h : y - h;  // pas la place en bas : vers le haut
    m.style.left = Math.max(g, Math.min(l, W - w - g)) + 'px'; m.style.top = Math.max(g, Math.min(t, H - h - g)) + 'px'; m.style.visibility = '';
  };
  const closeFrom = depth => { while (menus.length > depth){ menus.pop().remove(); } };
  function build(items, depth, title){
    const m = mk('div', 'pctx'); m.setAttribute('role', 'menu'); m.tabIndex = -1; m.dataset.depth = depth;
    if (title) m.appendChild(mk('div', 'pctx-h', title));
    let any = false;
    for (const it of items){
      if (!it) continue;
      if (it.sep){ if (any) m.appendChild(Object.assign(mk('div', 'pctx-sep'), {role:'separator'})); continue; }
      if (it.header){ m.appendChild(mk('div', 'pctx-h', it.header)); continue; }
      any = true;
      const b = mk('button', 'pctx-i' + (it.danger ? ' danger' : '')); b.type = 'button'; b.disabled = !!it.disabled;
      b.setAttribute('role', it.checked != null ? 'menuitemradio' : 'menuitem'); if (it.checked != null) b.setAttribute('aria-checked', String(!!it.checked));
      b.append(mk('span', 'pctx-ic', it.checked ? '✓' : (it.icon || '')), mk('span', 'pctx-t', it.label));
      if (it.hint) b.appendChild(mk('kbd', 'pctx-k', it.hint));
      if (it.sub){ b.appendChild(mk('span', 'pctx-ar', '›')); b.setAttribute('aria-haspopup', 'true'); }
      const openSub = focus => { closeFrom(depth + 1); for (const x of m.querySelectorAll('.open')) x.classList.remove('open'); b.classList.add('open');
        const s = build(it.sub, depth + 1); menus.push(s); place(s, 0, 0, b.getBoundingClientRect()); if (focus) s.querySelector('.pctx-i:not(:disabled)')?.focus(); };
      b.addEventListener('pointerenter', () => { if (b.disabled) return; if (it.sub) openSub(false); else { closeFrom(depth + 1); m.querySelectorAll('.open').forEach(x => x.classList.remove('open')); } });
      b.addEventListener('click', ev => { ev.stopPropagation(); if (b.disabled) return; if (it.sub){ openSub(true); return; }
        close(); try { it.onClick?.(); } catch(err){ console.warn('menu contextuel', err); } });
      b.addEventListener('keydown', ev => { if (it.sub && ev.key === 'ArrowRight' && !b.disabled){ ev.preventDefault(); openSub(true); } });
      m.appendChild(b);
    }
    m.addEventListener('keydown', ev => {
      const bs = [...m.querySelectorAll(':scope > .pctx-i:not(:disabled)')], i = bs.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown'){ ev.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
      else if (ev.key === 'ArrowUp'){ ev.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
      else if (ev.key === 'Home'){ ev.preventDefault(); bs[0]?.focus(); } else if (ev.key === 'End'){ ev.preventDefault(); bs.at(-1)?.focus(); }
      else if (ev.key === 'ArrowLeft' && depth){ ev.preventDefault(); const p = menus[depth - 1]; closeFrom(depth); p?.querySelector('.pctx-i.open')?.focus(); }
    });
    return m;
  }
  /* fermeture : clic ailleurs, Échap, défilement, redimensionnement, changement de fenêtre */
  const away = ev => { if (ev.type === 'keydown'){ if (ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); if (menus.length > 1) closeFrom(menus.length - 1); else close(); } return; }
    if (ev.type === 'blur' || ev.type === 'resize') return close();
    if (!menus.some(m => m.contains(ev.target))) close(); };
  const LISTEN = [['pointerdown', away, true], ['wheel', away, {capture:true, passive:true}], ['keydown', away, true], ['resize', away, false], ['blur', away, false]];
  function open(x, y, items, title){
    close(); if (!items?.some(i => i && !i.sep && !i.header)) return false;
    prevFocus = document.activeElement; const m = build(items, 0, title); menus = [m]; place(m, x, y);
    armed = true; for (const [t, f, o] of LISTEN) window.addEventListener(t, f, o);
    m.focus({preventScroll:true}); return true;
  }
  /* branche le menu sur un élément : clic droit sans glisser, appui long au doigt ; getItems(ev) → {items, title} | tableau | null
     (ev porte clientX/clientY ; renvoyer null laisse le comportement par défaut du navigateur) */
  function attach(target, getItems, o = {}){
    const LP = o.longPress ?? 520, TOL = 6; let rt = null, tp = null, lastRight = -1e9;
    const show = (ev, x, y) => { const r = getItems(ev, x, y); const items = Array.isArray(r) ? r : r?.items; return !!items?.length && open(x, y, items, r?.title); };
    const stopLP = () => { if (tp){ clearTimeout(tp.t); tp = null; } };
    target.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse'){ if (ev.button === 2){ rt = {x:ev.clientX, y:ev.clientY, at:performance.now()}; lastRight = rt.at; } return; }
      if (!ev.isPrimary){ stopLP(); return; }
      stopLP(); const d = {x:ev.clientX, y:ev.clientY, clientX:ev.clientX, clientY:ev.clientY, target:ev.target, pointerType:ev.pointerType};
      tp = {x:d.x, y:d.y, t:setTimeout(() => { tp = null; if (show(d, d.x, d.y)) o.onLongPress?.(); }, LP)};
    });
    target.addEventListener('pointermove', ev => { if (tp && Math.hypot(ev.clientX - tp.x, ev.clientY - tp.y) > 8) stopLP(); });
    for (const t of ['pointerup', 'pointercancel']) target.addEventListener(t, ev => {
      stopLP(); if (!rt) return; const r = rt; rt = null;
      if (t === 'pointerup' && ev.button === 2 && Math.hypot(ev.clientX - r.x, ev.clientY - r.y) <= TOL && performance.now() - r.at < 600) show(ev, ev.clientX, ev.clientY);
    });
    target.addEventListener('contextmenu', ev => { ev.preventDefault();
      if (performance.now() - lastRight < 800) return;               // clic droit souris : déjà traité au relâchement
      if (ev.pointerType === 'touch' || ev.pointerType === 'pen') return;   // appui long : déjà traité par le minuteur
      show(ev, ev.clientX, ev.clientY); });                          // Ctrl+clic (Mac), touche Menu du clavier
  }
  return {open, close, isOpen, attach};
})());

/* ---------- 2) actions d'ARCHITRAFIC ---------- */
const CTX_TYPE = {closure:'Route barrée', detour:'Déviation', zone:'Emprise', obj:'Objet', note:'Annotation', dim:'Cote', line:'Ligne', arrow:'Flèche', model:'Modèle', swept:'Giration', site:'Site'};
const CTX_MODE = {total:'Route barrée', alternat:'Alternat', sens:'Voie neutralisée', voie:'Voie neutralisée'};
const ctxName = e => (e.t === 'obj' ? (LIBK[e.k]?.n || LIBK[e.k]?.name) : '') || e.name || (e.text ? String(e.text).slice(0, 28) : '') || (e.t === 'closure' ? CTX_MODE[e.mode] : '') || CTX_TYPE[e.t] || 'Élément';
const CTX_DUP = new Set(['obj', 'note', 'model', 'zone', 'line', 'arrow']);   // éléments qu'on peut dupliquer tels quels (une route barrée a ses déviations et panneaux : on la retrace)

/* barrage levé : la rue est de nouveau ouverte (le trafic la reprend, la déviation et les panneaux disparaissent) ; rétabli : tout revient */
function ctxLift(e, off){
  const nm = ctxName(e);
  edit(() => { if (off) e.off = true; else delete e.off; });
  if (off && sel === e.id){ sel = null; applySel(); refreshPanel(); }
  toast(off ? `${nm} levé : la circulation reprend sur cette rue.${SIM?.on ? '' : ' Lancez la simulation pour la voir.'} Clic droit sur le plan → « Rétablir le barrage » pour le remettre.`
            : `${nm} rétabli : la rue est de nouveau fermée et le trafic dévié.`, 6000);
}
/* phase : l'élément (et, pour une route barrée, ses déviations et panneaux) passe dans la phase choisie ; id vide = toutes les phases */
function ctxSetPhase(e, ph){ for (const x of [e, ...(e.t === 'closure' ? state.els.filter(x => x.cl === e.id || x.auto === e.id) : [])]){ if (ph) x.ph = ph; else delete x.ph; } }
function ctxAssignPhase(e, ph){ edit(() => ctxSetPhase(e, ph));
  toast(ph ? `${ctxName(e)} : ${phName(ph)}${curPh() && curPh() !== ph ? ' (masqué dans la vue actuelle)' : ''}` : `${ctxName(e)} : toutes les phases`); }
function ctxNewPhase(e){ const id = uid8(); let nm = '';
  edit(() => { state.phases = state.phases || []; nm = `Phase ${state.phases.length + 1}`; state.phases.push({id, name:nm, from:'', to:''}); if (e) ctxSetPhase(e, id); });
  toast(e ? `${nm} créée : ${ctxName(e)} y est rattaché${curPh() && curPh() !== id ? ' (masqué dans la vue actuelle)' : ''}.` : `${nm} créée.`); }
const ctxPhaseSub = e => [
  {label:'Toutes les phases (permanent)', checked:!e.ph, onClick:() => ctxAssignPhase(e, '')},
  ...(state.phases || []).map(p => ({label:p.name, checked:e.ph === p.id, onClick:() => ctxAssignPhase(e, p.id)})),
  {sep:true}, {label:'Nouvelle phase…', onClick:() => ctxNewPhase(e)}];

/* actions d'un élément visé (plan ou liste de la colonne de droite) */
function ctxElementItems(e){
  const items = [];
  const select = () => { sel = e.id; applySel(); if (activeTab !== 'props') setTab('props'); else refreshPanel(); };
  items.push({label:'Propriétés', onClick:select});
  if (e.t === 'closure'){
    items.push({sep:true}, e.off ? {label:'Rétablir le barrage', onClick:() => ctxLift(e, false)} : {label:'Lever le barrage (le trafic reprend)', onClick:() => ctxLift(e, true)});
    if (e.mode === 'total' && WORLD && !e.off) items.push({label:'Recalculer la déviation', onClick:() => { edit(() => addDetoursFor(e)); toast('Déviation recalculée.'); }});
  }
  /* phase : une déviation ou un panneau posé automatiquement suit sa route barrée */
  const host = e.t === 'detour' || (e.t === 'obj' && e.auto) ? state.els.find(x => x.id === (e.cl || e.auto)) : e;
  if (host && ['closure', 'zone', 'obj', 'note'].includes(host.t)){
    items.push({sep:true}, {label:'Phase de travaux', hint:host.ph ? phName(host.ph) : 'Toutes', sub:ctxPhaseSub(host)});
    if (host.ph) items.push({label:`Voir seulement ${phName(host.ph)}`, onClick:() => setPhase(host.ph)});
  }
  if (e.t === 'obj'){
    items.push({sep:true}, {label:'Pivoter de 90°', onClick:() => edit(() => { e.a = (e.a || 0) + Math.PI / 2; e.manualA = true; })});
    if (LIBK[e.k]?.sign) items.push({label:'Orienter selon la route', onClick:() => edit(() => { const a = autoOrient(e.x, e.y); if (a != null) e.a = a; e.manualA = false; })});
  }
  items.push({sep:true});
  if (CTX_DUP.has(e.t)) items.push({label:'Dupliquer', onClick:() => { const c = JSON.parse(JSON.stringify(e)); c.id = uid8(); if (c.x != null) { c.x += 3; c.y += 3; } else shiftEl(c, [3, 3]); addEl(c); }});
  items.push({label:e.hidden ? 'Afficher' : 'Masquer', onClick:() => edit(() => { e.hidden = !e.hidden; })});
  items.push({label:'Supprimer', danger:true, hint:'Suppr', onClick:() => { sel = e.id; deleteSel(); }});
  return {items, title:ctxName(e) + (e.t === 'closure' && e.off ? ' (levé)' : '')};
}

/* clic droit à vide : ce qui concerne tout le plan */
function ctxGroundItems(q){
  const items = [], lifted = state.els.filter(e => e.t === 'closure' && e.off), hid = state.els.filter(e => e.hidden);
  const nr = q && WORLD ? nearestRoad(q, 10) : null;
  if (nr) items.push({label:'Barrer cette rue ici', onClick:() => makeClosure(nr)});
  const nrA = q && WORLD ? nearestRoad(q, 10, false) : null;
  if (nrA && (nrA.r._o?.drive ?? nrA.r.drive)) items.push({label:'Corriger cette rue…', hint:(state.roadFix || {})[nrA.r.id] ? 'corrigée' : '', onClick:() => roadFixDialog(nrA)});
  if (lifted.length) items.push({label:lifted.length > 1 ? 'Rétablir un barrage levé' : `Rétablir ${ctxName(lifted[0])}`,
    ...(lifted.length > 1 ? {sub:[...lifted.map(c => ({label:ctxName(c) + (c.ph ? ' · ' + phName(c.ph) : ''), onClick:() => ctxLift(c, false)})), {sep:true}, {label:'Tout rétablir', onClick:() => { edit(() => { for (const c of lifted) delete c.off; }); toast('Tous les barrages sont rétablis.'); }}]}
                                  : {onClick:() => ctxLift(lifted[0], false)})});
  if (hid.length) items.push({label:`Afficher les éléments masqués (${hid.length})`, onClick:() => edit(() => { for (const e of hid) e.hidden = false; })});
  if (items.length) items.push({sep:true});
  const P = state.phases || [];
  if (P.length) items.push({label:'Phase affichée', hint:curPh() ? phName(curPh()) : 'Toutes', sub:[{label:'Toutes les phases', checked:!curPh(), onClick:() => setPhase('all')}, ...P.map(p => ({label:p.name, checked:curPh() === p.id, onClick:() => setPhase(p.id)}))]});
  items.push({label:'Nouvelle phase', onClick:() => ctxNewPhase(null)});
  if (state.els.filter(e => e.t === 'closure').length > 1) items.push({label:'Phasage automatique', onClick:() => autoPhasing()});
  items.push({sep:true}, {label:'Annuler', hint:'Ctrl+Z', disabled:!hist.length, onClick:undo}, {label:'Refaire', hint:'Ctrl+Maj+Z', disabled:!redoS.length, onClick:redo});
  if (sel) items.push({sep:true}, {label:'Désélectionner', onClick:() => { sel = null; applySel(); refreshPanel(); }});
  return {items, title:'Plan'};
}

/* tracé en cours : ce qu'on peut faire du tracé commencé */
function ctxDrawItems(){
  const poly = POLY_TOOLS.has(tool), n = draw.pts.length, items = [];
  if (poly) items.push({label:'Terminer le tracé', hint:'Double-clic', disabled:n < (tool === 'zone' ? 3 : 2), onClick:() => finishPoly()});
  if (poly && n > 1) items.push({label:'Retirer le dernier point', onClick:() => { draw.pts.pop(); updatePolyPreview(); syncHud(); }});
  items.push({label:tool === 'measure' ? 'Annuler la mesure' : 'Abandonner le tracé', hint:'Échap', danger:true, onClick:() => { cancelDraw(); setPrompt(); syncHud(); }});
  return {items, title:'Tracé en cours'};
}

PrismCtx.attach(canvas, ev => {
  if (typeof state === 'undefined' || !state) return null;
  if (!$('#loadBox')?.hidden) return null;
  if (draw?.pts?.length) return ctxDrawItems();
  const id = pickEl(ev), e = id ? byId(id) : null;
  if (e){ if (sel !== id){ sel = id; applySel(); refreshPanel(); } return ctxElementItems(e); }
  return ctxGroundItems(groundAt(ev));
}, {onLongPress:() => { down = null; if (drag){ drag = null; ctl().enabled = true; } }});   // l'appui long ne doit ni sélectionner ni poser un objet au relâchement

/* même menu sur les lignes de la liste d'éléments (colonne de droite) */
document.addEventListener('contextmenu', ev => {
  const r = ev.target.closest?.('[data-el]'); if (!r || !state) return;
  const e = byId(r.dataset.el); if (!e) return; ev.preventDefault();
  { const m = ctxElementItems(e); PrismCtx.open(ev.clientX, ev.clientY, m.items, m.title); }
});
