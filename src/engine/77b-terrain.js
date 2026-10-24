/* ============ Mode terrain : pose de la signalisation depuis le téléphone ============
   Liste des panneaux et équipements du chantier, triés par distance à la position GPS du poseur,
   cochés au fur et à mesure : l'état « posé » est enregistré dans le projet (visible au bureau, synchronisé par le cloud). */
let terrainWatch = null, terrainPos = null;
function terrainItems(){
  const P = WORLD?.P; if (!P) return [];
  return state.els.filter(e => e.t === 'obj' && !phOff(e) && !e.hidden).map(e => { const L = LIBK[e.k], [lon, lat] = P.toLL(e.x, e.y), near = nearestRoad([e.x, e.y], 30, false);
    const d = terrainPos ? Math.hypot(...(() => { const [x, y] = P.toXY ? P.toXY(terrainPos.lon, terrainPos.lat) : [0, 0]; return [x - e.x, y - e.y]; })()) : null;
    return {e, L, lat, lon, rue:near?.r.name || '', d}; })
    .sort((a, b) => (!!a.e.posed - !!b.e.posed) || (a.d != null && b.d != null ? a.d - b.d : a.rue.localeCompare(b.rue)));
}
function openTerrain(){
  if (!WORLD?.P){ toast('Choisissez d\'abord le lieu du chantier.'); return; }
  const render = () => {
    const it = terrainItems(), done = it.filter(x => x.e.posed).length;
    dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Mode terrain</p><h3 class="ed-name" style="margin:0">Pose de la signalisation</h3></div><button class="btn" id="trClose" type="button">Fermer</button></div>
      <div class="tr-top"><b>${done} / ${it.length} posés</b><i class="tr-bar"><i style="width:${it.length ? done / it.length * 100 : 0}%"></i></i>
        <button class="btn${terrainWatch != null ? ' primary' : ''}" id="trGps" type="button">${terrainWatch != null ? (terrainPos ? `Position suivie (±${Math.round(terrainPos.acc)} m)` : 'Recherche de la position…') : 'Trier par distance (GPS)'}</button></div>
      <div class="ed-body tr-list" style="display:block">${it.length ? it.map((x, i) => `<div class="tr-it${x.e.posed ? ' ok' : ''}">
        <label><input type="checkbox" data-tr="${x.e.id}"${x.e.posed ? ' checked' : ''}><img src="${x.L?.sign ? signThumb(x.L.sign, {...(x.L.p || {}), ...(x.e.p || {})}) : thumbLazy(x.L)}" alt=""><span><b>${esc(x.L?.sign || '')} ${esc(x.L?.n || x.L?.name || x.e.k)}</b><small>${esc(x.rue || 'Voie non nommée')}${x.d != null ? ` · à ${x.d < 1000 ? Math.round(x.d) + ' m' : (x.d / 1000).toFixed(1).replace('.', ',') + ' km'}` : ''}${x.e.posed ? ` · posé ${new Date(x.e.posed).toLocaleString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}` : ''}</small></span></label>
        <span class="tr-acts"><button class="btn" type="button" data-trv="${x.e.id}">Plan</button><a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${x.lat.toFixed(6)},${x.lon.toFixed(6)}" target="_blank" rel="noopener">Y aller</a></span></div>`).join('') : '<p class="hint">Aucun panneau dans ce chantier (ou cette phase).</p>'}</div>`, 'mid');
    $('#trClose').onclick = () => { stopGps(); closeEngine(); };
    $('#trGps').onclick = () => { if (terrainWatch != null){ stopGps(); render(); return; } if (!navigator.geolocation){ toast('Position indisponible sur cet appareil.'); return; }
      terrainWatch = navigator.geolocation.watchPosition(p => { terrainPos = {lat:p.coords.latitude, lon:p.coords.longitude, acc:p.coords.accuracy}; if (!$('#engDlg').hidden && $('#trGps')) render(); },
        () => { toast('Position refusée ou indisponible.'); stopGps(); render(); }, {enableHighAccuracy:true, maximumAge:5000}); render(); };
    $$('[data-tr]').forEach(b => b.onchange = () => { const e = state.els.find(x => x.id === b.dataset.tr); if (!e) return; edit(() => { if (b.checked) e.posed = Date.now(); else delete e.posed; }); save(); render(); });
    $$('[data-trv]').forEach(b => b.onclick = () => { const e = state.els.find(x => x.id === b.dataset.trv); if (!e) return; stopGps(); closeEngine(); if (view !== '2d') setView('2d'); frameAt(e.x, e.y, 25); sel = e.id; applySel(); refreshPanel(); });
  };
  const stopGps = () => { if (terrainWatch != null) navigator.geolocation.clearWatch(terrainWatch); terrainWatch = null; terrainPos = null; };
  render();
}
