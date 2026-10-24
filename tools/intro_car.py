#!/usr/bin/env python3
# Génère la voiture de l'intro (src/parts/body.html) à partir de cotes réelles. Usage : python3 tools/intro_car.py sortie.svgpart
# Citadine 3 portes dessinée à partir de cotes réelles (mètres) : longueur 4,20, hauteur 1,46, empattement 2,60, roues Ø 0,64
K = 180 / 4.2
def P(x, y): return (6 + x * K, 2 - y * K)
def f(v): return f'{v:.1f}'
def cr(pts, closed=False):
    """chemin lisse (Catmull-Rom -> Bézier) passant par les points (en mètres)"""
    q = [P(*p) for p in pts]; n = len(q); d = f'M{f(q[0][0])},{f(q[0][1])}'
    for i in range(n - 1 + closed):
        p0, p1, p2, p3 = q[(i - 1) % n if closed or i else 0], q[i % n], q[(i + 1) % n], q[(i + 2) % n if closed or i + 2 < n else n - 1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6); c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}'
    return d
def L(*pts): return ' '.join(('M' if i == 0 else 'L') + f'{f(P(*p)[0])},{f(P(*p)[1])}' for i, p in enumerate(pts))
R = 0.32; WR, WF = 0.78, 3.38; AR = 0.37; SILL = 0.20
# silhouette haute (de l'avant bas vers l'arrière), lisse
top = [(4.17, 0.30), (4.20, 0.50), (4.17, 0.64), (4.02, 0.74), (3.70, 0.82), (3.30, 0.90), (3.02, 0.97), (2.70, 1.17), (2.38, 1.38), (2.05, 1.45), (1.50, 1.46), (0.95, 1.43), (0.50, 1.36), (0.22, 1.22), (0.08, 1.02), (0.03, 0.80), (0.02, 0.50), (0.05, 0.30)]
body = cr(top)
x1, y1 = P(0.05, 0.30); xa, ya = P(WR - AR, SILL); xb, _ = P(WR + AR, SILL); xc, _ = P(WF - AR, SILL); xd, _ = P(WF + AR, SILL); xe, ye = P(4.12, SILL + 0.02)
ar = AR * K
body += f' C{f(x1)},{f(ya)} {f(x1+4)},{f(ya)} {f(xa)},{f(ya)} A{f(ar)},{f(ar)} 0 0 1 {f(xb)},{f(ya)} L{f(xc)},{f(ya)} A{f(ar)},{f(ar)} 0 0 1 {f(xd)},{f(ya)} L{f(xe)},{f(ye)} C{f(xe+3)},{f(ye)} {f(P(4.17,0.30)[0])},{f(P(4.17,0.30)[1]+3)} {f(P(4.17,0.30)[0])},{f(P(4.17,0.30)[1])} Z'
# vitres (DLO) : vitre de portière + custode arrière, séparées par le montant B
dlo_front = L((2.90, 1.01), (2.40, 1.33)) + ' ' + cr([(2.40, 1.33), (2.28, 1.375), (2.05, 1.39), (1.86, 1.39)])[cr([(2.40, 1.33), (2.28, 1.375), (2.05, 1.39), (1.86, 1.39)]).index(' C'):] + ' ' + L((1.86, 1.39), (1.86, 1.01)).replace('M', 'L', 1) + ' Z'
_t = cr([(1.76, 1.39), (1.30, 1.40), (0.90, 1.375), (0.62, 1.31), (0.50, 1.19)]); dlo_rear = L((1.76, 1.02), (1.76, 1.39)) + _t[_t.index(' C'):] + ' ' + L((0.50, 1.19), (0.58, 1.035)).replace('M', 'L', 1) + ' Z'
belt = cr([(3.0, 0.985), (2.0, 1.0), (1.0, 1.02), (0.25, 1.04)])
door = cr([(3.02, 0.97), (3.04, 0.60), (3.02, 0.28), (2.98, 0.22)]) + ' ' + cr([(1.84, 1.0), (1.80, 0.60), (1.82, 0.28), (1.86, 0.22)])
crease = cr([(4.05, 0.66), (3.2, 0.70), (2.0, 0.72), (0.8, 0.76), (0.12, 0.80)])
hl = cr([(3.66, 0.80), (3.92, 0.755), (4.12, 0.69), (4.15, 0.645), (3.98, 0.68), (3.72, 0.74)]) + ' Z'
tl = L((0.10, 1.16), (0.19, 1.15), (0.22, 1.02), (0.20, 0.88), (0.04, 0.86), (0.05, 1.02)) + ' Z'
mir = cr([(2.86, 1.00), (2.92, 1.10), (3.02, 1.10), (3.04, 1.02), (2.95, 0.98)]) + ' Z'
handle = L((2.10, 0.86), (2.28, 0.86))
bump_f = cr([(4.18, 0.42), (3.95, 0.40), (3.78, 0.36)]); bump_r = cr([(0.02, 0.46), (0.20, 0.46), (0.36, 0.44)])
sill = L((WR + AR + 0.02, 0.245), (WF - AR - 0.02, 0.245))
fog = P(4.06, 0.33)
def wheel(x):
    cx, cy = P(x, R); sp = ''.join(f'<path d="M-1.6,-3 L-2.2,-10.4 L2.2,-10.4 L1.6,-3 Z" fill="#C3CCD7" transform="rotate({k*72})"/>' for k in range(5))
    return (f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(R*K+1.6)}" fill="#0B1E36"/>'
            f'<g transform="translate({f(cx)},{f(cy)})"><g class="sp-wh"><circle r="{f(R*K)}" fill="#16191F"/><circle r="{f(R*K-1.2)}" fill="none" stroke="#2C323C" stroke-width="1.4"/>'
            f'<circle r="11" fill="#2F3641"/>{sp}<circle r="11" fill="none" stroke="#E2E7EE" stroke-width="1.2"/><circle r="3" fill="#E2E7EE"/><circle r="1.3" fill="#56606E"/><circle cy="-12.4" r="1" fill="#F28A1A"/></g></g>')
