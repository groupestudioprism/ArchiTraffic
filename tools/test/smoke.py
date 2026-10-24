#!/usr/bin/env python3
"""Test automatique du parcours principal (hors ligne, Chromium + WebGL logiciel).
Vérifie : chargement, route barrée → déviations et panneaux, plans exportés, dossier d'arrêté, aucune erreur JavaScript.
Usage : python3 tools/test/smoke.py <three_dir> <fixture.json> <out_dir>   (code de sortie 1 si un contrôle échoue)"""
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
THREE, FIX, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
fx = json.loads(FIX.read_text()); errs, fails = [], []
def check(ok, what):
    print(('OK   ' if ok else 'ÉCHEC') + ' ' + what)
    if not ok: fails.append(what)
def route(r):
    u = r.request.url
    if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
        p = THREE / u.split('three@0.160.0/')[1]
        return r.fulfill(path=str(p), content_type='application/javascript') if p.exists() else r.abort()
    if '/assets/' in u and u.startswith('file'):
        p = ROOT / 'assets' / u.split('/assets/')[1]
        return r.fulfill(path=str(p)) if p.exists() else r.abort()
    if u.startswith(('file:', 'data:', 'blob:')): return r.continue_()
    return r.abort()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/*', route)
    pg.goto((ROOT / 'dist' / 'architrafic-demo.html').as_uri())
    pg.wait_for_function('window.__apReady === true', timeout=60000); check(True, 'moteur chargé')
    pg.wait_for_timeout(3000)
    check(not pg.query_selector('.tour'), 'pas de tutoriel avant la connexion')
    pg.evaluate("() => { localStorage.setItem('at.tour','1'); localStorage.setItem('at.tourHome','1'); document.getElementById('auth').hidden = true; const a = document.getElementById('app'); a.inert = false; document.getElementById('home').hidden = true; }")
    pg.evaluate("async fx => { const st = window.ATDebug.state(); st.site = {label:'Ville test', lat:48, lon:2, size:500}; await window.ATDebug.setWorldRaw(fx, st.site); }", fx); pg.wait_for_timeout(1500)
    pg.evaluate("() => { const D = window.ATDebug; D.makeClosure(D.nearestRoad([40, 80], 10)); }"); pg.wait_for_timeout(1500)
    els = pg.evaluate("() => window.ATDebug.state().els.map(e => e.t)")
    check('closure' in els, 'route barrée créée'); check('detour' in els, 'déviation calculée'); check(els.count('obj') >= 4, 'panneaux posés automatiquement')
    check(pg.evaluate("() => window.ATDebug.signPng('AK5').length > 1000"), 'face de panneau rendue')
    dl = []; pg.on('download', lambda d: dl.append(d))
    pg.evaluate("() => document.querySelector('#exportMenu [data-act=png]').click()")
    for _ in range(60):
        pg.wait_for_timeout(1000)
        if dl: break
    check(len(dl) == 1, 'plan d\'ensemble exporté')
    if dl: dl[0].save_as(str(OUT / 'plan.png'))
    with pg.context.expect_page(timeout=120000) as np:
        pg.evaluate("() => document.querySelector('#exportMenu [data-act=dossier]').click()")
    d = np.value; d.wait_for_load_state(); d.wait_for_timeout(1500)
    check('ARRÊTÉ' in d.content().upper(), 'dossier d\'arrêté généré')
    check(not pg.query_selector('#guide[hidden]'), 'assistant affiché')
    inf = pg.evaluate("() => window.APModel.info()"); check('"sg"' in inf and len(inf) < 800, 'résumé du chantier pour le tableau de bord')
    b.close()
check(not errs, 'aucune erreur JavaScript' + ('' if not errs else ' : ' + ' | '.join(errs[:3])))
sys.exit(1 if fails else 0)
