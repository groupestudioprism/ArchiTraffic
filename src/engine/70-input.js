/* ============ Outils et saisie (souris, doigt, clavier) ============ */
const CLOSE_MODES = [['total', 'Deux sens de circulation'], ['droite', 'Voie de droite'], ['gauche', 'Voie de gauche'], ['alternat', 'Alternat (chaussée rétrécie)']];
const modeOf = m => m === 'droite' ? {mode:'sens', dir:1} : m === 'gauche' ? {mode:'sens', dir:-1} : m === 'sens' ? {mode:'sens', dir:1} : {mode:m};
const modeKey = e => e.mode === 'voie' ? (e.side === -1 ? 'gauche' : 'droite') : e.mode === 'sens' ? (e.dir === -1 ? 'gauche' : 'droite') : e.mode;
let tool = 'select', draw = {pts:[], cursor:null, hover:null}, PLACE = {k:'AK5', a:0, p:{}}, TOOLOPT = {closeMode:'total', autoDetour:true, autoSigns:true, line:'cones', lineSp:'', veh:'semi'};
try { Object.assign(TOOLOPT, JSON.parse(localStorage.getItem('at.toolopt') || '{}')); } catch(e){}
const saveToolOpt = () => { try { localStorage.setItem('at.toolopt', JSON.stringify(TOOLOPT)); } catch(e){} };
const SNAP = {road:true, obj:true, ortho:false};
try { Object.assign(SNAP, JSON.parse(localStorage.getItem('at.snap') || '{}')); } catch(e){}
const TOOL_HELP = {
  select:'<b>Sélection</b> : cliquez un élément pour le modifier dans le panneau. <kbd>Suppr</kbd> l\'efface.',
  move:'<b>Déplacer</b> : glissez un élément. Les panneaux restent face au trafic.',
  rotate:'<b>Rotation</b> : glissez autour d\'un élément pour l\'orienter (pas de 15° avec <kbd>Maj</kbd>).',
  copy:'<b>Copier</b> : cliquez un élément, la copie suit le curseur ; cliquez pour la poser.',
  site:'<b>Lieu</b> : recherchez l\'adresse du chantier ; la zone est chargée avec ses rues, ses bâtiments et son relief NGF.',
  close:'<b>Route barrée</b> : survolez une rue, cliquez pour barrer le tronçon entre deux carrefours. La déviation est proposée automatiquement.',
  detour:'<b>Déviation</b> : cliquez le départ, des points de passage, puis l\'arrivée ; l\'itinéraire suit les rues dans le bon sens. <kbd>Entrée</kbd> pour terminer.',
  zone:'<b>Emprise</b> : cliquez les sommets de la zone de chantier ; <kbd>Entrée</kbd> ou double-clic pour fermer.',
  line:'<b>Balisage</b> : tracez une ligne de cônes, de séparateurs, de GBA ou de clôture ; <kbd>Entrée</kbd> pour terminer.',
  place:'<b>Placer</b> : cliquez pour poser l\'élément choisi dans la bibliothèque ; <kbd>R</kbd> ou la molette + <kbd>Maj</kbd> pour le tourner.',
  note:'<b>Annotation</b> : cliquez à l\'endroit à annoter, puis saisissez le texte.',
  arrow:'<b>Flèche</b> : tracez le chemin de la flèche ; <kbd>Entrée</kbd> pour terminer.',
  measure:'<b>Cote</b> : cliquez deux points pour coter une distance (largeur de chaussée, recul…).',
  swept:'<b>Giration</b> : tracez la trajectoire de l\'essieu avant ; l\'enveloppe balayée par le véhicule est calculée. <kbd>Entrée</kbd> pour terminer.',
};
const POLY_TOOLS = new Set(['detour', 'zone', 'line', 'arrow', 'swept']);
function setTool(t){
  if (!TOOL_HELP[t]) t = 'select';
  if (t === 'site'){ openSiteDialog(); return; }
  if (t === 'place' && activeTab !== 'lib' && !isNarrow.matches) setTab('lib');
  tool = t; cancelDraw(); $$('.tool').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t)); syncHud(); setPrompt(); dirty = true;
}
function setPrompt(extra = ''){ $('#prompt').innerHTML = extra || TOOL_HELP[tool] || ''; }
function cancelDraw(){ draw = {pts:[], cursor:draw.cursor, hover:null}; clearPreview(); ctl().enabled = true; }
/* ---------- HUD : options de l'outil courant ---------- */
function syncHud(){
  const h = $('#hud'); let html = '';
  const sel_ = (id, opts, val) => `<select id="${id}">${opts.map(([v, n]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  if (tool === 'close') html = `<label class="pill tool-pill"><span>Fermeture</span>${sel_('hCloseMode', CLOSE_MODES, TOOLOPT.closeMode)}</label>
    <label class="pill"><input type="checkbox" id="hAutoDet"${TOOLOPT.autoDetour ? ' checked' : ''} style="width:auto"><span>Déviation auto</span></label><label class="pill"><input type="checkbox" id="hAutoSig"${TOOLOPT.autoSigns ? ' checked' : ''} style="width:auto"><span>Panneaux auto</span></label>`;
  else if (tool === 'line') html = `<label class="pill tool-pill"><span>Type</span>${sel_('hLine', Object.entries(LINE_TYPES).map(([k, T]) => [k, T.n]), TOOLOPT.line)}</label>${LINE_TYPES[TOOLOPT.line]?.item ? `<label class="pill"><span>Espacement</span><input id="hLineSp" type="number" min="1" max="30" step="0.5" value="${TOOLOPT.lineSp || LINE_TYPES[TOOLOPT.line].sp}"><em>m</em></label>` : ''}`;
  else if (tool === 'place'){ const L = LIBK[PLACE.k]; html = `<span class="pill tool-pill">${L?.sign ? `<img class="sg" src="${libThumb(L)}" alt="">` : ''}<b>${esc(L?.name || 'Élément')}</b><button type="button" id="hRot">↻ 15°</button><button type="button" id="hLib">Changer</button></span>`; }
  else if (tool === 'swept') html = `<label class="pill tool-pill"><span>Véhicule</span>${sel_('hVeh', Object.entries(SWEPT_VEH).map(([k, v]) => [k, v.n]), TOOLOPT.veh)}</label>`;
  if (POLY_TOOLS.has(tool) && draw.pts.length) html += `<span class="pill"><button type="button" id="hEnd">Terminer ↵</button><button type="button" id="hUndoPt">Retirer le point</button></span>`;
  h.innerHTML = html;
  const on = (id, ev, f) => { const el = $('#' + id); if (el) el.addEventListener(ev, f); };
  on('hCloseMode', 'change', e => { TOOLOPT.closeMode = e.target.value; saveToolOpt(); });
  on('hAutoDet', 'change', e => { TOOLOPT.autoDetour = e.target.checked; saveToolOpt(); }); on('hAutoSig', 'change', e => { TOOLOPT.autoSigns = e.target.checked; saveToolOpt(); });
  on('hLine', 'change', e => { TOOLOPT.line = e.target.value; TOOLOPT.lineSp = ''; saveToolOpt(); syncHud(); }); on('hLineSp', 'change', e => { TOOLOPT.lineSp = e.target.value; saveToolOpt(); });
  on('hVeh', 'change', e => { TOOLOPT.veh = e.target.value; saveToolOpt(); });
  on('hRot', 'click', () => { PLACE.a += Math.PI / 12; PLACE.manual = true; updateGhost(); }); on('hLib', 'click', () => { setTab('lib'); openPanelMobile(); });
  on('hEnd', 'click', () => finishPoly()); on('hUndoPt', 'click', () => { draw.pts.pop(); updatePolyPreview(); syncHud(); });
}

/* ---------- position du curseur sur le sol ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function setNdc(ev){ const r = canvas.getBoundingClientRect(); ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam()); }
function groundAt(ev){
  setNdc(ev); const terr = worldGroup.children.find(o => o.userData.terrain);
  if (terr){ const h = ray.intersectObject(terr, false)[0]; if (h) return [h.point.x, -h.point.z]; }
  const p = new THREE.Vector3(); plane0.constant = -(WORLD ? H(c3.target.x, -c3.target.z) : 0); if (ray.ray.intersectPlane(plane0, p)) return [p.x, -p.z]; return null;
}
function pickEl(ev){
  setNdc(ev); const hits = ray.intersectObjects(projGroup.children, true);
  for (const h of hits){ let o = h.object; while (o && !o.userData.id) o = o.parent; if (o?.userData.id && byId(o.userData.id)) return o.userData.id; }
  return null;
}
/* accroche : sur l'axe ou le bord des voies, sur les éléments posés, ortho */
function snapPt(q, opt = {}){
  if (!q) return q; let p = q;
  if (SNAP.ortho && opt.from){ const d = V.sub(q, opt.from); p = Math.abs(d[0]) > Math.abs(d[1]) ? [q[0], opt.from[1]] : [opt.from[0], q[1]]; }
  if (SNAP.road && opt.road && WORLD){ const nr = nearestRoad(p, 3, false); if (nr){ const hw = nr.r.w / 2, side = V.cross(nr.dir, V.sub(p, nr.pt)) > 0 ? 1 : -1, dd = V.dist(p, nr.pt), n = V.perp(nr.dir);
      if (Math.abs(dd - hw) < 0.6) p = V.add(nr.pt, V.mul(n, side * hw)); else if (dd < 0.6) p = nr.pt; } }
  if (SNAP.obj && opt.obj !== false){ let best = null, bd = 0.8 * Math.max(1, mPerPx() * 6); for (const e of state.els){ const pts = e.t === 'obj' || e.t === 'note' ? [[e.x, e.y]] : e.pts || (e.a ? [e.a, e.b] : []); for (const c of pts){ const d = V.dist(c, p); if (d < bd){ bd = d; best = c; } } } if (best) p = best.slice(); }
  return p;
}
/* ---------- aperçus (lignes au-dessus de tout) ---------- */
const prevMat = new THREE.LineBasicMaterial({color:0xF28A1A, depthTest:false, transparent:true}), prevMatRed = new THREE.LineBasicMaterial({color:0xD32F2F, depthTest:false, transparent:true, linewidth:3});
function clearPreview(){ previewGroup.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); previewGroup.clear(); dirty = true; }
function lineObj(pts, mat = prevMat, dz = 0.4, closed = false){ const p = (closed ? [...pts, pts[0]] : pts).flatMap(q => densify([q], 1)).map(q => new THREE.Vector3(q[0], H(q[0], q[1]) + dz, -q[1]));
  const dense = []; const src = closed ? [...pts, pts[0]] : pts; const d = densify(src, 2); d.forEach(q => dense.push(new THREE.Vector3(q[0], H(q[0], q[1]) + dz, -q[1])));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(dense.length ? dense : p), mat); l.renderOrder = 10; return l; }
function bandPreview(pts, w, color, dz = 0.3){ const m = ribbonMesh(pts, w, MAT['pv|' + color] ??= new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.55, depthTest:false}), dz); if (m) m.renderOrder = 9; return m; }
let ghost = null;
function updateGhost(){
  if (tool !== 'place' || !draw.cursor){ if (ghost){ previewGroup.remove(ghost); ghost = null; } return; }
  const L = LIBK[PLACE.k]; if (!L) return;
  if (!ghost || ghost.userData.k !== PLACE.k){ if (ghost) previewGroup.remove(ghost); ghost = L.build(PLACE.p || L.p || {}); ghost.userData.k = PLACE.k; ghost.traverse(o => { if (o.isMesh){ o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; } }); previewGroup.add(ghost); }
  const [x, y] = draw.cursor; let a = PLACE.a;
  if (!PLACE.manual){ if (L.sign){ const o = autoOrient(x, y); if (o != null) a = o; } else if (L.cat === 'veh' || L.cat === 'eng'){ const nr = nearestRoad([x, y], 10); if (nr) a = Math.atan2(nr.dir[1], nr.dir[0]); } else if (L.cat === 'bal' && /K2|K16|GBA|VAU|HER/.test(L.k)){ const nr = nearestRoad([x, y], 12); if (nr) a = Math.atan2(nr.dir[1], nr.dir[0]) + Math.PI / 2; } }
  draw.ghostA = a; placeObj(ghost, x, y, a); dirty = true;
}
function updatePolyPreview(){
  clearPreview(); const pts = draw.cursor && POLY_TOOLS.has(tool) ? [...draw.pts, draw.cursor] : draw.pts;
  if (tool === 'detour' && draw.pts.length){ const r = detourPath([...draw.pts, ...(draw.cursor ? [draw.cursor] : [])]); if (r?.pts.length > 1){ const b = bandPreview(r.pts, 1.4, 0xF28A1A); if (b) previewGroup.add(b); } }
  else if (pts.length > 1) previewGroup.add(lineObj(pts, prevMat, 0.35, tool === 'zone'));
  if (tool === 'swept' && pts.length > 1){ const env = sweptCompute(pts, TOOLOPT.veh); if (env){ previewGroup.add(lineObj(env.l, new THREE.LineBasicMaterial({color:0x7B1FA2, depthTest:false}), 0.35)); previewGroup.add(lineObj(env.r, new THREE.LineBasicMaterial({color:0x7B1FA2, depthTest:false}), 0.35)); } }
  if (tool === 'measure' && draw.pts.length && draw.cursor){ previewGroup.add(lineObj([draw.pts[0], draw.cursor])); setPrompt(`<b>Cote</b> : ${fmtM(V.dist(draw.pts[0], draw.cursor))}`); }
  for (const q of draw.pts){ const s = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({color:0xF28A1A, depthTest:false})); s.position.set(q[0], H(q[0], q[1]) + 0.4, -q[1]); s.renderOrder = 11; previewGroup.add(s); }
  if (ghost) previewGroup.add(ghost);
  dirty = true;
}
/* itinéraire manuel : suit le réseau entre les points cliqués */
function detourPath(pts){
  if (!WORLD || pts.length < 2) return {pts:pts.slice(), ids:[]};
  const C = closedSets(state.els), nodeAt = q => { const nr = nearestRoad(q, 30); if (!nr) return null; const r = nr.r, a = r.nodes[nr.k], b = r.nodes[nr.k + 1]; return nr.t < 0.5 ? a : b; };
  let ids = [], out = [];
  for (let i = 0; i + 1 < pts.length; i++){
    const A = nodeAt(pts[i]), B = nodeAt(pts[i + 1]); if (A == null || B == null) continue;
    if (A === B){ if (!ids.length){ ids.push(A); } continue; }
    const r = route(A, B, C, {}); if (!r) return null;
    ids = ids.length ? [...ids, ...r.ids.slice(1)] : r.ids;
  }
  out = ids.map(id => NET.nodes.get(id).xy); return {pts:out, ids};
}
/* ---------- actions des outils ---------- */
function addEl(e, select = true){ if (curPh() && e.ph === undefined) e.ph = curPh(); edit(() => { state.els.push(e); }); if (select){ sel = e.id; applySel(); refreshPanel(); } return e; }
function onClick(ev, q){
  if (tool === 'select'){ const id = pickEl(ev); sel = id; applySel(); if (id && activeTab !== 'props') setTab('props'); else refreshPanel(); return; }
  if (tool === 'copy'){ if (draw.copy){ const e = JSON.parse(JSON.stringify(draw.copy)); e.id = uid8(); if (e.t === 'obj' || e.t === 'note' || e.t === 'model'){ e.x = q[0]; e.y = q[1]; } else { const c = elCenter(draw.copy), d = V.sub(q, c); shiftEl(e, d); } addEl(e); return; }
    const id = pickEl(ev); if (id){ draw.copy = JSON.parse(JSON.stringify(byId(id))); setPrompt('<b>Copier</b> : cliquez pour poser la copie (plusieurs fois si besoin). <kbd>Échap</kbd> pour arrêter.'); } return; }
  if (!WORLD && tool !== 'note'){ toast('Choisissez d\'abord le lieu du chantier (outil Lieu).'); openSiteDialog(); return; }
  if (tool === 'close'){ const nr = nearestRoad(q, 10); if (!nr){ toast('Cliquez sur une rue circulée.'); return; } makeClosure(nr); return; }
  if (tool === 'place'){ const e = {id:uid8(), t:'obj', k:PLACE.k, x:q[0], y:q[1], a:draw.ghostA ?? PLACE.a}; const L = LIBK[PLACE.k]; if (L?.p) e.p = {...L.p, ...(PLACE.p || {})}; addEl(e, false); toast(`${L?.name || 'Élément'} posé`); return; }
  if (tool === 'note'){ askNote(q); return; }
  if (tool === 'measure'){ if (!draw.pts.length){ draw.pts = [q]; return; } addEl({id:uid8(), t:'dim', a:draw.pts[0], b:q}); draw.pts = []; clearPreview(); setPrompt(); return; }
  if (POLY_TOOLS.has(tool)){
    if (tool === 'zone' && draw.pts.length > 2 && V.dist(q, draw.pts[0]) < Math.max(1.5, mPerPx() * 12)) return finishPoly();
    draw.pts.push(q); updatePolyPreview(); syncHud();
  }
}
function finishPoly(){
  const p = draw.pts.slice(); if (tool === 'zone' && p.length < 3 || p.length < 2){ toast(tool === 'zone' ? 'Une emprise a besoin d\'au moins 3 points.' : 'Tracez au moins 2 points.'); return; }
  if (tool === 'zone') addEl({id:uid8(), t:'zone', pts:p, name:`Emprise ${state.els.filter(e => e.t === 'zone').length + 1}`, fence:false});
  else if (tool === 'line') addEl({id:uid8(), t:'line', k:TOOLOPT.line, pts:p, sp:+TOOLOPT.lineSp || undefined});
  else if (tool === 'arrow') addEl({id:uid8(), t:'arrow', pts:p, col:'#1565C0', w:1.2});
  else if (tool === 'detour'){ const r = detourPath(p); if (!r || r.pts.length < 2){ toast('Itinéraire impossible entre ces points (sens interdit ou rue barrée).'); return; }
    const n = state.els.filter(e => e.t === 'detour').length; addEl({id:uid8(), t:'detour', pts:r.pts, ids:r.ids, name:`Déviation ${n + 1}`, col:DETOUR_COLS[n % DETOUR_COLS.length], cls:'tous', len:plLen(r.pts)}); }
  else if (tool === 'swept'){ const env = sweptCompute(p, TOOLOPT.veh); if (!env) return; addEl({id:uid8(), t:'swept', veh:TOOLOPT.veh, pts:p, env:{l:env.l, r:env.r, tracks:env.tracks}, pose:env.pose, w:Math.round(env.maxW * 100) / 100});
    toast(`Épure ${SWEPT_VEH[TOOLOPT.veh].n} : largeur balayée maximale ${nf(env.maxW, 2)} m`); }
  cancelDraw(); syncHud(); setPrompt();
}
const DETOUR_COLS = ['#F28A1A', '#7B1FA2', '#0E8FB0', '#2E7D32', '#C2185B'];
/* route barrée : tronçon complet entre carrefours */
function makeClosure(nr){
  const sec = sectionAt(nr.ri, nr.k); if (!sec) return;
  if (state.els.some(e => e.t === 'closure' && e.ids?.join() === sec.ids.join())){ toast('Ce tronçon est déjà barré.'); return; }
  // tronçon contigu à une rue déjà barrée (même voie, même mode) : on prolonge la fermeture existante → une seule déviation autour de l'ensemble
  const adj = state.els.find(e => e.t === 'closure' && modeKey(e) === TOOLOPT.closeMode && (e.ph || null) === (curPh() || null) && e.ids?.length && [e.ids[0], e.ids[e.ids.length - 1]].some(id => id === sec.ids[0] || id === sec.ids[sec.ids.length - 1]));
  if (adj){ beginEdit();
    let ids = adj.ids, pts = adj.pts; const a0 = ids[0], a1 = ids[ids.length - 1], s0 = sec.ids[0], s1 = sec.ids[sec.ids.length - 1], rs = sec.ids.slice().reverse(), rp = sec.pts.slice().reverse();
    if (a1 === s0){ ids = [...ids, ...sec.ids.slice(1)]; pts = [...pts, ...sec.pts.slice(1)]; } else if (a1 === s1){ ids = [...ids, ...rs.slice(1)]; pts = [...pts, ...rp.slice(1)]; }
    else if (a0 === s1){ ids = [...sec.ids, ...ids.slice(1)]; pts = [...sec.pts, ...pts.slice(1)]; } else { ids = [...rs, ...ids.slice(1)]; pts = [...rp, ...pts.slice(1)]; }
    Object.assign(adj, {ids, pts, len:Math.round(plLen(pts) * 10) / 10});
    mergeChain(adj);
    let msg = `${cap(adj.name)} barrée sur ${fmtM(adj.len)} (fermeture prolongée)`;
    if (TOOLOPT.autoDetour && !['alternat', 'voie'].includes(adj.mode)){ const ds = addDetoursFor(adj); msg += ds.ok ? ` · ${ds.ok} déviation${ds.ok > 1 ? 's' : ''} recalculée${ds.ok > 1 ? 's' : ''}` : ' · aucune déviation possible'; }
    if (TOOLOPT.autoSigns) autoSigns(adj); refreshOtherDetours(adj.id);
    endEdit(); sel = adj.id; rebuildProj(); refreshPanel(); toast(msg, 5200); return; }
  const ow = sectionOneway(sec.ids), MO = modeOf(TOOLOPT.closeMode), mode = MO.mode, cl = {id:uid8(), t:'closure', ids:sec.ids, pts:sec.pts, name:sec.name, mode, dir:MO.dir ?? (ow === -1 ? -1 : 1), riv:hasHomes(sec.pts), len:Math.round(sec.len * 10) / 10};
  // sur une voie à sens unique, « droite / gauche » désignent les files du même sens : la circulation est maintenue sur l'autre file si la chaussée le permet (≥ 5,50 m)
  if (mode === 'sens' && ow !== 0){ cl.side = MO.dir; cl.dir = ow; if (closureWidth(cl) >= 5.5) cl.mode = 'voie'; }
  if (curPh()) cl.ph = curPh(); beginEdit(); state.els.push(cl);
  mergeChain(cl);   // rejoint une fermeture voisine de la même rue (y compris de l'autre côté d'un carrefour)
  let msg = `${cap(cl.name)} barrée sur ${fmtM(cl.len)}`;
  if (TOOLOPT.autoDetour && !['alternat', 'voie'].includes(cl.mode)){ const ds = addDetoursFor(cl); msg += ds.ok ? ` · ${ds.ok} déviation${ds.ok > 1 ? 's' : ''} : +${fmtM(Math.max(...ds.list.map(d => d.extra)))}` : ds.fail ? ' · aucune déviation possible (impasse ?)' : ''; if (cl.plWarn) msg += ' · ⚠ aucun itinéraire adapté aux poids lourds dans la zone : déviation VL, PL à dévier en amont (panneau B8 posé)'; }
  if (TOOLOPT.autoSigns) autoSigns(cl);
  refreshOtherDetours(cl.id);
  endEdit(); sel = cl.id; rebuildProj(); refreshPanel(); toast(msg, 5200);
}
/* habitations le long d'un tronçon (bâtiments à moins de 30 m de l'axe) → « Route barrée sauf riverains » */
function hasHomes(pts){ const B = WORLD?.W?.bld || []; for (const b of B){ if (b.h < 2.5) continue; const c = centroid(b.p); for (let k = 0; k + 1 < pts.length; k++) if (V.dist(segClosest(c, pts[k], pts[k + 1]).pt, c) < 30) return true; } return false; }
/* même rue : noms identiques ou partageant un nom (« Rue A / Rue B »), ou tronçon sans nom */
const sameStreet = (a = '', b = '') => { if (!a || !b) return true; const A = a.split(' / '), B = new Set(b.split(' / ')); return A.some(x => B.has(x)); };
/* une fermeture prolongée peut rejoindre une autre fermeture de la même rue : on les fusionne (une seule déviation, un seul jeu de barrières) */
function mergeChain(cl){
  for (let guard = 0; guard < 20; guard++){
    const a0 = cl.ids[0], a1 = cl.ids.at(-1);
    let o = state.els.find(e => e !== cl && e.t === 'closure' && e.mode === cl.mode && (e.dir || 1) === (cl.dir || 1) && (e.ph || null) === (cl.ph || null) && e.ids?.length && [e.ids[0], e.ids.at(-1)].some(id => id === a0 || id === a1));
    if (!o){ // pas d'extrémité commune : le centre du carrefour (îlot, petit tronçon de jonction) les sépare → on comble s'il fait moins de 40 m
      const C0 = {both:new Set(), dir:new Set(), slow:new Map()};
      for (const e of state.els){ if (e === cl || e.t !== 'closure' || e.mode !== cl.mode || (e.ph || null) !== (cl.ph || null) || !e.ids?.length || !sameStreet(e.name, cl.name)) continue;
        for (const [x, y, fx, fy] of [[a1, e.ids[0], 1, 0], [a1, e.ids.at(-1), 1, 1], [a0, e.ids[0], 0, 0], [a0, e.ids.at(-1), 0, 1]]){
          const X = NET.nodes.get(x), Y = NET.nodes.get(y); if (!X || !Y || V.dist(X.xy, Y.xy) > 40) continue;
          const r = route(x, y, C0, {}) || route(y, x, C0, {}); if (!r || r.len > 45) continue;
          const path = r.ids[0] === x ? r : {ids:r.ids.slice().reverse(), pts:r.pts.slice().reverse()};   // de x vers y
          if (fx){ cl.ids = [...cl.ids, ...path.ids.slice(1)]; cl.pts = [...cl.pts, ...path.pts.slice(1)]; } else { cl.ids = [...path.ids.slice().reverse(), ...cl.ids.slice(1)]; cl.pts = [...path.pts.slice().reverse(), ...cl.pts.slice(1)]; }
          o = e; break; }
        if (o) break; }
      if (!o) return; continue; }
    const b0 = o.ids[0], b1 = o.ids.at(-1), ri = o.ids.slice().reverse(), rp = o.pts.slice().reverse();
    if (a1 === b0){ cl.ids = [...cl.ids, ...o.ids.slice(1)]; cl.pts = [...cl.pts, ...o.pts.slice(1)]; }
    else if (a1 === b1){ cl.ids = [...cl.ids, ...ri.slice(1)]; cl.pts = [...cl.pts, ...rp.slice(1)]; }
    else if (a0 === b1){ cl.ids = [...o.ids, ...cl.ids.slice(1)]; cl.pts = [...o.pts, ...cl.pts.slice(1)]; }
    else { cl.ids = [...ri, ...cl.ids.slice(1)]; cl.pts = [...rp, ...cl.pts.slice(1)]; }
    cl.len = Math.round(plLen(cl.pts) * 10) / 10; if (o.name && cl.name && !sameStreet(o.name, cl.name)) cl.name = `${cl.name} / ${o.name}`; if (o.riv) cl.riv = true;
    state.els = state.els.filter(e => e !== o && e.cl !== o.id && e.auto !== o.id);   // l'ancienne fermeture, ses déviations et ses panneaux disparaissent
  }
}
/* les déviations automatiques des autres fermetures qui empruntent désormais un tronçon fermé sont recalculées */
function refreshOtherDetours(exceptId){
  const C = closedSets(state.els);
  for (const c of state.els.filter(e => e.t === 'closure' && e.id !== exceptId && !['alternat', 'voie'].includes(e.mode))){
    const hit = state.els.some(d => d.t === 'detour' && d.cl === c.id && d.auto && d.ids?.some((id, k) => k && (C.both.has(segKey(d.ids[k - 1], id)) || C.dir.has(`${d.ids[k - 1]}>${id}`))));
    if (hit){ addDetoursFor(c); if (TOOLOPT.autoSigns) autoSigns(c); } }
}
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
function addDetoursFor(cl){
  const res = proposeDetours(cl, state.els); let ok = 0, fail = 0; const list = [];
  state.els = state.els.filter(e => !(e.t === 'detour' && e.cl === cl.id && e.auto));
  // la déviation commence et finit au carrefour où l'on quitte / rejoint l'itinéraire normal (pas sur le tronçon fermé ni ses abords en impasse)
  const trim = r => { const n = r.ids.length; let s = 0, e = n - 1; while (s < n - 2 && nodeDeg(NET.nodes.get(r.ids[s])) < 3) s++; while (e > s + 1 && nodeDeg(NET.nodes.get(r.ids[e])) < 3) e--;
    const inDir0 = s > 0 ? V.norm(V.sub(NET.nodes.get(r.ids[s - 1]).xy, NET.nodes.get(r.ids[s]).xy)) : null;
    const inDirEnd = e < n - 1 ? V.norm(V.sub(NET.nodes.get(r.ids[e + 1]).xy, NET.nodes.get(r.ids[e]).xy)) : null;
    return {...r, ids:r.ids.slice(s, e + 1), pts:r.pts.slice(s, e + 1), edges:r.edges.slice(s, e), inDir0, inDirEnd}; };
  let routes = res.filter(r => !r.fail).map(trim); fail = res.length - routes.length;
  // un seul itinéraire si les deux sens empruntent les mêmes rues (double sens) : « Déviation (deux sens) »
  let both = false;
  if (routes.length === 2){
    const a = new Set(routes[0].ids), common = routes[1].ids.filter(id => a.has(id)).length;
    // l'itinéraire du sens 1 est-il praticable en sens inverse (sens uniques, fermetures) et pas plus long de 30 % que le meilleur sens 2 ?
    const C = closedSets(state.els), rev = routes[0].ids.slice().reverse(); let ok2 = true, len2 = 0;
    for (let k = 0; k + 1 < rev.length && ok2; k++){ const n = NET.nodes.get(rev[k]), e = n.out.map(i => NET.edges[i]).find(e => e.to === rev[k + 1]); if (!e || C.both.has(e.key) || C.dir.has(`${e.from}>${e.to}`)) ok2 = false; else len2 += e.len; }
    if (ok2 && (common / Math.max(routes[0].ids.length, routes[1].ids.length) > 0.6 || len2 <= plLen(routes[1].pts) * 1.3 + 30)){ routes = [routes[0]]; both = true; }   // « deux sens » seulement si l'itinéraire est réellement praticable dans l'autre sens
  }
  routes.forEach((r, i) => { ok++; list.push(r); const n = state.els.filter(e => e.t === 'detour').length;
    const names = [...new Set(r.edges.map(ei => NET.roads[NET.edges[ei].r].name).filter(Boolean))];
    state.els.push({id:uid8(), t:'detour', cl:cl.id, ph:cl.ph, auto:true, ids:r.ids, pts:r.pts, inDir0:r.inDir0, inDirEnd:r.inDirEnd, both, name:`Déviation ${both ? '(deux sens)' : routes.length > 1 ? (i ? 'sens 2' : 'sens 1') : ''}`.trim() + (cl.name ? ` · ${cl.name}` : '') + (r.vl ? ' — véhicules légers' : ''), via:names.slice(0, 4).join(', '), col:DETOUR_COLS[n % DETOUR_COLS.length], cls:r.vl ? 'VL' : 'tous', len:Math.round(r.len), extra:Math.round(r.extra), extraT:Math.round(r.extraT), time:Math.round(r.time)}); });
  cl.plWarn = list.some(r => r.vl);   // aucun itinéraire apte aux PL dans la zone : PL à dévier en amont, sur le réseau départemental
  return {ok, fail, list};
}
/* signalisation automatique : barrières K2 + panneaux « route barrée » aux extrémités, flèches de déviation aux carrefours */
function autoSigns(cl){
  state.els = state.els.filter(e => !(e.t === 'obj' && e.auto === cl.id));
  const add = (k, q, a, p) => state.els.push({id:uid8(), t:'obj', k, x:q[0], y:q[1], a, p, auto:cl.id, ph:cl.ph});
  const ends = [[cl.pts[0], cl.pts[1]], [cl.pts[cl.pts.length - 1], cl.pts[cl.pts.length - 2]]], w = closureWidth(cl);
  const urbF = WORLD ? urbanIndex(WORLD.W) : null, mid = plAt(cl.pts, plLen(cl.pts) / 2).pt, agglo = !urbF || urbF(mid[0], mid[1]) >= 2;
  const lane = cl.mode === 'sens' || cl.mode === 'voie', sd = cl.mode === 'voie' ? (cl.side || 1) : 1, apD = agglo ? 100 : 150, taper = agglo ? 15 : 50;   // AK5 : ~50 m en agglomération, ~150 m hors agglomération (IISR 8e partie)
  ends.forEach(([A, B], i) => {
    if (lane && ((cl.dir === -1) === (i === 0))) return;
    const owc = sectionOneway(cl.ids); if (!lane && cl.mode === 'total' && owc !== 0 && (owc === 1) === (i === 1)) return;   // sens unique : signalisation seulement à l'entrée        // voie neutralisée : signalisation à l'entrée du sens concerné seulement
    const d = V.norm(V.sub(B, A)), n = V.mul(V.perp(d), sd), face = Math.atan2(-d[1], -d[0]), base = V.add(A, V.mul(d, Math.min(6, plLen(cl.pts) / 3)));
    const right = q => V.add(q, V.mul(n, -w / 2 - 0.8)), back = m => V.add(A, V.mul(d, -m));
    if (cl.mode === 'alternat'){ add('KR11', V.add(base, V.mul(n, -w / 2 - 0.6)), face, {on:'red'}); add('AK3', right(back(40)), face); return; }
    // barrières K2 en travers de la chaussée, face aux usagers qui arrivent (pleine largeur, ou seule la voie de droite neutralisée)
    const o0 = -w / 2, o1 = lane ? 0 : w / 2, span = o1 - o0, nb = Math.max(1, Math.round(span / 2.2));
    if (!lane) for (let k = 0; k < nb; k++) add(k === Math.floor(nb / 2) && !lane ? 'KR_ROUTE' : 'K2', V.add(base, V.mul(n, o0 + (k + 0.5) * span / nb)), face, k === Math.floor(nb / 2) && !lane ? (cl.riv ? {t:'RUE BARRÉE|SAUF RIVERAINS'} : {t:'ROUTE BARRÉE'}) : {len:'2'});
    if (lane){ // biseau de cônes K5a ramenant la circulation sur la voie restante
      const nc = Math.max(4, Math.round(taper / 3)); for (let k = 0; k <= nc; k++){ const t = k / nc; add('K5a', V.add(V.sub(base, V.mul(d, taper * (1 - t))), V.mul(n, -w / 2 + 0.3 + (w / 2 - 0.3) * t)), face); }
      add('AK3', right(back(apD)), face); add('K8', V.add(base, V.mul(n, -w / 4)), face);   // K8 sur barrière : ferme la file neutralisée
    } else add('AK5', right(back(apD)), face);
    if (cl.plWarn && !lane) add('B8', V.add(right(back(apD)), V.mul(d, 12)), face);   // interdiction PL : la déviation locale ne leur convient pas
    if (!agglo){ add('B14', right(back(apD + 100)), face, {v:'70'}); add('B14', right(back(apD + 30)), face, {v:'50'}); }
  });
  // carrefours à l'intérieur de la section barrée : les rues latérales y débouchent → barrage en travers de chaque côté, face au carrefour
  if (cl.mode === 'total') for (let k = 1; k + 1 < cl.ids.length; k++){
    const n = NET.nodes.get(cl.ids[k]); if (!n) continue;
    const side = [...n.nb].filter(x => x !== cl.ids[k - 1] && x !== cl.ids[k + 1] && (() => { const sg = NET.segIdx.get(segKey(n.id, x)); const r = sg && NET.roads[sg.ri]; return r && r.drive && r.cls < 7; })());
    if (!side.length) continue;
    for (const [j, nb] of [[0, cl.ids[k - 1]], [1, cl.ids[k + 1]]]){ const B = NET.nodes.get(nb)?.xy; if (!B) continue; const d = V.norm(V.sub(B, n.xy)), nn = V.perp(d), base = V.add(n.xy, V.mul(d, Math.min(5, V.dist(B, n.xy) / 2))), face = Math.atan2(-d[1], -d[0]);
      const nbk = Math.max(1, Math.round(w / 2.2)); for (let q = 0; q < nbk; q++){ const pos = V.add(base, V.mul(nn, -w / 2 + (q + 0.5) * w / nbk)); add(q === Math.floor(nbk / 2) && j === 0 ? 'KR_ROUTE' : 'K2', pos, face, q === Math.floor(nbk / 2) && j === 0 ? (cl.riv ? {t:'RUE BARRÉE|SAUF RIVERAINS'} : {t:'ROUTE BARRÉE'}) : {len:'2'}); } }
  }
  // flèches de déviation aux changements de direction (et confirmation tout droit tous les 2 carrefours)
  // un parcours n'est jalonné que s'il est praticable dans ce sens (sens uniques, interdictions, fermetures)
  const Cs = closedSets(state.els), drivable = ids => ids.every((id, k) => !k || (NET.nodes.get(ids[k - 1])?.out || []).some(ei => { const e = NET.edges[ei]; return e.to === id && !Cs.both.has(e.key) && !Cs.dir.has(`${e.from}>${e.to}`); }));
  for (const dt0 of state.els.filter(e => e.t === 'detour' && e.cl === cl.id && e.ids?.length)) for (const dt of (dt0.both ? [dt0, {...dt0, ids:dt0.ids.slice().reverse(), inDir0:dt0.inDirEnd}] : [dt0]).filter(d => drivable(d.ids))){
    // sens de marche voulu au départ de la déviation : celui du tronçon barré, depuis l'extrémité où elle commence
    const i0 = cl.ids.indexOf(dt.ids[0]), nxt = i0 === 0 ? cl.pts[1] : i0 === cl.ids.length - 1 ? cl.pts[cl.pts.length - 2] : null, startDir = dt.inDir0 || (nxt ? V.norm(V.sub(nxt, NET.nodes.get(dt.ids[0]).xy)) : null);
    const turns = routeTurns(dt.ids, startDir); let straight = 0;
    for (const t of turns){
      if (t.turn === 'tout droit' && ++straight % 2) continue;
      const back = t.i === 0 ? 12 : Math.min(10, V.dist(NET.nodes.get(dt.ids[t.i - 1]).xy, t.xy) * 0.6), q0 = V.sub(t.xy, V.mul(t.inDir, back));
      const nr = nearestRoad(q0, 15), hw = nr ? nr.r.w / 2 : 3, q = V.add(q0, V.mul(V.perp(t.inDir), -(hw + 0.8)));
      add(t.turn === 'gauche' ? 'KD22a' : t.turn === 'droite' ? 'KD22b' : 'KD22c', q, Math.atan2(-t.inDir[1], -t.inDir[0]));
    }
    // fin de déviation (KD69) au retour sur l'itinéraire normal, à droite, face aux usagers
    if (dt.ids.length > 1){ const E = NET.nodes.get(dt.ids.at(-1)).xy, Pv = NET.nodes.get(dt.ids.at(-2)).xy, d = V.norm(V.sub(E, Pv)), nr = nearestRoad(E, 15), hw = nr ? nr.r.w / 2 : 3;
      const q = V.add(V.add(E, V.mul(d, 12)), V.mul(V.perp(d), -(hw + 0.8))); add('KD69', q, Math.atan2(-d[1], -d[0])); }
  }
}
function askNote(q, e){
  dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Annotation</p><h3 class="ed-name" style="margin:0">${e ? 'Modifier le texte' : 'Nouvelle annotation'}</h3></div></div>
    <div class="ed-body" style="display:block"><textarea class="note-in" id="noteTxt" placeholder="Ex. : Accès pompiers maintenu · Stationnement neutralisé du 3 au 14 mars">${esc(e?.text || '')}</textarea>
    <div class="btns"><button class="btn primary" id="noteOk">${e ? 'Enregistrer' : 'Ajouter'}</button><button class="btn" id="noteNo">Annuler</button></div></div>`, 'small');
  const ta = $('#noteTxt'); setTimeout(() => ta.focus(), 30);
  $('#noteOk').onclick = () => { const t = ta.value.trim(); closeEngine(); if (!t) return; if (e) edit(() => { e.text = t; }); else addEl({id:uid8(), t:'note', x:q[0], y:q[1], text:t, col:'#1565C0'}); };
  $('#noteNo').onclick = closeEngine;
}
function elCenter(e){ if (e.x != null) return [e.x, e.y]; if (e.pts?.length) return centroid(e.pts); if (e.a) return V.lerp(e.a, e.b, 0.5); return [0, 0]; }
function shiftEl(e, d){ if (e.x != null){ e.x += d[0]; e.y += d[1]; } if (e.pts) e.pts = e.pts.map(q => V.add(q, d)); if (e.a && e.b){ e.a = V.add(e.a, d); e.b = V.add(e.b, d); } if (e.env){ e.env.l = e.env.l.map(q => V.add(q, d)); e.env.r = e.env.r.map(q => V.add(q, d)); e.env.tracks = (e.env.tracks || []).map(t => t.map(q => V.add(q, d))); if (e.pose) e.pose = [e.pose[0] + d[0], e.pose[1] + d[1], e.pose[2]]; } if (e.t === 'closure' || e.t === 'detour') e.ids = null; }
function deleteSel(){ if (!sel) return; const e = byId(sel); edit(() => { state.els = state.els.filter(x => x.id !== sel && !(e?.t === 'closure' && (x.cl === sel || x.auto === sel))); }); sel = null; applySel(); refreshPanel(); toast('Élément supprimé'); }

