/* ============ Modèles d'arrêté par client ============
   Chaque collectivité a son en-tête, son autorité signataire, ses visas et ses formulations. Les modèles sont enregistrés
   dans la bibliothèque personnelle du compte (cloud Studio Prism : mêmes modèles sur tous les appareils) ; chaque chantier
   retient le sien (state.meta.arrTpl). */
let USERLIB = {};
function arrTpls(){ return (USERLIB.arr ||= []); }
function arrTpl(){ const T = arrTpls(); return T.find(t => t.id === state.meta?.arrTpl) || (state.meta?.arrTpl === 'none' ? null : T[0]) || null; }
function saveUserLib(){ try { window.APLib?.save(USERLIB); } catch(e){} }
const ARR_FIELDS = [
  ['name', 'Nom du modèle', 'Ville de Rouen — voirie', 'in'],
  ['coll', 'Collectivité (en-tête, une ligne par ligne)', 'VILLE DE ROUEN\nDirection de l\'Espace public\nService Voirie', 'ta'],
  ['auth', 'Autorité signataire', 'Le Maire de la Ville de Rouen,', 'in'],
  ['visas', 'Visas supplémentaires (un par ligne)', 'Vu l\'arrêté municipal permanent du … relatif à la circulation ;', 'ta'],
  ['cons', 'Considérants supplémentaires', 'Considérant la demande de l\'entreprise … en date du … ;', 'ta'],
  ['arts', 'Articles supplémentaires (un paragraphe par article, « Titre : texte »)', 'Stationnement : le stationnement sera interdit et considéré comme gênant au droit du chantier.', 'ta'],
  ['ampl', 'Ampliation (destinataires)', 'M. le Commissaire de police, SDIS 76, Métropole Rouen Normandie (transports), l\'entreprise', 'ta'],
  ['city', 'Fait à', 'Rouen', 'in'],
  ['sign', 'Signataire (nom et qualité)', 'Pour le Maire et par délégation,\nL\'Adjoint chargé de la voirie', 'ta'],
];
function arrTplDialog(){
  const T = arrTpls(), cur = arrTpl();
  const form = t => `<div class="fields">${ARR_FIELDS.map(([k, l, ph, ty]) => `<label class="f wide"><span>${l}</span><span class="in">${ty === 'ta' ? `<textarea id="at_${k}" rows="${k === 'coll' || k === 'sign' ? 3 : 2}" placeholder="${esc(ph)}">${esc(t?.[k] || '')}</textarea>` : `<input id="at_${k}" value="${esc(t?.[k] || '')}" placeholder="${esc(ph)}">`}</span></label>`).join('')}
    <label class="f wide"><span>Logo (facultatif, image &lt; 200 Ko)</span><span class="in"><input id="at_logo" type="file" accept="image/png,image/jpeg,image/svg+xml">${t?.logo ? '<img src="' + t.logo + '" alt="" style="height:34px;margin-left:8px">' : ''}</span></label></div>`;
  const render = edit => {
    dlgEngine(`<div class="ed-h"><div><p class="eyebrow">Projet d'arrêté</p><h3 class="ed-name" style="margin:0">Modèles d'arrêté</h3></div></div>
      <div class="ed-body" style="display:block;max-height:65vh;overflow:auto">
        <p class="hint" style="margin-top:0">Un modèle par client ou par collectivité : en-tête, autorité, visas, articles et destinataires. Il est gardé dans votre compte et proposé pour tous vos chantiers.</p>
        <div class="fields"><label class="f wide"><span>Modèle utilisé pour ce chantier</span><span class="in"><select id="atSel"><option value="none"${state.meta?.arrTpl === 'none' || !T.length ? ' selected' : ''}>Modèle standard ARCHITRAFIC</option>${T.map(t => `<option value="${t.id}"${cur?.id === t.id ? ' selected' : ''}>${esc(t.name || 'Sans nom')}</option>`).join('')}</select></span></label></div>
        ${edit !== undefined ? `<h4 style="margin:14px 0 6px">${edit ? 'Modifier le modèle' : 'Nouveau modèle'}</h4>${form(edit)}` : `<div class="btns"><button class="btn" id="atNew" type="button">Nouveau modèle</button>${cur ? '<button class="btn" id="atEdit" type="button">Modifier ce modèle</button><button class="btn" id="atDup" type="button">Dupliquer</button><button class="btn" id="atDel" type="button" style="color:var(--closed)">Supprimer</button>' : ''}</div>`}
      </div>
      <div class="ed-f"><button class="btn" id="atPrev" type="button">Aperçu de l'arrêté</button><span style="flex:1"></span>${edit !== undefined ? '<button class="btn" id="atCancel">Annuler</button><button class="btn primary" id="atSave">Enregistrer le modèle</button>' : '<button class="btn primary" id="atClose">Fermer</button>'}</div>`, 'mid');
    $('#atSel').onchange = e => { edit_(() => { state.meta.arrTpl = e.target.value; }); render(); };
    $('#atPrev').onclick = () => exportArrete();
    if (edit === undefined){
      $('#atClose').onclick = closeEngine; $('#atNew').onclick = () => render(null);
      if ($('#atEdit')) $('#atEdit').onclick = () => render(cur);
      if ($('#atDup')) $('#atDup').onclick = () => { const c = {...cur, id:uid8(), name:(cur.name || 'Modèle') + ' (copie)'}; T.push(c); saveUserLib(); edit_(() => { state.meta.arrTpl = c.id; }); render(c); };
      if ($('#atDel')) $('#atDel').onclick = () => { USERLIB.arr = T.filter(t => t !== cur); saveUserLib(); edit_(() => { state.meta.arrTpl = ''; }); render(); };
    } else {
      $('#atCancel').onclick = () => render();
      $('#atSave').onclick = async () => {
        const t = edit || {id:uid8()}; for (const [k] of ARR_FIELDS) t[k] = $('#at_' + k).value.trim();
        const f = $('#at_logo').files?.[0]; if (f){ if (f.size > 200000){ toast('Logo trop lourd (200 Ko maximum).'); return; } t.logo = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); }); }
        if (!t.name) t.name = (t.coll || 'Modèle').split('\n')[0].slice(0, 60);
        if (!edit) T.push(t); saveUserLib(); edit_(() => { state.meta.arrTpl = t.id; }); toast('Modèle enregistré dans votre compte.'); render();
      };
    }
  };
  const edit_ = fn => { edit(fn); save(); };
  render();
}
/* morceaux d'arrêté tirés du modèle choisi (null : texte standard) */
function arrParts(){
  const t = arrTpl(); if (!t) return null;
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  return {
    head:(t.logo || t.coll) ? `<div class="arr-head">${t.logo ? `<img src="${t.logo}" alt="">` : ''}<div>${lines(t.coll).map((l, i) => i ? esc(l) : `<b>${esc(l)}</b>`).join('<br>')}</div></div>` : '',
    auth:t.auth ? esc(t.auth) : '', visas:lines(t.visas).map(esc), cons:lines(t.cons).map(esc),
    arts:lines(t.arts).map(a => { const i = a.indexOf(':'); return i > 0 && i < 60 ? [esc(a.slice(0, i).trim()), esc(a.slice(i + 1).trim().replace(/^./, c => c.toUpperCase()))] : ['', esc(a)]; }),
    ampl:t.ampl ? esc(t.ampl) : '', city:t.city ? esc(t.city) : '', sign:lines(t.sign).map(esc).join('<br>'),
  };
}
