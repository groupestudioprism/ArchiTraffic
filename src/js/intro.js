/* intro ARCHITRAFIC : une voiture s'arrête au feu rouge, repart au vert et, sur son passage, dévoile le logo officiel (aucune réécriture : l'image officielle est masquée par un rideau que la voiture « tire »).
   Web Animations API : déterministe et « seekable ». Une fois par session (sessionStorage), ?intro=1 pour rejouer. Exposé : window.__spHide() (demande de fermeture, le splash reste jusqu'à la fin de la scène). */
(function(){
  var sp = document.getElementById('splash'); if (!sp) return;
  var T0 = performance.now(), SW = 2900, EXIT = 3300, FADE = 600, KEY = 'prism-intro-architrafic';
  var EASE_IN = 'cubic-bezier(.22,.8,.2,1)', EASE_IO = 'cubic-bezier(.65,0,.35,1)', EASE_M = 'cubic-bezier(.4,0,.2,1)';
  var stage = sp.querySelector('.sp-stage'), cam = sp.querySelector('.sp-cam'), skip = sp.querySelector('.sp-skip');
  var anims = [], endAt = T0 + EXIT, hiding = false, closed = false, hideT = 0, played = false;
  function q(s){ return sp.querySelector(s); }
  function qa(s){ return [].slice.call(sp.querySelectorAll(s)); }
  function fit(){ try { stage.style.setProperty('--k', (stage.offsetWidth / 1200).toFixed(5)); } catch(e){} }
  function A(el, kf, o){ if (!el) return null; o.fill = o.fill || 'both'; var a = el.animate(kf, o); anims.push(a); return a; }
  function cancelAll(){ anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); anims = []; }
  function finalize(){ // état final = écran de chargement stable (logo officiel, barre, message)
    cancelAll(); sp.classList.remove('sp-play'); sp.classList.add('sp-static', 'sp-on'); if (skip) skip.hidden = true;
  }
  function close(){
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', fit);
    sp.classList.add('done');
    try { if (sp.contains(document.activeElement)) document.activeElement.blur(); } catch(e){}
    setTimeout(function(){ cancelAll(); sp.remove(); var bg = document.getElementById('spBg'); if (bg) bg.remove(); }, FADE + 100);
  }
  function hide(){ if (hiding || closed) return; hiding = true; hideT = setTimeout(close, Math.max(0, endAt - performance.now())); }
  window.__spHide = hide;
  function doSkip(){ if (closed || !played) return; played = false; finalize(); endAt = performance.now(); if (hiding){ clearTimeout(hideT); close(); } }
  function onKey(e){
    if (!played) return;
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.target === document.body || sp.contains(e.target)) && e.target !== skip)){ e.preventDefault(); doSkip(); }
  }
  fit(); window.addEventListener('resize', fit);
  var seen = false, force = /[?&]intro=1(&|$)/.test(location.search);
  try { seen = sessionStorage.getItem(KEY) === '1'; } catch(e){}
  var reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch(e){}
  if (reduce || (seen && !force)){ endAt = T0 + 600; sp.classList.add('sp-static', 'sp-on'); return; }
  try {
    try { sessionStorage.setItem(KEY, '1'); } catch(e){}
    var k = stage.offsetWidth / 1200, r = stage.getBoundingClientRect();
    var right = (innerWidth - r.left) / k;                       // bord droit de l'écran, en unités du logo
    var X0 = -720, XS = -124, D = Math.max(1300, Math.min(2000, right + 230 - 110)); // départ hors champ, arrêt au feu (avant à x=110), course complète
    var T1 = 1050, DUR = Math.round(Math.max(1250, Math.min(1900, D * 0.95)));      // feu vert à ~1,0 s ; durée du passage
    var TE = T1 + DUR, SWT = TE + 350;
    sp.classList.add('sp-play', 'sp-on'); if (skip){ skip.hidden = false; skip.addEventListener('click', doSkip); }
    document.addEventListener('keydown', onKey, true);
    played = true;
    var car = q('.sp-car'), bob = q('.sp-bob svg'), whs = qa('.sp-wh');
    var ROT = 0.33 * 180 / Math.PI / 14.5;                       // rotation des roues par unité parcourue (réduite : pas d'effet stroboscopique)
    A(q('.sp-ground'), [{opacity: 0, transform: 'scaleY(.4)'}, {opacity: 1, transform: 'none'}], {duration: 380, easing: EASE_IN});
    A(q('.sp-tl'), [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}], {delay: 120, duration: 360, easing: EASE_IN});
    // 1) arrivée : la voiture freine et s'arrête avant le feu rouge
    var arr = {delay: 100, duration: 760, easing: EASE_IN};
    A(car, [{transform: 'translateX(' + X0 + 'px)'}, {transform: 'translateX(' + XS + 'px)'}], arr);
    whs.forEach(function(w){ A(w, [{transform: 'rotate(0deg)'}, {transform: 'rotate(' + ((XS - X0) * ROT).toFixed(0) + 'deg)'}], arr); });
    A(bob, [{transform: 'rotate(0deg)'}, {transform: 'rotate(0deg)', offset: .72}, {transform: 'rotate(1.6deg)', offset: .9}, {transform: 'rotate(0deg)'}], {delay: 100, duration: 900, easing: EASE_IO});
    // 2) le feu passe au vert
    A(q('.sp-lr'), [{opacity: 1}, {opacity: 0}], {delay: T1 - 80, duration: 140});
    A(q('.sp-hr'), [{opacity: .22}, {opacity: 0}], {delay: T1 - 80, duration: 140});
    A(q('.sp-lg'), [{opacity: 0}, {opacity: 1}], {delay: T1, duration: 160});
    A(q('.sp-hg'), [{opacity: 0}, {opacity: .3}], {delay: T1, duration: 160});
    // 3) départ : la voiture traverse la scène, le rideau se retire juste derrière son avant
    var dep = {delay: T1 + 50, duration: DUR, easing: 'cubic-bezier(.5,.08,.78,.62)', fill: 'forwards'};
    A(car, [{transform: 'translateX(' + XS + 'px)'}, {transform: 'translateX(' + (XS + D) + 'px)'}], dep);
    whs.forEach(function(w){ A(w, [{transform: 'rotate(' + ((XS - X0) * ROT).toFixed(0) + 'deg)'}, {transform: 'rotate(' + ((XS - X0 + D) * ROT).toFixed(0) + 'deg)'}], dep);
      /* la rotation d'arrivée est déjà acquise (fill both) ; le relais est exact car les deux phases se suivent sans chevauchement */ });
    A(bob, [{transform: 'rotate(0deg)'}, {transform: 'rotate(-1.8deg)', offset: .12}, {transform: 'rotate(0deg)', offset: .3}, {transform: 'rotate(0deg)'}], {delay: T1 + 50, duration: DUR, easing: EASE_IO, fill: 'forwards'});
    A(q('.sp-beam'), [{opacity: 0}, {opacity: .8}], {delay: T1 + 20, duration: 260});
    // feux stop au freinage, petite fumée au démarrage, traits de vitesse pendant la traversée
    A(q('.sp-brake'), [{opacity: 0}, {opacity: 0, offset: .55}, {opacity: .45}, {opacity: .45}], {delay: 100, duration: T1 - 100});
    A(q('.sp-brake'), [{opacity: .45}, {opacity: 0}], {delay: T1, duration: 200, fill: 'forwards'});
    qa('.sp-puff').forEach(function(c, i){ A(c, [{opacity: 0, transform: 'translate(0,0) scale(.6)'}, {opacity: .9, offset: .2}, {opacity: 0, transform: 'translate(' + (-22 - i * 10) + 'px,' + (-6 - i * 5) + 'px) scale(' + (1.6 + i * .4) + ')'}], {delay: T1 + i * 90, duration: 700, easing: 'ease-out'}); });
    A(q('.sp-speed'), [{opacity: 0}, {opacity: 0, offset: .15}, {opacity: .9, offset: .35}, {opacity: .9, offset: .85}, {opacity: 0}], {delay: T1 + 50, duration: DUR, fill: 'forwards'});
    var f0 = 110 - 30;                                          // rideau : bord (milieu du dégradé) = avant de la voiture - 30
    var eb = Math.min(.95, (1320 - f0 + 0) / D);
    A(q('.sp-curtain'), [{transform: 'translateX(-70px)', offset: 0}, {transform: 'translateX(' + Math.round(D * .1 + f0) + 'px)', offset: .1}, {transform: 'translateX(1320px)', offset: Math.min(.95, (1320 - f0) / D)}, {transform: 'translateX(1320px)', offset: 1}], dep);
    // 4) la scène s'efface, la route devient la barre de chargement
    A(q('.sp-ground'), [{opacity: 1}, {opacity: 0}], {delay: TE - 150, duration: 320, easing: 'linear', fill: 'forwards'});
    A(q('.sp-tl'), [{opacity: 1}, {opacity: 0}], {delay: TE - 150, duration: 320, easing: 'linear', fill: 'forwards'});
    A(q('.sp-road'), [{opacity: 0}, {opacity: 1}], {delay: TE + 50, duration: 300});
    A(q('.sp-msg'), [{opacity: 0}, {opacity: 1}], {delay: TE + 50, duration: 300});
    SW = SWT; EXIT = SWT + 400; endAt = T0 + EXIT;
    var master = A(stage, [{opacity: 1}, {opacity: 1}], {duration: SWT});
    master.onfinish = function(){ played = false; if (skip) skip.hidden = true; };   // l'état final reste porté par les animations (fill) : aucun saut visuel
  } catch(err){ played = false; try { finalize(); } catch(e){} endAt = T0 + 600; }
})();
