/* ============ Phasage des travaux ============
   Un chantier se découpe en phases (phase 1 : cette rue, phase 2 : celle-là…). Chaque élément appartient à une phase,
   ou à toutes (permanent : base vie, panneaux d'information…). En choisissant une phase, on ne voit et on ne simule que
   ce qui est en place pendant cette phase : les déviations sont calculées sur les seules fermetures de la phase.
   « Phasage automatique » répartit les routes barrées dans le moins de phases possible, sans jamais fermer en même temps
   deux rues voisines ni une rue qui sert de déviation à une autre (coloration de graphe des conflits). */
const curPh = () => state?.phase && state.phase !== 'all' ? state.phase : null;
/* « hors service » : d'une autre phase que celle affichée, ou barrage levé (clic droit → Lever le barrage) avec ses déviations et panneaux */
const phOff = e => !!(curPh() && e?.ph && e.ph !== curPh()) || liftedEl(e);
let _liftV = -1, _liftS = null, _liftIds = new Set();
function liftedEl(e){
  if (!e || !state) return false; if (e.t === 'closure') return !!e.off;
  const p = e.cl || e.auto; if (typeof p !== 'string') return false;
  if (_liftV !== stateVer || _liftS !== state){ _liftV = stateVer; _liftS = state; _liftIds = new Set(state.els.filter(x => x.t === 'closure' && x.off).map(x => x.id)); }
  return _liftIds.has(p);
}
const phName = id => state.phases?.find(p => p.id === id)?.name || 'Phase';
function setPhase(id){ state.phase = id || 'all'; save(); sel = null; rebuildProj(); refreshPanel(); renderPhaseBar(); annoKey = ''; dirty = true; }
function addPhase(){ edit(() => { state.phases = state.phases || []; const n = state.phases.length + 1; state.phases.push({id:uid8(), name:`Phase ${n}`, from:'', to:''}); }); setPhase(state.phases.at(-1).id); }
function tlStack(){ let st = $('#tlStack'); if (!st){ st = document.createElement('div'); st.id = 'tlStack'; st.className = 'tlstack'; vpEl.appendChild(st); const h = $('#hud'); if (h) st.appendChild(h); } return st; }
function renderPhaseBar(){
  let bar = $('#phBar'); if (!bar){ bar = document.createElement('div'); bar.id = 'phBar'; bar.className = 'phbar'; tlStack().prepend(bar); }
  const P = state?.phases || [], cur = state?.phase || 'all';
  bar.innerHTML = `<span class="ph-l">Phasage</span><button class="ph-c${cur === 'all' ? ' on' : ''}" data-ph="all" title="Tout le chantier, toutes phases confondues">Toutes</button>`
    + P.map((p, i) => `<button class="ph-c${cur === p.id ? ' on' : ''}" data-ph="${p.id}" title="${esc(p.name)}${p.from ? ' · du ' + p.from : ''}${p.to ? ' au ' + p.to : ''} — double-clic pour modifier">${i + 1}<em>${esc(p.name.replace(/^Phase \d+\s*[:·-]?\s*/, '')) || ''}</em></button>`).join('')
    + `<button class="ph-c ph-add" id="phAdd" title="Ajouter une phase">+</button>${P.length ? '' : ''}${P.length ? '<button class="ph-c" id="phPlan" title="Planning des phases dans le temps">Planning</button>' : ''}<button class="ph-c ph-auto" id="phAuto" title="Répartir automatiquement les routes barrées en phases compatibles">Auto</button>`;
  bar.querySelectorAll('[data-ph]').forEach(b => { b.onclick = () => setPhase(b.dataset.ph); if (b.dataset.ph !== 'all') b.ondblclick = () => editPhase(b.dataset.ph); });
  $('#phAdd').onclick = addPhase; $('#phAuto').onclick = autoPhasing; if ($('#phPlan')) $('#phPlan').onclick = phasePlanning;
  let info = $('#phInfo'); if (!info){ info = document.createElement('div'); info.id = 'phInfo'; info.className = 'phinfo'; tlStack().appendChild(info); }
  const a = curPh() ? phaseReport(curPh()) : null; info.hidden = !a;
  if (a) info.innerHTML = `<b>${esc(phName(curPh()))}</b> · ${a.cl} route${a.cl > 1 ? 's' : ''} barrée${a.cl > 1 ? 's' : ''} · ${a.det} déviation${a.det > 1 ? 's' : ''}${a.extra ? ` (+${fmtM(a.extra)} max)` : ''}${a.warn.map(w => `<span class="ph-w">⚠ ${esc(w)}</span>`).join('')}`;
}
function editPhase(id){
  const p = state.phases.find(x => x.id === id); if (!p) return;
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Phase de travaux</p><h3 class="ed-name" style="margin:0">${esc(p.name)}</h3></div></div>
    <div class="ed-body" style="display:block"><div class="fields"><label class="f wide"><span>Nom</span><span class="in"><input id="phN" value="${esc(p.name)}"></span></label>
    <label class="f"><span>Du</span><span class="in"><input id="phF" type="date" value="${esc(p.from || '')}"></span></label><label class="f"><span>Au</span><span class="in"><input id="phT" type="date" value="${esc(p.to || '')}"></span></label></div></div>
    <div class="ed-f"><button class="btn" id="phDel" style="color:var(--closed)">Supprimer la phase</button><span style="flex:1"></span><button class="btn" id="phNo">Annuler</button><button class="btn primary" id="phOk">Enregistrer</button></div>`);
  $('#phNo').onclick = closeEngine;
  $('#phOk').onclick = () => { edit(() => { p.name = $('#phN').value.trim() || p.name; p.from = $('#phF').value; p.to = $('#phT').value; }); closeEngine(); renderPhaseBar(); };
  $('#phDel').onclick = () => { edit(() => { state.phases = state.phases.filter(x => x !== p); for (const e of state.els) if (e.ph === p.id) delete e.ph; }); closeEngine(); setPhase('all'); toast('Phase supprimée : ses éléments sont repassés en « toutes phases ».', 4000); };
}
/* bilan d'une phase + contrôles de cohérence */
function phaseReport(id){
  const els = state.els.filter(e => e.ph === id || !e.ph), cls = els.filter(e => e.t === 'closure' && e.ph === id), dets = els.filter(e => e.t === 'detour' && e.ph === id), warn = [];
  for (const c of cls) if (c.mode === 'total' && !dets.some(d => d.cl === c.id)) warn.push(`${c.name || 'Rue'} : aucune déviation`);
  const C = closedSets(els);
  for (const d of dets) if (d.ids?.some((n, k) => k && C.both.has(segKey(d.ids[k - 1], n)))) warn.push(`${d.name} emprunte une rue barrée de la phase`);
  for (let i = 0; i < cls.length; i++) for (let j = i + 1; j < cls.length; j++){ const A = new Set(cls[i].ids); if (cls[j].ids.some(n => A.has(n)) && cls[i].mode !== cls[j].mode) warn.push(`${cls[i].name} et ${cls[j].name} se touchent : vérifier l'accès riverains`); }
  return {cl:cls.length, det:dets.length, extra:Math.max(0, ...dets.map(d => d.extra || 0)), warn:[...new Set(warn)]};
}
/* phasage automatique : graphe des conflits entre routes barrées, coloration gloutonne (plus contraint d'abord) */
function autoPhasing(){
  const cls = state.els.filter(e => e.t === 'closure' && e.ids?.length > 1);
  if (cls.length < 2){ toast('Il faut au moins deux routes barrées pour proposer un phasage.', 4000); return; }
  const empty = {both:new Set(), dir:new Set(), slow:new Map()}, use = new Map();
  for (const c of cls){ const s = new Set(); for (const r of proposeDetours({...c, ph:undefined}, [])) if (!r.fail) for (let k = 1; k < r.ids.length; k++) s.add(segKey(r.ids[k - 1], r.ids[k])); use.set(c.id, s); }
  const keys = c => { const s = new Set(); for (let k = 1; k < c.ids.length; k++) s.add(segKey(c.ids[k - 1], c.ids[k])); return s; };
  const conflict = (a, b) => { const A = new Set(a.ids); if (b.ids.some(n => A.has(n))) return true;   // rues voisines (même carrefour)
    const kb = keys(b), ka = keys(a); for (const k of use.get(a.id)) if (kb.has(k)) return true; for (const k of use.get(b.id)) if (ka.has(k)) return true; return false; };
  const deg = new Map(cls.map(c => [c.id, cls.filter(o => o !== c && conflict(c, o)).length])), order = cls.slice().sort((a, b) => deg.get(b.id) - deg.get(a.id)), col = new Map();
  for (const c of order){ const used = new Set(cls.filter(o => col.has(o.id) && conflict(c, o)).map(o => col.get(o.id))); let k = 0; while (used.has(k)) k++; col.set(c.id, k); }
  const nPh = Math.max(...col.values()) + 1;
  beginEdit();
  state.phases = Array.from({length:nPh}, (_, i) => state.phases?.[i] || {id:uid8(), name:`Phase ${i + 1}`, from:'', to:''}).slice(0, nPh);
  for (const c of cls){ const ph = state.phases[col.get(c.id)].id; c.ph = ph; for (const x of state.els) if (x.cl === c.id || x.auto === c.id) x.ph = ph; }
  endEdit();
  // déviations recalculées phase par phase (chacune ne voit que ses propres fermetures)
  for (const p of state.phases){ state.phase = p.id; for (const c of cls.filter(c => c.ph === p.id && c.mode !== 'alternat' && c.mode !== 'voie')){ addDetoursFor(c); if (TOOLOPT.autoSigns) autoSigns(c); } }
  setPhase(state.phases[0].id);
  toast(`${cls.length} routes barrées réparties en ${nPh} phase${nPh > 1 ? 's' : ''} : jamais deux rues voisines fermées ensemble, ni une rue qui sert de déviation à une autre.`, 7000);
}
