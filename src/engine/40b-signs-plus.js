/* ============ Bibliothèque étendue de panneaux français ============
   Danger (A), intersection et priorité (AB), prescription (B), indication (C), localisation (EB), direction (D),
   signalisation temporaire (AK, K, KC, KD, KM) et panonceaux (M). Pictogrammes simplifiés dessinés dans l'app (libres de droit),
   formes et couleurs selon l'Instruction interministérielle sur la signalisation routière. */
const ctr = g => { g.textAlign = 'center'; g.textBaseline = 'middle'; };
function slash(g, w = 20){ g.strokeStyle = SC.red; g.lineWidth = w; g.beginPath(); g.moveTo(62, 62); g.lineTo(194, 194); g.stroke(); }
function bigText(g, t, y = 134, size = 112, col = SC.blk, maxW = 160){ g.fillStyle = col; ctr(g); textFit(g, t, 128, y, maxW, size); }
function lorry(g, x, y, s, col){ g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col; g.fillRect(-46, -30, 62, 34); g.fillRect(20, -18, 26, 22); g.fillStyle = SC.wht; g.fillRect(26, -14, 14, 9); g.fillStyle = col; for (const xx of [-32, -12, 32]){ g.beginPath(); g.arc(xx, 8, 8, 0, 7); g.fill(); } g.restore(); }
function cycle(g, x, y, s, col){ g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 6; g.lineCap = 'round';
  for (const xx of [-28, 28]){ g.beginPath(); g.arc(xx, 10, 17, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(-28, 10); g.lineTo(-6, -14); g.lineTo(20, -14); g.lineTo(28, 10); g.moveTo(-6, -14); g.lineTo(2, 10); g.lineTo(20, -14); g.moveTo(-10, -22); g.lineTo(0, -22); g.moveTo(18, -22); g.lineTo(26, -26); g.stroke(); g.restore(); }
function children(g){ walker(g, 108, 172, 0.95, SC.blk); walker(g, 150, 178, 0.78, SC.blk); }
function bendArrow(g, side, dbl = false){ g.strokeStyle = SC.blk; g.lineWidth = 15; g.lineCap = 'butt'; g.beginPath(); g.moveTo(128 - side * 14, 206);
  if (dbl){ g.bezierCurveTo(128 - side * 14, 176, 128 + side * 26, 176, 128 + side * 22, 150); g.bezierCurveTo(128 + side * 18, 128, 128 - side * 22, 128, 128 - side * 18, 106); } else g.bezierCurveTo(128 - side * 14, 150, 128 - side * 10, 128, 128 + side * 18, 116);
  g.stroke(); const e = dbl ? [128 - side * 18, 96] : [128 + side * 34, 108]; g.fillStyle = SC.blk; g.beginPath(); if (dbl){ g.moveTo(e[0], e[1] - 8); g.lineTo(e[0] - 16, e[1] + 14); g.lineTo(e[0] + 16, e[1] + 14); } else { g.moveTo(e[0] + side * 4, e[1]); g.lineTo(e[0] - side * 18, e[1] - 16); g.lineTo(e[0] - side * 14, e[1] + 22); } g.fill(); }
function cross(g, w = 20, kind = 'x'){ g.fillStyle = SC.blk; if (kind === 'x' || kind === 'T' ) g.fillRect(128 - w / 2, kind === 'T' ? 140 : 96, w, kind === 'T' ? 66 : 110); if (kind !== 'v') g.fillRect(80, 150 - w / 2, 96, w); if (kind === 'v'){ g.fillRect(128 - w / 2, 96, w, 110); } }
function rbArrows(g, col = SC.blk, r = 38, cx = 128, cy = 156){ g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 12; for (let i = 0; i < 3; i++){ const a0 = i * 2.094 - 1.4, a1 = a0 + 1.45; g.beginPath(); g.arc(cx, cy, r, a0, a1, true); g.stroke(); const ex = cx + Math.cos(a1) * r, ey = cy + Math.sin(a1) * r, t = a1 - Math.PI / 2; g.beginPath(); g.moveTo(ex + Math.cos(t) * 14, ey + Math.sin(t) * 14); g.lineTo(ex - Math.cos(t - 1.57) * 12, ey - Math.sin(t - 1.57) * 12); g.lineTo(ex + Math.cos(t - 1.57) * 12, ey + Math.sin(t - 1.57) * 12); g.fill(); } }
function dimArrows(g, vert){ g.fillStyle = SC.blk; const T = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, 0); g.lineTo(-16, -22); g.lineTo(16, -22); g.fill(); g.restore(); };
  if (vert){ T(128, 70, Math.PI); T(128, 186, 0); } else { T(70, 128, Math.PI / 2); T(186, 128, -Math.PI / 2); } }