svg = f'''          <ellipse cx="96" cy="2.6" rx="90" ry="3.4" fill="#000" opacity=".2"/>
          <!-- citadine 3 portes, avant à droite : dessinée d'après des cotes réelles (L 4,20 m, H 1,46 m, empattement 2,60 m, roues Ø 0,64 m) -->
          <defs><linearGradient id="spCs" x1="0" y1="-62" x2="0" y2="-6" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4A95E8"/><stop offset=".42" stop-color="#2069C4"/><stop offset=".7" stop-color="#11519E"/><stop offset="1" stop-color="#0A3B7A"/></linearGradient>
            <linearGradient id="spGl" x1="0" y1="-60" x2="0" y2="-40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1E2733"/><stop offset="1" stop-color="#4B5869"/></linearGradient></defs>
          <path d="{body}" fill="url(#spCs)"/>
          <path d="{dlo_front}" fill="url(#spGl)"/><path d="{dlo_rear}" fill="url(#spGl)"/>
          <path d="{cr([(2.62, 1.06), (2.25, 1.33)])}" stroke="#fff" stroke-width="2.2" opacity=".16" stroke-linecap="round"/><path d="{cr([(1.55, 1.06), (1.30, 1.34)])}" stroke="#fff" stroke-width="2.2" opacity=".14" stroke-linecap="round"/>
          <path d="{belt}" stroke="#0A3672" stroke-width=".9" fill="none" opacity=".6"/>
          <path d="{crease}" stroke="#8BC0F5" stroke-width="1.1" fill="none" opacity=".55"/>
          <path d="{door}" stroke="#0A3672" stroke-width=".9" fill="none" opacity=".6"/>
          <path d="{bump_f}" stroke="#0A3672" stroke-width=".8" fill="none" opacity=".5"/><path d="{bump_r}" stroke="#0A3672" stroke-width=".8" fill="none" opacity=".5"/>
          <path d="{sill}" stroke="#082C5A" stroke-width="2.2" opacity=".55"/>
          <path d="{handle}" stroke="#0A3672" stroke-width="2" stroke-linecap="round" opacity=".7"/>
          <path d="{mir}" fill="#11519E"/>
          <path d="{hl}" fill="#EEF2F7"/><path d="{cr([(3.74, 0.765), (3.95, 0.725), (4.10, 0.675)])}" stroke="#FFE08A" stroke-width="1" fill="none"/>
          <path class="sp-beam" d="M{f(P(4.15,0.70)[0])},{f(P(4.15,0.70)[1])} L270,-52 L270,-8 Z" fill="url(#spBeam)" opacity="0"/>
          <path d="{tl}" fill="#D9232B"/><circle class="sp-brake" cx="{f(P(0.14,0.98)[0])}" cy="{f(P(0.14,0.98)[1])}" r="10" fill="#FF3B30" opacity="0"/>
          <circle cx="{f(fog[0])}" cy="{f(fog[1])}" r="1.4" fill="#E2E7EE" opacity=".8"/>
          {wheel(WR)}
          {wheel(WF)}
'''
import sys; open(sys.argv[1], 'w').write(svg)
