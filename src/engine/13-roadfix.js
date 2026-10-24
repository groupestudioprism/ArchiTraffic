/* ============ Corrections de rues ============
   Les données OpenStreetMap sont parfois fausses ou incomplètes (sens unique, vitesse, interdiction aux poids lourds, largeur).
   L'utilisateur corrige la rue dans son chantier : la correction est enregistrée dans le projet (state.roadFix, par identifiant
   de voie OSM), appliquée au réseau avant chaque calcul, et les déviations peuvent être recalculées. */
function applyRoadFix(W){
  const F = (typeof state !== 'undefined' && state?.roadFix) || {};
  for (const r of W.roads){
    if (!r._o) r._o = {oneway:r.oneway, speed:r.speed, w:r.w, drive:r.drive, hgv:r.tags?.hgv};
    Object.assign(r, {oneway:r._o.oneway, speed:r._o.speed, w:r._o.w, drive:r._o.drive}); if (r.tags){ if (r._o.hgv === undefined) delete r.tags.hgv; else r.tags.hgv = r._o.hgv; }
    const f = F[r.id]; if (!f) continue;
    if (f.oneway != null) r.oneway = f.oneway;
    if (f.speed) r.speed = f.speed;
    if (f.w) r.w = f.w;
    if (f.hgv) (r.tags ||= {}).hgv = f.hgv === 'no' ? 'no' : 'yes';
    if (f.closed) r.drive = false;
  }
}
function roadFixCount(){ return Object.keys(state?.roadFix || {}).length; }
/* réseau reconstruit après une correction : graphe, flèches de sens unique, routes barrées recalées */
function refreshRoadFix(recalc){
  if (!WORLD) return; applyRoadFix(WORLD.W); buildNet(WORLD.W); buildWorld(); rematchClosures(); rebuildProj();
  if (recalc){ let n = 0; edit(() => { for (const c of state.els.filter(e => e.t === 'closure' && !['alternat', 'voie'].includes(e.mode))){ const r = addDetoursFor(c); n += r?.ok || 0; } }); toast(`Rue corrigée : ${n} déviation${n > 1 ? 's' : ''} recalculée${n > 1 ? 's' : ''}.`, 3500); }
  else toast('Rue corrigée.', 2500);
  dirty = true; save?.();
}
function roadFixDialog(nr){
  const r = nr.r, o = r._o || r, f = {...((state.roadFix || {})[r.id] || {})}, name = r.name || 'Voie sans nom';
  const ow = f.oneway ?? o.oneway, sp = f.speed || o.speed, w = f.w || o.w, hgv = f.hgv || (plOk({...r, tags:{...(r.tags || {}), hgv:o.hgv}}) ? 'yes' : 'no');
  const opt = (v, cur, txt) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${txt}</option>`;
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Corriger les données de la rue</p><h3 class="ed-name" style="margin:0">${esc(name)}</h3></div></div>
    <div class="ed-body" style="display:block"><p class="hint" style="margin-top:0">Les rues viennent d'OpenStreetMap et peuvent être fausses. La correction ne vaut que pour ce chantier ; les déviations en tiennent compte.</p>
    <div class="fields">
      <label class="f"><span>Sens de circulation</span><span class="in"><select id="rfOw">${opt(0, ow, 'Double sens')}${opt(1, ow, 'Sens unique (sens du tracé →)')}${opt(-1, ow, 'Sens unique (sens inverse ←)')}</select></span></label>
      <label class="f"><span>Vitesse autorisée</span><span class="in"><select id="rfSp">${[20, 30, 50, 70, 80, 90, 110, 130].map(v => opt(v, sp, v + ' km/h')).join('')}</select></span></label>
      <label class="f"><span>Poids lourds</span><span class="in"><select id="rfHgv">${opt('yes', hgv, 'Autorisés')}${opt('no', hgv, 'Interdits ou inadaptés')}</select></span></label>
      <label class="f"><span>Largeur de chaussée (m)</span><span class="in"><input id="rfW" type="number" min="2" max="30" step="0.5" value="${Math.round(w * 2) / 2}"></span></label>
      <label class="f rchk wide"><input type="checkbox" id="rfClosed"${f.closed ? ' checked' : ''}> Rue fermée à la circulation (piétonne, privée, déjà en travaux…)</label>
      ${r.name ? `<label class="f rchk wide"><input type="checkbox" id="rfAll" checked> Toute la ${esc(name)} (${WORLD.W.roads.filter(x => x.name === r.name && (x._o?.drive ?? x.drive)).length} tronçons)</label>` : ''}
      <label class="f rchk wide"><input type="checkbox" id="rfRe" checked> Recalculer les déviations du chantier</label>
    </div>${(state.roadFix && Object.keys(state.roadFix).length) ? `<p class="hint">${roadFixCount()} rue${roadFixCount() > 1 ? 's' : ''} corrigée${roadFixCount() > 1 ? 's' : ''} dans ce chantier.</p>` : ''}</div>
    <div class="ed-f">${(state.roadFix || {})[r.id] ? '<button class="btn" id="rfReset" style="color:var(--closed)">Revenir aux données d\'origine</button>' : ''}<span style="flex:1"></span><button class="btn" id="rfNo">Annuler</button><button class="btn primary" id="rfOk">Appliquer</button></div>`, 'small');
  $('#rfNo').onclick = closeEngine;
  const done = () => { closeEngine(); refreshRoadFix($('#rfRe')?.checked ?? true); };
  $('#rfOk').onclick = () => { const re = $('#rfRe').checked, nf = {};
    const vOw = +$('#rfOw').value, vSp = +$('#rfSp').value, vW = +$('#rfW').value, vH = $('#rfHgv').value, closed = $('#rfClosed').checked;
    if (vOw !== o.oneway) nf.oneway = vOw; if (vSp !== o.speed) nf.speed = vSp; if (vW && Math.abs(vW - o.w) > 0.25) nf.w = vW;
    if ((vH === 'no') !== !plOk({...r, oneway:o.oneway, w:o.w, tags:{...(r.tags || {}), hgv:o.hgv}})) nf.hgv = vH; if (closed) nf.closed = true;
    const ids = $('#rfAll')?.checked ? WORLD.W.roads.filter(x => x.name === r.name && (x._o?.drive ?? x.drive)).map(x => x.id) : [r.id];
    edit(() => { state.roadFix ||= {}; for (const id of ids){ if (Object.keys(nf).length) state.roadFix[id] = {...nf}; else delete state.roadFix[id]; } });
    closeEngine(); refreshRoadFix(re); };
  if ($('#rfReset')) $('#rfReset').onclick = () => { const ids = $('#rfAll')?.checked ? WORLD.W.roads.filter(x => x.name === r.name).map(x => x.id) : [r.id]; edit(() => { for (const id of ids) delete state.roadFix[id]; }); done(); };
}
