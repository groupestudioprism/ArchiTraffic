import json, pathlib, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
THREE, FIX, OUT = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), pathlib.Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
code = pathlib.Path(sys.argv[4]).read_text()
fx = json.loads(FIX.read_text())
def route(r):
    u = r.request.url
    if 'cdn.jsdelivr.net/npm/three@0.160.0/' in u:
        p = THREE / u.split('three@0.160.0/')[1]
        return r.fulfill(path=str(p), content_type='application/javascript') if p.exists() else r.abort()
    if '/assets/' in u and u.startswith('file'): return r.fulfill(path=str(ROOT / 'assets' / u.split('/assets/')[1]))
    if u.startswith('http://127.0.0.1') or u.startswith('file:') or u.startswith('data:') or u.startswith('blob:'): return r.continue_()
    return r.abort()
import http.server, threading, functools, socketserver
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8'}
srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Q, directory=str(ROOT))); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1440, 'height': 900})
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning', 'log') and 'ERR_FAILED' not in m.text and 'GL Driver' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    pg.route('**/*', route)
    pg.goto(f'http://127.0.0.1:{PORT}/dist/architrafic-demo.html')
    try: pg.wait_for_function('window.__apReady === true', timeout=30000)
    except Exception: print('\n'.join(errs[:20])); raise
    time.sleep(3.3)
    pg.evaluate("""() => { document.getElementById('auth').hidden = true; document.getElementById('app').inert = false; document.getElementById('home').hidden = true; }""")
    pg.evaluate("""async fx => { const st = window.ATDebug.state(); st.site = {label:'Ville test', lat:48, lon:2, size:500}; await window.ATDebug.setWorldRaw(fx, st.site); }""", fx)
    exec(code)
    b.close()
print('\n'.join(errs[:40]) or 'aucune erreur console')
