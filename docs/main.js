/* =========================================================
   nudo — comportamiento de las páginas
   (el hilo vive en yarn.js)
   ========================================================= */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------- hilo ---------------- */
  const yarn = Yarn.init();
  window.nudo = { yarn };

  /* ---------------- header + menú ---------------- */
  const header = document.querySelector('.site-header');
  addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 30), { passive: true });
  header.classList.toggle('scrolled', scrollY > 30);

  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    menuBtn.querySelector('.menu-btn-label').textContent = open ? 'cerrar' : 'menú';
    if (yarn.icon) yarn.icon.set(open);
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ---------------- aparecer al hacer scroll ---------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

  /* ---------------- tarjetas de proyecto ---------------- */
  document.querySelectorAll('.card').forEach(card => {
    const media = card.querySelector('.card-media');
    if (!media || !canHover || reduced) return;
    media.addEventListener('pointermove', e => {
      const r = media.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      media.style.setProperty('--ry', `${(nx * 6).toFixed(2)}deg`);
      media.style.setProperty('--rx', `${(-ny * 6).toFixed(2)}deg`);
    });
    media.addEventListener('pointerleave', () => {
      media.style.setProperty('--rx', '0deg'); media.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------------- bloques de proyecto ----------------
     .b-row: fila de imágenes con la misma altura; cada figura crece según su
     proporción, así conviven verticales, cuadradas y panorámicas. */
  function setRatio(img) {
    const fig = img.closest('figure');
    if (fig && img.naturalWidth) fig.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(3));
  }
  document.querySelectorAll('.b-row img').forEach(img => { img.complete ? setRatio(img) : img.addEventListener('load', () => setRatio(img)); });

  // videos: solo se reproducen en pantalla
  document.querySelectorAll('video[autoplay]').forEach(v => {
    if (reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
    new IntersectionObserver(([e]) => { e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }).observe(v);
  });

  /* ---------------- visor de imágenes ----------------
     Cualquier imagen dentro de .blocks o [data-zoom] se abre ampliada;
     las flechas (o deslizar en móvil) recorren las imágenes de la misma página. */
  const lb = document.getElementById('lightbox');
  const fig = lb.querySelector('.lb-fig');
  const count = lb.querySelector('.lb-count');
  const zoomables = [...document.querySelectorAll('.blocks img, [data-zoom] img')];
  let idx = 0;
  function show(i) {
    idx = (i + zoomables.length) % zoomables.length;
    const img = zoomables[idx];
    fig.innerHTML = `<img src="${img.currentSrc || img.src}" alt="${img.alt || ''}">` + (img.alt ? `<figcaption>${img.alt}</figcaption>` : '');
    count.textContent = `${idx + 1} / ${zoomables.length}`;
  }
  zoomables.forEach((img, i) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => { show(i); lb.showModal(); document.documentElement.style.overflow = 'hidden'; });
  });
  lb.querySelector('.lb-prev').addEventListener('click', () => show(idx - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(idx + 1));
  lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); });
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.querySelector('.lb-foot').hidden = zoomables.length < 2;
  let sx = null;
  fig.addEventListener('touchstart', e => { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  fig.addEventListener('touchend', e => {
    if (sx == null || zoomables.length < 2) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
  });
  lb.addEventListener('close', () => { document.documentElement.style.overflow = ''; });

  /* ---------------- contacto ---------------- */
  const toast = document.querySelector('.toast');
  let toastTimer;
  function say(msg) {
    toast.textContent = msg; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 2200);
  }
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say('correo copiado'); }
    catch { say(b.dataset.copy); }
  }));

  /* ---------------- círculos de palabras (sobre nudo) ---------------- */
  const RINGS = [
    { r: 222, color: 'var(--vino)', dir: 1, speed: 2.6, words: ['editorial', 'encuadernación', 'montaje', 'taller', 'plegado', 'publicación', 'laboratorio', 'experimentación', 'articulado', 'expandido'] },
    { r: 302, color: 'var(--verde)', dir: -1, speed: 1.9, words: ['tejer', 'ensamblar', 'materializar', 'pliegue', 'objeto', 'sensibilidad', 'expansión', 'experimentar', 'cuestionar', 'latencia', 'intersección'] },
    { r: 380, color: 'var(--lila)', dir: 1, speed: 1.4, words: ['diseño', 'escritura', 'composición', 'publicación', 'investigar', 'observar', 'trama', 'lenguaje', 'materialidad', 'intervenir', 'curaduría', 'crear', 'observar', 'archivo', 'papel'] },
    { r: 456, color: 'var(--naranja)', dir: -1, speed: 1.0, words: ['collage', 'libro', 'objeto', 'publicación', 'detalle', 'oficio', 'creatividad', 'concepto', 'intención', 'comunidad', 'intervenir', 'tipografía', 'ilustración', 'edición', 'papel', 'misceláneo', 'orgánico'] },
  ];
  const svg = document.getElementById('palabras');
  if (svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
    const defs = mk('defs', {}, svg);
    const groups = RINGS.map((ring, ri) => {
      const id = `ring-path-${ri}`, r = ring.r;
      mk('path', { id, d: `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r}` }, defs);
      const g = mk('g', { class: 'ring' }, svg);
      const total = ring.words.reduce((s, w) => s + w.length, 0);
      const gap = (2 * Math.PI * r / 10.5 - total) / ring.words.length;
      let acc = 0;
      ring.words.forEach(word => {
        const center = acc + gap / 2 + word.length / 2; acc += word.length + gap;
        const text = mk('text', { fill: ring.color, class: 'w' }, g);
        const tp = mk('textPath', { href: `#${id}`, startOffset: `${(center / (total + gap * ring.words.length) * 100).toFixed(2)}%`, 'text-anchor': 'middle' }, text);
        tp.textContent = word;
      });
      return { g, angle: ri * 17, ...ring };
    });
    const c = mk('g', {}, svg);
    mk('use', { href: '#ast', x: -12, y: -62, width: 24, height: 24, style: 'color: var(--lila)' }, c);
    const t = mk('text', { 'text-anchor': 'middle', y: 8, fill: 'var(--naranja)', style: 'font-size: 24px' }, c);
    t.textContent = 'creación';
    mk('use', { href: '#ast', x: -12, y: 34, width: 24, height: 24, style: 'color: var(--lila)' }, c);

    let hover = 0, hoverT = 0, lastY = scrollY, sv = 0;
    svg.addEventListener('pointerenter', () => hoverT = 1);
    svg.addEventListener('pointerleave', () => hoverT = 0);
    const spin = dt => {
      sv += ((scrollY - lastY) / Math.max(dt, 0.001) - sv) * 0.15; lastY = scrollY;
      hover += (hoverT - hover) * 0.05;
      const boost = 1 + hover * 2.2 + Math.min(Math.abs(sv) * 0.004, 6);
      for (const r of groups) { r.angle += r.dir * r.speed * boost * dt; r.g.setAttribute('transform', `rotate(${r.angle.toFixed(3)})`); }
    };
    if (reduced) groups.forEach(r => r.g.setAttribute('transform', `rotate(${r.angle})`));
    else Yarn.tickers.add(spin);
  }
})();
