#!/usr/bin/env python3
"""Arma las páginas de docs/ a partir de src/.

- src/partials/head.html, header.html, footer.html: comunes a todas las páginas
- src/pages/*.html: cada página empieza con unas líneas clave: valor y luego ---
    title: ...        título de la pestaña
    desc: ...         meta description
    nav: proyectos    enlace activo del menú (opcional)
    class: ...        clase extra para <body> (opcional)

Uso: python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
VERSION = __import__('time').strftime('%Y%m%d%H%M')
SRC, OUT = ROOT / 'src', ROOT / 'docs'
partials = {p.stem: p.read_text() for p in (SRC / 'partials').glob('*.html')}


def render(tpl, ctx):
    return re.sub(r'\{\{(\w+)\}\}', lambda m: ctx.get(m.group(1), ''), tpl)


for page in sorted((SRC / 'pages').glob('*.html')):
    meta, body = page.read_text().split('\n---\n', 1)
    ctx = {'nav': '', 'class': ''}
    for line in meta.splitlines():
        k, _, v = line.partition(':')
        ctx[k.strip()] = v.strip()
    # marca el enlace activo del menú
    header = re.sub(r'(<a href="%s\.html")' % re.escape(ctx['nav'] or '~'),
                    r'\1 aria-current="page"', partials['header'])
    html = render(partials['head'], ctx) + header + body + partials['footer']
    # versión en los recursos para que el navegador no use una copia vieja
    html = re.sub(r'(href|src)="((?:styles|yarn|main|paleta)\.(?:css|js))"', r'\1="\2?v=%s"' % VERSION, html)
    (OUT / page.name).write_text(html)
    print('→', page.name)
