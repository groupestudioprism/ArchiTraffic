/* intro ARCHITRAFIC : le rouleau compresseur pose la route du symbole (révélation par masques synchronisée sur son offset-path), puis ligne centrale, rayures, cône et nom.
   Web Animations API : déterministe et « seekable ». Une fois par session (sessionStorage), ?intro=1 pour rejouer. Exposé : window.__spHide() (demande de fermeture, le splash reste jusqu'à la fin de la scène). */
(function(){
  var sp = document.getElementById('splash'); if (!sp) return;
  var T0 = performance.now(), SW = 2500, EXIT = 2950, FADE = 450, KEY = 'prism-intro-architrafic';
  var EASE_IN = 'cubic-bezier(.22,.8,.2,1)', EASE_IO = 'cubic-bezier(.65,0,.35,1)', EASE_M = 'cubic-bezier(.4,0,.2,1)';
  var stage = sp.querySelector('.sp-stage'), cam = sp.querySelector('.sp-cam'), skip = sp.querySelector('.sp-skip');
  var anims = [], endAt = T0 + EXIT, hiding = false, closed = false, hideT = 0, played = false;
  function q(s){ return sp.querySelector(s); }
  function qa(s){ return [].slice.call(sp.querySelectorAll(s)); }
  function fit(){ try { stage.style.setProperty('--k', (stage.offsetWidth / 1200).toFixed(5)); } catch(e){} }
  function A(el, kf, o){ if (!el) return null; o.fill = 'both'; var a = el.animate(kf, o); anims.push(a); return a; }
  function cancelAll(){ anims.forEach(function(a){ try { a.cancel(); } catch(e){} }); anims = []; }
  function finalize(){ // état final = écran de chargement stable (logo officiel, barre, message)
    cancelAll(); sp.classList.remove('sp-play'); sp.classList.add('sp-static', 'sp-on'); if (skip) skip.hidden = true;
  }
  function close(){
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', fit);
    sp.classList.add('done');
    try { if (sp.contains(document.activeElement)) document.activeElement.blur(); } catch(e){}
    setTimeout(function(){ cancelAll(); sp.remove(); }, FADE + 100);
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
    var NS = 'http://www.w3.org/2000/svg', k = stage.offsetWidth / 1200;
    // longueurs (unités du logo) : trajet complet et début / fin de la route sur la courbe
    var drive = q('.sp-sw1').getAttribute('d'), segs = drive.split(' C'), tmp = document.createElementNS(NS, 'path'), svg = q('.sp-sym');
    svg.appendChild(tmp);
    function len(n){ tmp.setAttribute('d', segs.slice(0, n).map(function(s, i){ return i ? 'C' + s : s; }).join(' ')); return tmp.getTotalLength(); }
    var L = len(segs.length), roadA = len(4) / L, roadB = len(12) / L; svg.removeChild(tmp);
    // cadre de caméra : le symbole d'abord en gros plan, puis recul sur le logo complet
    var vw = innerWidth, vh = innerHeight, tgt = Math.min(vw * .78, vh * .6, 560), Z = Math.max(1.2, Math.min(3.4, tgt / (415 * k)));
    var camFrom = 'translate(385px,0) scale(' + Z.toFixed(3) + ')';
    sp.classList.add('sp-play', 'sp-on'); if (skip){ skip.hidden = false; skip.addEventListener('click', doSkip); }
    document.addEventListener('keydown', onKey, true);
    played = true;
    var DV = 450, DT = 1500; // départ et durée du passage de l'engin
    A(q('.sp-grid'), [{opacity: 0}, {opacity: 1}], {duration: 600, easing: EASE_IN});
    A(cam, [{transform: camFrom}, {transform: camFrom, offset: 0.56}, {transform: 'translate(0,0) scale(1)'}], {duration: 2450, easing: EASE_IO});
    A(q('.sp-L1'), [{opacity: 0}, {opacity: 1}], {delay: 100, duration: 600, easing: EASE_IN});
    [['.sp-w1', 200, 700], ['.sp-w2', 400, 600]].forEach(function(w){
      A(q(w[0]), [{strokeDasharray: '1 1', strokeDashoffset: 1}, {strokeDasharray: '1 1', strokeDashoffset: 0}], {delay: w[1], duration: w[2], easing: EASE_IO});
    });
    A(q('.sp-w3'), [{opacity: 0}, {opacity: 1}], {delay: 700, duration: 400});
    A(q('.sp-wire'), [{opacity: 1}, {opacity: 1, offset: .55}, {opacity: 0}], {delay: 0, duration: 2000, easing: 'linear'});
    // l'engin et les révélations partagent la même durée et la même courbe : la route apparaît exactement sous lui
    var sw = {delay: DV, duration: DT, easing: EASE_M};
    q('.sp-sw1').style.strokeDasharray = L + ' ' + L * 2; q('.sp-sw2').style.strokeDasharray = L + ' ' + L * 2;
    A(q('.sp-sw1'), [{strokeDashoffset: L}, {strokeDashoffset: 0}], {delay: DV + 60, duration: DT, easing: EASE_M});
    A(q('.sp-sw2'), [{strokeDashoffset: L}, {strokeDashoffset: 0}], {delay: DV + 230, duration: DT, easing: EASE_M});
    var mach = q('.sp-mach'); mach.style.offsetPath = "path('" + drive + "')";
    A(mach, [{offsetDistance: '0%'}, {offsetDistance: '100%'}], sw);
    A(mach, [{opacity: 0}, {opacity: 1, offset: .07}, {opacity: 1, offset: .9}, {opacity: 0}], sw);
    A(q('.sp-mi'), [{transform: 'scale(1.3)'}, {transform: 'scale(1.3)', offset: roadA}, {transform: 'scale(.8)', offset: roadB}, {transform: 'scale(.72)'}], sw);
    qa('.sp-dr').forEach(function(d, i){ var r = i ? 15 : 13; A(d, [{transform: 'rotate(0deg)'}, {transform: 'rotate(' + (L / r * 180 / Math.PI).toFixed(1) + 'deg)'}], sw); });
    // rayures orange de la jambe droite, de haut en bas
    q('.sp-sw3').style.strokeDasharray = '232 500';
    A(q('.sp-sw3'), [{strokeDashoffset: 232}, {strokeDashoffset: 0}], {delay: 1700, duration: 480, easing: EASE_IO});
    // nom : s'écrit de gauche à droite, le cône tombe à sa place dans le mot
    A(q('.sp-wordwrap'), [{clipPath: 'inset(0 64% 0 0)'}, {clipPath: 'inset(0 0% 0 0)'}], {delay: 1850, duration: 500, easing: EASE_IO});
    A(q('.sp-cur'), [{opacity: 1, transform: 'translateX(426px)'}, {opacity: 1, transform: 'translateX(1190px)', offset: .94}, {opacity: 0, transform: 'translateX(1192px)'}], {delay: 1850, duration: 500, easing: EASE_IO});
    A(q('.sp-cone'), [{opacity: 0, transform: 'translateY(-70px)'}, {opacity: 1, transform: 'translateY(0)', offset: .5, easing: EASE_IN}, {transform: 'translateY(-7px)', offset: .7}, {transform: 'translateY(0)', offset: .88}, {transform: 'translateY(0)'}], {delay: 1900, duration: 480, easing: 'linear'});
    A(q('.sp-tag'), [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'none'}], {delay: 2050, duration: 380, easing: EASE_IN});
    A(q('.sp-road'), [{opacity: 0}, {opacity: 1}], {delay: 2200, duration: 300});
    A(q('.sp-msg'), [{opacity: 0}, {opacity: 1}], {delay: 2200, duration: 300});
    // relais : à SW ms l'empilement de calques est remplacé, à l'image près, par l'image officielle intacte
    var D2 = SW + 1, off = SW / D2;
    A(q('.sp-layers'), [{opacity: 1}, {opacity: 1, offset: off}, {opacity: 0}], {duration: D2, easing: 'linear'});
    A(q('.sp-final'), [{opacity: 0}, {opacity: 0, offset: (SW - 140) / D2}, {opacity: 1, offset: off}, {opacity: 1}], {duration: D2, easing: 'linear'});
    var master = A(stage, [{opacity: 1}, {opacity: 1}], {duration: SW});
    master.onfinish = function(){ played = false; if (skip) skip.hidden = true; };   // l'état final reste porté par les animations (fill) : aucun saut visuel
  } catch(err){ played = false; try { finalize(); } catch(e){} endAt = T0 + 600; }
})();