function townBg(g, w, h, red = true){ rr(g, 3, 3, w - 6, h - 6, h * 0.08); g.fillStyle = SC.wht; g.fill(); g.strokeStyle = red ? SC.red : SC.blk; g.lineWidth = h * 0.07; rr(g, h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16, h * 0.05); g.stroke(); }
function blueRect(g, w, h){ rr(g, 3, 3, w - 6, h - 6, h * 0.07); g.fillStyle = SC.wht; g.fill(); rr(g, h * 0.045, h * 0.045, w - h * 0.09, h - h * 0.09, h * 0.05); g.fillStyle = SC.blue; g.fill(); }
const txtLines = (g, p, w, h, def, col = SC.blk, k0 = 0.3) => { const L = String(p?.t || def).split(/\n|\|/).slice(0, 3), k = L.length === 1 ? k0 : L.length === 2 ? k0 * 0.78 : k0 * 0.62; g.fillStyle = col; ctr(g); L.forEach((t, i) => textFit(g, t, w / 2, h / 2 + (i - (L.length - 1) / 2) * h * (k + 0.06), w - h * 0.25, Math.round(h * k), '800', 'Arial Narrow, Arial, Helvetica, sans-serif')); };

Object.assign(SIGNS, {
  /* ---- danger ---- */
  A1a:{n:'Virage à droite', s:'tri', draw:g => bendArrow(g, 1)}, A1b:{n:'Virage à gauche', s:'tri', draw:g => bendArrow(g, -1)},
  A1c:{n:'Succession de virages (1er à droite)', s:'tri', draw:g => bendArrow(g, 1, true)}, A1d:{n:'Succession de virages (1er à gauche)', s:'tri', draw:g => bendArrow(g, -1, true)},
  A2b:{n:'Ralentisseur de type dos-d\'âne', s:'tri', draw:SIGNS.AK2.draw}, A3:{n:'Chaussée rétrécie', s:'tri', draw:g => narrows(g, 0)}, A3a:{n:'Chaussée rétrécie par la droite', s:'tri', draw:g => narrows(g, 1)}, A3b:{n:'Chaussée rétrécie par la gauche', s:'tri', draw:g => narrows(g, -1)},
  A4:{n:'Chaussée glissante', s:'tri', draw:SIGNS.AK4.draw}, A13a:{n:'Endroit fréquenté par les enfants', s:'tri', draw:children},
  A14:{n:'Autres dangers', s:'tri', draw:SIGNS.AK14.draw}, A17:{n:'Feux tricolores', s:'tri', draw:SIGNS.AK17.draw},
  A18:{n:'Circulation dans les deux sens', s:'tri', draw:g => { arrow(g, 108, 204, 108, 106, 14, 30, SC.blk); arrow(g, 148, 100, 148, 198, 14, 30, SC.blk); }},
  A19:{n:'Risque de chute de pierres', s:'tri', draw:g => { g.fillStyle = SC.blk; g.beginPath(); g.moveTo(80, 204); g.lineTo(80, 100); g.lineTo(122, 204); g.fill(); [[132, 150, 10], [150, 176, 13], [170, 196, 8], [124, 188, 7]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); }},
  A21:{n:'Débouché de cyclistes', s:'tri', draw:g => cycle(g, 128, 166, 1.0, SC.blk)},
  AB1:{n:'Intersection (priorité à droite)', s:'tri', draw:g => cross(g, 20, 'x')},
  AB2:{n:'Intersection avec une route non prioritaire', s:'tri', draw:g => { g.fillStyle = SC.blk; g.fillRect(118, 92, 20, 114); g.fillRect(88, 152, 80, 9); }},
  AB25:{n:'Carrefour à sens giratoire', s:'tri', draw:g => rbArrows(g)},
  AB6:{n:'Route à caractère prioritaire', s:'sq', bg:g => { g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); g.fillStyle = SC.wht; rr(g, -88, -88, 176, 176, 10); g.fill(); g.strokeStyle = SC.blk; g.lineWidth = 3; g.stroke(); g.fillStyle = SC.yel; rr(g, -60, -60, 120, 120, 6); g.fill(); g.restore(); }},
  AB7:{n:'Fin de route prioritaire', s:'sq', bg:g => { SIGNS.AB6.bg(g); g.strokeStyle = SC.blk; g.lineWidth = 14; g.beginPath(); g.moveTo(64, 192); g.lineTo(192, 64); g.stroke(); }},
  /* ---- prescription ---- */
  B4:{n:'Interdiction de dépasser pour les poids lourds', s:'circ', draw:g => { lorry(g, 96, 144, 0.62, SC.red); car(g, 166, 144, 0.55, SC.blk); }},
  B7b:{n:'Accès interdit aux véhicules à moteur', s:'circ', draw:g => { car(g, 128, 120, 0.7, SC.blk); g.fillStyle = SC.blk; g.beginPath(); g.arc(128, 174, 14, 0, 7); g.fill(); }},
  B9a:{n:'Accès interdit aux véhicules à moteur (sauf cyclomoteurs)', s:'circ', draw:g => car(g, 128, 136, 0.82, SC.blk)},
  B9b:{n:'Accès interdit aux cycles', s:'circ', draw:g => cycle(g, 128, 132, 1.25, SC.blk)},
  B10a:{n:'Accès interdit aux véhicules de longueur supérieure à', s:'circ', p:{v:'10 m'}, draw:(g, p) => { bigText(g, p?.v || '10 m', 130, 40, SC.blk, 84); dimArrows(g, false); }},
  B11:{n:'Accès interdit aux véhicules de largeur supérieure à', s:'circ', p:{v:'2 m'}, draw:(g, p) => { bigText(g, p?.v || '2 m', 130, 44, SC.blk, 84); dimArrows(g, false); }},
  B12:{n:'Accès interdit aux véhicules de hauteur supérieure à', s:'circ', p:{v:'3,5 m'}, draw:(g, p) => { bigText(g, p?.v || '3,5 m', 130, 52, SC.blk, 150); dimArrows(g, true); }},
  B13:{n:'Accès interdit aux véhicules de poids total supérieur à', s:'circ', p:{v:'3,5 t'}, draw:(g, p) => bigText(g, p?.v || '3,5 t', 134, 80, SC.blk, 156)},
  B16:{n:'Signaux sonores interdits', s:'circ', draw:g => { g.fillStyle = SC.blk; g.beginPath(); g.moveTo(84, 116); g.lineTo(120, 116); g.lineTo(168, 88); g.lineTo(168, 168); g.lineTo(120, 140); g.lineTo(84, 140); g.fill(); slash(g); }},
  B18c:{n:'Accès interdit aux transports de marchandises dangereuses', s:'circ', draw:g => { g.fillStyle = SC.orange; g.fillRect(70, 100, 116, 56); g.strokeStyle = SC.blk; g.lineWidth = 6; g.strokeRect(70, 100, 116, 56); g.fillRect(70, 126, 116, 4); }},
  B19:{n:'Autres interdictions (texte)', s:'circ', p:{t:'DOUANE'}, draw:(g, p) => bigText(g, String(p?.t || 'DOUANE').toUpperCase(), 132, 40, SC.blk, 156)},
  B21a1:{n:'Contournement obligatoire par la droite', s:'blue', draw:g => arrow(g, 92, 92, 166, 166, 26, 58, SC.wht)}, B21a2:{n:'Contournement obligatoire par la gauche', s:'blue', draw:g => arrow(g, 164, 92, 90, 166, 26, 58, SC.wht)},
  B21e:{n:'Directions obligatoires : tout droit ou à droite', s:'blue', draw:g => { arrow(g, 112, 204, 112, 58, 22, 46, SC.wht); g.strokeStyle = SC.wht; g.lineWidth = 22; g.beginPath(); g.moveTo(112, 150); g.quadraticCurveTo(112, 124, 150, 124); g.stroke(); arrow(g, 140, 124, 200, 124, 22, 44, SC.wht); }},
  B22a:{n:'Piste ou bande obligatoire pour les cycles', s:'blue', draw:g => cycle(g, 128, 134, 1.25, SC.wht)},
  B22b:{n:'Chemin obligatoire pour piétons', s:'blue', draw:g => walker(g, 128, 156, 1.35, SC.wht)},
  B27a:{n:'Voie réservée aux véhicules des services réguliers de transport en commun', s:'sq', draw:g => { g.fillStyle = SC.wht; ctr(g); textFit(g, 'BUS', 128, 128, 190, 86); }},
  B30:{n:'Zone 30 (entrée)', s:'rect', ar:0.85, bg:(g, w, h) => { rr(g, 3, 3, w - 6, h - 6, h * 0.06); g.fillStyle = SC.wht; g.fill(); g.strokeStyle = SC.blk; g.lineWidth = 2; g.stroke(); }, draw:(g, p, w, h) => { g.save(); g.translate(w / 2 - 128 * w / 300, h * 0.04); g.scale(w / 300, w / 300); g.fillStyle = SC.red; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.fillStyle = SC.wht; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.fill(); g.fillStyle = SC.blk; ctr(g); textFit(g, '30', 128, 134, 150, 120); g.restore(); g.fillStyle = SC.blk; ctr(g); textFit(g, 'ZONE', w / 2, h * 0.86, w * 0.8, Math.round(h * 0.16), '900'); }},
  B31:{n:'Fin de toutes les interdictions', s:'end', draw:g => { g.strokeStyle = SC.blk; g.lineWidth = 8; for (const d of [-22, 0, 22]){ g.beginPath(); g.moveTo(72 + d, 184 + d); g.lineTo(184 + d, 72 + d); g.stroke(); } }},
  B34:{n:'Fin d\'interdiction de dépasser', s:'end', draw:g => { car(g, 98, 140, 0.62, SC.grey); car(g, 160, 140, 0.62, SC.grey); g.strokeStyle = SC.blk; g.lineWidth = 12; g.beginPath(); g.moveTo(70, 186); g.lineTo(186, 70); g.stroke(); }},
  B45a:{n:'Voie verte', s:'sq', draw:g => { walker(g, 96, 160, 1.0, SC.wht); cycle(g, 168, 166, 0.8, SC.wht); }},
  B52:{n:'Zone de rencontre (entrée)', s:'rect', ar:0.85, bg:(g, w, h) => blueRect(g, w, h), draw:(g, p, w, h) => { walker(g, w * 0.3, h * 0.5, h / 256 * 1.1, SC.wht); car(g, w * 0.66, h * 0.55, h / 256 * 0.6, SC.wht); g.fillStyle = SC.wht; ctr(g); textFit(g, 'ZONE DE', w / 2, h * 0.72, w * 0.84, Math.round(h * 0.1), '900'); textFit(g, 'RENCONTRE', w / 2, h * 0.86, w * 0.84, Math.round(h * 0.1), '900'); }},
  B54:{n:'Aire piétonne (entrée)', s:'rect', ar:0.85, bg:(g, w, h) => blueRect(g, w, h), draw:(g, p, w, h) => { walker(g, w * 0.4, h * 0.56, h / 256 * 1.3, SC.wht); walker(g, w * 0.64, h * 0.6, h / 256 * 1.05, SC.wht); g.fillStyle = SC.wht; ctr(g); textFit(g, 'AIRE PIÉTONNE', w / 2, h * 0.84, w * 0.86, Math.round(h * 0.1), '900'); }},
  /* ---- indication ---- */
  C1a:{n:'Lieu aménagé pour le stationnement', s:'sq', draw:g => { g.fillStyle = SC.wht; ctr(g); textFit(g, 'P', 128, 136, 160, 190, '900'); }},
  C4a:{n:'Stationnement réglementé (zone bleue)', s:'sq', draw:g => { g.fillStyle = SC.wht; ctr(g); textFit(g, 'P', 128, 110, 140, 130, '900'); textFit(g, 'DISQUE', 128, 206, 200, 34, '800'); }},
  C20a:{n:'Passage pour piétons', s:'sq', draw:g => { g.fillStyle = SC.wht; g.beginPath(); g.moveTo(128, 34); g.lineTo(222, 208); g.lineTo(34, 208); g.closePath(); g.fill(); walker(g, 128, 166, 1.0, SC.blk); g.fillStyle = SC.blk; for (let i = 0; i < 4; i++) g.fillRect(70 + i * 32, 196, 18, 8); }},
  C27:{n:'Surélévation de chaussée', s:'sq', draw:g => { g.fillStyle = SC.wht; g.beginPath(); g.moveTo(40, 190); g.lineTo(90, 190); g.lineTo(110, 150); g.lineTo(146, 150); g.lineTo(166, 190); g.lineTo(216, 190); g.lineTo(216, 204); g.lineTo(40, 204); g.fill(); }},
  C113:{n:'Piste ou bande cyclable conseillée', s:'sq', draw:g => cycle(g, 128, 136, 1.3, SC.wht)},
  C107:{n:'Route à accès réglementé', s:'sq', draw:g => { car(g, 128, 134, 1.3, SC.wht); }},
  CE15a:{n:'Toilettes ouvertes au public', s:'sq', draw:g => { g.fillStyle = SC.wht; rr(g, 34, 34, 188, 188, 10); g.fill(); g.fillStyle = SC.blue; ctr(g); textFit(g, 'WC', 128, 132, 160, 96, '900'); }},
  EB10:{n:'Entrée d\'agglomération', s:'rect', ar:2.6, p:{t:'NOM DE LA COMMUNE'}, bg:(g, w, h) => townBg(g, w, h, true), draw:(g, p, w, h) => txtLines(g, p, w, h, 'NOM DE LA COMMUNE', SC.blk, 0.26)},
  EB20:{n:'Sortie d\'agglomération', s:'rect', ar:2.6, p:{t:'NOM DE LA COMMUNE'}, bg:(g, w, h) => townBg(g, w, h, true), draw:(g, p, w, h) => { txtLines(g, p, w, h, 'NOM DE LA COMMUNE', SC.blk, 0.26); g.strokeStyle = SC.red; g.lineWidth = h * 0.09; g.beginPath(); g.moveTo(w * 0.08, h * 0.85); g.lineTo(w * 0.92, h * 0.15); g.stroke(); }},
  D21a:{n:'Panneau de direction (agglomération)', s:'rect', ar:3.4, p:{t:'Centre-ville'}, bg:(g, w, h) => { g.beginPath(); g.moveTo(4, 4); g.lineTo(w - h * 0.45, 4); g.lineTo(w - 4, h / 2); g.lineTo(w - h * 0.45, h - 4); g.lineTo(4, h - 4); g.closePath(); g.fillStyle = SC.wht; g.fill(); g.strokeStyle = SC.blk; g.lineWidth = h * 0.05; g.stroke(); },
    draw:(g, p, w, h) => { g.fillStyle = SC.blk; g.textAlign = 'left'; g.textBaseline = 'middle'; textFit(g, String(p?.t || 'Centre-ville'), h * 0.25, h / 2, w - h * 0.9, Math.round(h * 0.42), '700'); }},
  /* ---- signalisation temporaire ---- */
  AK1:{n:'Virage (temporaire)', s:'tri', ak:1, draw:g => bendArrow(g, 1)},
  AK15:{n:'Annonce de signaux lumineux', s:'tri', ak:1, draw:g => { g.fillStyle = SC.blk; rr(g, 110, 96, 36, 92, 8); g.fill(); g.fillStyle = SC.yel; for (const y of [112, 142, 172]){ g.beginPath(); g.arc(128, y, 10, 0, 7); g.fill(); } }},
  AK21:{n:'Débouché de cyclistes (temporaire)', s:'tri', ak:1, draw:g => cycle(g, 128, 166, 1.0, SC.blk)},
  AK32:{n:'Chaussée déformée', s:'tri', ak:1, draw:g => { g.fillStyle = SC.blk; g.beginPath(); g.moveTo(66, 200); for (let x = 66; x <= 190; x += 4) g.lineTo(x, 186 - Math.abs(Math.sin((x - 66) / 20)) * 22); g.lineTo(190, 204); g.lineTo(66, 204); g.fill(); }},
  K8:{n:'Panneau de position de chantier (K8)', s:'rect', ak:0, ar:2.4, bg:(g, w, h) => { rr(g, 3, 3, w - 6, h - 6, h * 0.08); g.save(); g.clip(); const n = 8, s = w / n; for (let i = -2; i < n + 2; i++){ g.fillStyle = i % 2 ? SC.wht : SC.red; g.beginPath(); g.moveTo(i * s, h); g.lineTo(i * s + s, h); g.lineTo(i * s + s + h, 0); g.lineTo(i * s + h, 0); g.fill(); } g.restore(); }},
  K10:{n:'Piquet mobile (sens imposé)', s:'circ', bg:g => { g.fillStyle = SC.red; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.fillStyle = SC.wht; g.fillRect(40, 108, 176, 40); }},
  KC1_chantier:{n:'Chantier', s:'rect', ak:1, ar:1.6, p:{t:'CHANTIER'}, base:'KC1'},
  KC1_camions:{n:'Sortie de camions', s:'rect', ak:1, ar:1.6, p:{t:'SORTIE|DE CAMIONS'}, base:'KC1'},
  KC1_fin:{n:'Fin de chantier', s:'rect', ak:1, ar:1.6, p:{t:'FIN DE|CHANTIER'}, base:'KC1'},
  KC1_trottoir:{n:'Trottoir fermé', s:'rect', ak:1, ar:1.6, p:{t:'TROTTOIR|FERMÉ'}, base:'KC1'},
  KC1_gravillons:{n:'Gravillons', s:'rect', ak:1, ar:1.6, p:{t:'GRAVILLONS'}, base:'KC1'},
  KC1_vitesse:{n:'Réduisez votre vitesse', s:'rect', ak:1, ar:1.6, p:{t:'RÉDUISEZ|VOTRE VITESSE'}, base:'KC1'},
  KC1_accesM:{n:'Accès chantier', s:'rect', ak:1, ar:1.6, p:{t:'ACCÈS|CHANTIER'}, base:'KC1'},
  KC1_commerces:{n:'Commerces ouverts', s:'rect', ak:1, ar:1.6, p:{t:'COMMERCES|OUVERTS'}, base:'KC1'},
  KC1_impasse:{n:'Impasse sauf riverains', s:'rect', ak:1, ar:1.6, p:{t:'IMPASSE|SAUF RIVERAINS'}, base:'KC1'},
  KD69:{n:'Fin de déviation (KD69)', s:'rect', ak:1, ar:2.0, p:{t:'FIN DE|DÉVIATION'}, base:'KD8'},
  KD9:{n:'Itinéraire de déviation (présignalisation)', s:'rect', ak:1, ar:1.3, p:{t:'DÉVIATION|Centre-ville'}, base:'KD8'},
  KD10:{n:'Direction de déviation (flèche)', s:'rect', ak:1, ar:3.0, p:{t:'Centre-ville'}, bg:(g, w, h) => { g.beginPath(); g.moveTo(4, 4); g.lineTo(w - h * 0.45, 4); g.lineTo(w - 4, h / 2); g.lineTo(w - h * 0.45, h - 4); g.lineTo(4, h - 4); g.closePath(); g.fillStyle = SC.yel; g.fill(); g.strokeStyle = SC.blk; g.lineWidth = h * 0.05; g.stroke(); },
    draw:(g, p, w, h) => { g.fillStyle = SC.blk; g.textAlign = 'left'; g.textBaseline = 'middle'; textFit(g, String(p?.t || 'Centre-ville'), h * 0.22, h / 2, w - h * 0.85, Math.round(h * 0.4), '800'); }},
  KD42:{n:'Fin de déviation', s:'rect', ak:1, ar:2.4, draw:(g, p, w, h) => { txtLines(g, {t:'FIN DE|DÉVIATION'}, w, h, '', SC.blk, 0.3); g.strokeStyle = SC.blk; g.lineWidth = h * 0.06; g.beginPath(); g.moveTo(w * 0.1, h * 0.88); g.lineTo(w * 0.9, h * 0.12); g.stroke(); }},
  KM1:{n:'Panonceau de distance', s:'rect', ak:1, ar:2.6, p:{t:'à 200 m'}, draw:(g, p, w, h) => txtLines(g, p, w, h, 'à 200 m', SC.blk, 0.5)},
  KM2:{n:'Panonceau d\'étendue', s:'rect', ak:1, ar:2.6, p:{t:'sur 500 m'}, draw:(g, p, w, h) => { txtLines(g, p, w, h, 'sur 500 m', SC.blk, 0.42); }},
  KM9z:{n:'Panonceau à texte (temporaire)', s:'rect', ak:1, ar:2.6, p:{t:'SAUF BUS'}, draw:(g, p, w, h) => txtLines(g, p, w, h, 'SAUF BUS', SC.blk, 0.46)},
  M1:{n:'Panonceau de distance', s:'rect', ar:2.6, p:{t:'150 m'}, draw:(g, p, w, h) => txtLines(g, p, w, h, '150 m', SC.blk, 0.5)},
  M2:{n:'Panonceau d\'étendue', s:'rect', ar:2.6, p:{t:'sur 2 km'}, draw:(g, p, w, h) => txtLines(g, p, w, h, 'sur 2 km', SC.blk, 0.46)},
  M9z:{n:'Panonceau complémentaire (texte)', s:'rect', ar:2.6, p:{t:'SAUF RIVERAINS'}, draw:(g, p, w, h) => txtLines(g, p, w, h, 'SAUF RIVERAINS', SC.blk, 0.42)},
});
/* catégories de la bibliothèque (ordre d'affichage) */
const SIGN_LIB = {
  temp:['AK5', 'AK3', 'AK3a', 'AK3b', 'AK1', 'AK2', 'AK4', 'AK14', 'AK15', 'AK17', 'AK21', 'AK22', 'AK30', 'AK31', 'AK32', 'K8', 'K10', 'KC1', 'KR_ROUTE', 'KC1_chantier', 'KC1_camions', 'KC1_fin', 'KC1_trottoir', 'KC1_gravillons', 'KC1_vitesse', 'KC1_accesM', 'KC1_commerces', 'KC1_impasse', 'KD8', 'KD9', 'KD10', 'KD69', 'KD22a', 'KD22b', 'KD22c', 'KD42', 'KM1', 'KM2', 'KM9', 'KM9z'],
  dang:['A1a', 'A1b', 'A1c', 'A1d', 'A2b', 'A3', 'A3a', 'A3b', 'A4', 'A13a', 'A13b', 'A14', 'A17', 'A18', 'A19', 'A21', 'AB1', 'AB2', 'AB3a', 'AB4', 'AB6', 'AB7', 'AB25'],
  reg:['B0', 'B1', 'B2a', 'B2b', 'B3', 'B4', 'B6a1', 'B6d', 'B7b', 'B8', 'B9a', 'B9b', 'B9g', 'B10a', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B18c', 'B19', 'B21_1', 'B21_2', 'B21c1', 'B21c2', 'B21d1', 'B21e', 'B22a', 'B22b', 'B27a', 'B30', 'B31', 'B33', 'B34', 'B45a', 'B52', 'B54'],
  ind:['C1a', 'C4a', 'C12', 'C13a', 'C18', 'C20a', 'C27', 'C107', 'C113', 'CE15a', 'EB10', 'EB20', 'D21a', 'M1', 'M2', 'M9z'],
};