/* ---------- pointeur ---------- */
let down = null, drag = null;
canvas.addEventListener('pointerdown', ev => {
  if (ev.button !== 0) return; down = {x:ev.clientX, y:ev.clientY, t:performance.now()};
  if ((tool === 'move' || tool === 'rotate') && WORLD !== undefined){
    const id = pickEl(ev) || (sel && tool === 'rotate' ? sel : null); if (id){ const e = byId(id); if (!e) return; sel = id; applySel(); beginEdit(); const q = groundAt(ev); drag = {id, start:q, orig:JSON.parse(JSON.stringify(e)), c:elCenter(e)}; ctl().enabled = false; canvas.setPointerCapture(ev.pointerId); refreshPanel(); }
  }
});
canvas.addEventListener('pointermove', ev => {
  const q0 = groundAt(ev); draw.cursor = q0;
  if (q0){ $('#coords').textContent = `x ${nf(q0[0], 2)} · y ${nf(q0[1], 2)}`; const z = NGF(q0[0], q0[1]); $('#ngfOut').textContent = z != null ? `NGF ${nf(z, 2)} m` : 'NGF —'; }
  if (drag && q0){
    const e = byId(drag.id); if (!e) return;
    if (tool === 'move'){ const d = V.sub(q0, drag.start), o = drag.orig; if (o.x != null){ const p = snapPt(V.add([o.x, o.y], d), {obj:false}); e.x = p[0]; e.y = p[1]; if (e.t === 'obj' && LIBK[e.k]?.sign && !e.manualA){ const a = autoOrient(e.x, e.y); if (a != null) e.a = a; } } else { const c = JSON.parse(JSON.stringify(o)); shiftEl(c, d); Object.assign(e, c); } }
    else { let a = Math.atan2(q0[1] - drag.c[1], q0[0] - drag.c[0]); if (ev.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); e.a = a; e.manualA = true; }
    rebuildProj(); return;
  }
  if (!q0) return;
  const q = POLY_TOOLS.has(tool) || tool === 'measure' || tool === 'place' ? snapPt(q0, {road:tool !== 'place', from:draw.pts[draw.pts.length - 1]}) : q0; draw.cursor = q;
  if (tool === 'close' && WORLD){ const nr = nearestRoad(q, 10); const key = nr ? nr.ri + ':' + nr.k : ''; if (key !== draw.hoverKey){ draw.hoverKey = key; clearPreview(); if (nr){ const sec = sectionAt(nr.ri, nr.k); if (sec){ const b = bandPreview(sec.pts, NET.roads[nr.ri].w + 0.6, 0xD32F2F); if (b) previewGroup.add(b); setPrompt(`<b>${esc(cap(sec.name))}</b> · ${fmtM(sec.len)} entre deux carrefours · cliquez pour barrer`); } } else setPrompt(); } }
  else if (tool === 'place') updateGhost();
  else if (POLY_TOOLS.has(tool) || tool === 'measure'){ if (draw.pts.length) updatePolyPreview(); }
  else if (tool === 'copy' && draw.copy){ /* aperçu léger : le contour de sélection suit */ }
});
canvas.addEventListener('pointerup', ev => {
  if (drag){ drag = null; ctl().enabled = true; endEdit(); rebuildProj(); refreshPanel(); return; }
  if (!down) return; const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6; down = null; if (moved) return;
  const q = groundAt(ev); if (!q && tool !== 'select') return;
  onClick(ev, POLY_TOOLS.has(tool) || tool === 'measure' ? snapPt(q, {road:true, from:draw.pts[draw.pts.length - 1]}) : tool === 'place' ? draw.cursor || q : q);
});
canvas.addEventListener('dblclick', () => { if (POLY_TOOLS.has(tool) && draw.pts.length > 1){ draw.pts.pop(); finishPoly(); } });
canvas.addEventListener('wheel', ev => { if (tool === 'place' && ev.shiftKey){ ev.preventDefault(); ev.stopImmediatePropagation(); PLACE.a += Math.sign(ev.deltaY) * Math.PI / 12; PLACE.manual = true; updateGhost(); } }, {capture:true, passive:false});
canvas.addEventListener('pointerleave', () => { if (ghost){ previewGroup.remove(ghost); ghost = null; dirty = true; } });
/* clavier */
const KEYS = {v:'select', g:'move', o:'rotate', c:'copy', l:'site', b:'close', d:'detour', z:'zone', k:'line', p:'place', t:'note', f:'arrow', r:'measure', e:'swept'};
window.addEventListener('keydown', ev => {
  if (ev.target.closest && ev.target.closest('input,select,textarea,[contenteditable]')) return;
  if (!$('#engDlg').hidden){ if (ev.key === 'Escape') closeEngine(); return; }
  const k = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && k === 'z'){ ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
  if ((ev.ctrlKey || ev.metaKey) && k === 'y'){ ev.preventDefault(); redo(); return; }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === 'Escape'){ if (draw.pts.length || draw.copy) { cancelDraw(); setPrompt(); syncHud(); } else setTool('select'); return; }
  if (ev.key === 'Enter'){ if (POLY_TOOLS.has(tool)) finishPoly(); return; }
  if (ev.key === 'Delete' || ev.key === 'Backspace'){ if (POLY_TOOLS.has(tool) && draw.pts.length){ draw.pts.pop(); updatePolyPreview(); syncHud(); } else deleteSel(); ev.preventDefault(); return; }
  if (ev.key === ' '){ ev.preventDefault(); SIM.on ? simStop(false) : simStart(); return; }
  if (k === 'r' && tool === 'place'){ PLACE.a += Math.PI / 12; PLACE.manual = true; updateGhost(); return; }
  if (KEYS[k]) setTool(KEYS[k]);
});
