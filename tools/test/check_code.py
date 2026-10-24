#!/usr/bin/env python3
"""Contrôles de structure du moteur ARCHITRAFIC (src/engine/*.js, assemblés en un seul module) :
  1. aucune fonction ni variable de premier niveau définie deux fois (une seconde « function x » écrase la première sans erreur) ;
  2. le module assemblé est du JavaScript valide (node --check) ;
  3. les scripts de compte (auth.js + cloud.js + auth-end.js) forment un script valide.
Code de sortie 1 en cas de problème."""
import pathlib, re, subprocess, sys, tempfile
ROOT = pathlib.Path(__file__).resolve().parents[2]; S = ROOT / 'src'
DECL = re.compile(r'^(?:async\s+)?(?:function\s*\*?\s*([A-Za-z_$][\w$]*)|(?:const|let|var|class)\s+([A-Za-z_$][\w$]*))', re.M)
seen, bad = {}, 0
for f in sorted((S / 'engine').glob('*.js')):
    for m in DECL.finditer(f.read_text(encoding='utf-8')):
        n = m.group(1) or m.group(2)
        if n in seen and seen[n] != f.name: print(f'✗ « {n} » défini dans {seen[n]} et {f.name}'); bad += 1
        elif n in seen: print(f'✗ « {n} » défini deux fois dans {f.name}'); bad += 1
        else: seen[n] = f.name
print(f'{len(seen)} déclarations de premier niveau, {bad} doublon(s)')
def node_check(code, ext):
    with tempfile.NamedTemporaryFile('w', suffix=ext, delete=False, encoding='utf-8') as t: t.write(code); p = t.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True); return r.returncode == 0, (r.stderr or '').strip().split('\n')[:6]
engine = ''.join(f.read_text(encoding='utf-8') + '\n' for f in sorted((S / 'engine').glob('*.js')))
ok, err = node_check(engine, '.mjs'); print('✓ moteur : syntaxe valide' if ok else '✗ moteur : ' + ' | '.join(err)); bad += not ok
acct = ''.join((S / 'js' / n).read_text(encoding='utf-8') for n in ('auth.js', 'cloud.js', 'auth-end.js'))
ok, err = node_check(acct, '.js'); print('✓ compte et cloud : syntaxe valide' if ok else '✗ compte et cloud : ' + ' | '.join(err)); bad += not ok
sys.exit(1 if bad else 0)
