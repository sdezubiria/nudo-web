/* =========================================================
   yarn.js — sistema de hilo de nudo

   La idea: el hilo nunca "rebota" ni se estira; se DIBUJA. Todo lo que
   es hilo en la página se genera desde una misma línea, con el mismo
   trazo (una base y las hebras torcidas encima) y la misma animación:
   la longitud dibujada crece como si alguien fuera soltando el hilo.

   Piezas:
   - Yarn.logo(el)       el logo (foto real de hilo) se revela a lo largo
                         de su trazado, letra por letra, con una máscara SVG.
   - Yarn.thread()       un solo hilo recorre la página: nace en la cola de
                         la «o» del logo, baja por el margen, hace un nudo en
                         cada etiqueta de sección y en los pasos del proceso,
                         y termina dibujando el logo del pie. Se dibuja con el
                         scroll.
   - Yarn.underline(el)  un hilo corto que se dibuja bajo un elemento al
                         pasar el cursor y se recoge al salir.
   - Yarn.loop()         la geometría de un nudo (una trocoide: el bucle que
                         hace un hilo cuando avanza y gira sobre sí mismo),
                         continua con el resto de la línea.

   Marcado:
   - [data-knot]          el hilo hace un nudo alrededor del elemento
   - [data-yarn-underline] subrayado de hilo al pasar el cursor; si tiene un
                          ancestro [data-yarn-host], ese es el que escucha el hover
   - [data-logo="hero|footer"] logo revelado como hilo
   ========================================================= */
window.Yarn = (() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const DPR = () => Math.min(devicePixelRatio || 1, 2);

  // Trazo: base en vino y hebras claras cruzadas en diagonal (la torsión del hilo).
  // Los colores salen de las variables CSS, así cambian con la paleta.
  const STYLE = { color: '#701d3b', ply: 'rgba(255, 218, 218, .72)', width: 3, plyGap: 4.6, plyAngle: 1.05 };
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function rgba(hex, a) {
    const m = hex.replace('#', ''); if (m.length !== 6 && m.length !== 3) return hex;
    const h = m.length === 3 ? [...m].map(c => c + c).join('') : m;
    return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
  }
  function mix(a, b, t) {
    const p = h => { const m = h.replace('#', ''); const x = m.length === 3 ? [...m].map(c => c + c).join('') : m; return [1, 3, 5].map(i => parseInt(x.slice(i - 1, i + 1), 16)); };
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('');
  }
  function refreshStyle() {
    STYLE.color = cssVar('--vino') || STYLE.color;
    // las hebras son el mismo hilo un poco más claro: donde dos tramos se cruzan se ven como textura, no como huecos
    STYLE.ply = rgba(mix(STYLE.color, cssVar('--rosa') || '#ffdada', 0.55), 0.85);
    for (const fn of styleListeners) fn();
  }
  const styleListeners = new Set();
  addEventListener('nudo:theme', refreshStyle);

  /* ---------------- geometría ---------------- */

  // Catmull-Rom → curvas cúbicas → muestras con longitud de arco acumulada
  function sample(pts, step = 3) {
    const S = []; S.marks = [0];
    const push = (x, y) => {
      const p = S[S.length - 1];
      S.push({ x, y, l: p ? p.l + Math.hypot(x - p.x, y - p.y) : 0 });
    };
    if (!pts.length) return S;
    push(pts[0][0], pts[0][1]);
    // Catmull-Rom centrípeta: con tramos de longitudes muy distintas (la salida
    // corta de un nudo seguida de una bajada larga) la versión uniforme se pasa
    // de largo y hace picos; la centrípeta no.
    const dist = (a, b) => Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])) || 1e-3;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const d1 = dist(p0, p1), d2 = dist(p1, p2), d3 = dist(p2, p3);
      const a1 = d1 * d1, a2 = d2 * d2, a3 = d3 * d3;
      const c1x = (a1 * p2[0] - a2 * p0[0] + (2 * a1 + 3 * d1 * d2 + a2) * p1[0]) / (3 * d1 * (d1 + d2));
      const c1y = (a1 * p2[1] - a2 * p0[1] + (2 * a1 + 3 * d1 * d2 + a2) * p1[1]) / (3 * d1 * (d1 + d2));
      const c2x = (a3 * p1[0] - a2 * p3[0] + (2 * a3 + 3 * d3 * d2 + a2) * p2[0]) / (3 * d3 * (d3 + d2));
      const c2y = (a3 * p1[1] - a2 * p3[1] + (2 * a3 + 3 * d3 * d2 + a2) * p2[1]) / (3 * d3 * (d3 + d2));
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.3 / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n, m = 1 - t;
        push(m * m * m * p1[0] + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * p2[0],
             m * m * m * p1[1] + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * p2[1]);
      }
      S.marks.push(S[S.length - 1].l);
    }
    return S;
  }

  // Redondea las esquinas de una ruta: donde la dirección cambia más de minDeg
  // grados, el vértice se sustituye por un arco de radio r (acotado por el
  // largo de los tramos vecinos). Devuelve también un mapa de índices viejos →
  // nuevos, para seguir sabiendo dónde empieza y acaba cada nudo.
  function fillet(pts, r = 56, minDeg = 22) {
    const out = [], map = [];
    for (let i = 0; i < pts.length; i++) {
      const P = pts[i], A = pts[i - 1], B = pts[i + 1];
      map[i] = out.length;
      if (!A || !B) { out.push(P); continue; }
      let d1x = P[0] - A[0], d1y = P[1] - A[1], d2x = B[0] - P[0], d2y = B[1] - P[1];
      const l1 = Math.hypot(d1x, d1y), l2 = Math.hypot(d2x, d2y);
      if (l1 < 1e-6 || l2 < 1e-6) { out.push(P); continue; }
      d1x /= l1; d1y /= l1; d2x /= l2; d2y /= l2;
      const ang = Math.acos(clamp(d1x * d2x + d1y * d2y, -1, 1));
      if (ang < minDeg * Math.PI / 180 || ang > Math.PI - 0.05) { out.push(P); continue; }
      const tanH = Math.tan(ang / 2);
      const rr = Math.min(r, 0.45 * l1 / tanH, 0.45 * l2 / tanH), t = rr * tanH;
      const sgn = Math.sign(d1x * d2y - d1y * d2x) || 1;
      const T1 = [P[0] - d1x * t, P[1] - d1y * t];
      const C = [T1[0] - d1y * sgn * rr, T1[1] + d1x * sgn * rr];   // centro, hacia el interior del giro
      const a0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
      const n = Math.max(2, Math.ceil(ang / (Math.PI / 10)));
      for (let k = 0; k <= n; k++) { const a = a0 + sgn * ang * k / n; out.push([C[0] + rr * Math.cos(a), C[1] + rr * Math.sin(a)]); }
    }
    map[pts.length] = out.length;
    return { pts: out, map };
  }

  // Hace vagar los tramos rectos de una ruta: los subdivide y desplaza los
  // puntos nuevos con un ruido de onda larga (dos senos lentos), que se apaga
  // cerca de los extremos de cada tramo para no mover los nudos ni las esquinas.
  // fixed: índices de puntos que no se tocan (los de los nudos).
  // Los cruces horizontales vagan sobre todo hacia abajo (arriba está el texto
  // de la etiqueta); las bajadas por el margen vagan a los lados, y en pantallas
  // estrechas solo hacia dentro.
  function wander(pts, fixed, seed, gx, vw) {
    const out = [], map = [];
    const noise = l => 0.62 * Math.sin(l / 210 * 2 * Math.PI + seed) + 0.38 * Math.sin(l / 470 * 2 * Math.PI + seed * 1.7);
    const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    let l = 0;
    for (let i = 0; i < pts.length; i++) {
      map[i] = out.length; out.push(pts[i]);
      if (i === pts.length - 1) break;
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if ((fixed.has(i) && fixed.has(i + 1)) || len < 110) { l += len; continue; }
      const dx = (b[0] - a[0]) / len, dy = (b[1] - a[1]) / len, horiz = Math.abs(dx) > Math.abs(dy);
      const n = Math.floor(len / 70);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1), d = Math.min(len * t, len * (1 - t));
        const w = smooth(d / 110), nz = noise(l + len * t) * w;
        let ox = 0, oy = 0;
        if (horiz) oy = 5 * w + 15 * nz;
        else if (gx < 30) ox = (a[0] < vw / 2 ? 1 : -1) * 11 * (nz + w);
        else ox = 26 * nz;
        out.push([a[0] + dx * len * t + ox, a[1] + dy * len * t + oy]);
      }
      l += len;
    }
    map[pts.length] = out.length;
    return { pts: out, map };
  }

  // punto y tangente a una longitud de arco dada
  function at(S, l) {
    let lo = 0, hi = S.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (S[mid].l < l) lo = mid + 1; else hi = mid; }
    const b = S[lo], a = S[Math.max(0, lo - 1)];
    const t = b.l === a.l ? 0 : clamp((l - a.l) / (b.l - a.l), 0, 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  // Nudos. Cada tipo es una lista de puntos en un marco local: u a lo largo
  // del avance, v hacia el lado del nudo, en radios (R). La línea base está en
  // v = 0. El hilo no pasa por debajo del nudo: se hunde un poco, sube por un
  // cruce que está sobre la misma línea, da la vuelta y vuelve a bajar por ese
  // cruce, como un bucle en una cuerda tensa. El centro del nudo (donde va el
  // número) queda en (0, 1.05).
  const rad = d => d * Math.PI / 180;
  const arc = (from, to, n, r = 0.95, cx = 0, cy = 1.05) => {
    const L = []; for (let i = 0; i <= n; i++) { const a = rad(from + (to - from) * i / n); L.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return L;
  };
  const IN = [[-2.8, 0], [-1.8, 0], [-1.15, -0.24], [-0.5, -0.3], [0, 0]];
  const OUT = [[0.5, -0.3], [1.15, -0.24], [1.8, 0], [2.8, 0]];
  const KNOTS = {
    // un bucle: cruce sobre la línea, vuelta completa, cruce otra vez
    loop: () => [...IN, ...arc(-50, 230, 16), ...OUT],
    // dos vueltas, la segunda por dentro
    coil: () => [...IN, ...arc(-50, 230, 16), ...arc(230, 590, 20, 0.7), [0, 0], ...OUT],
    // bucle con la punta pasada por dentro (un nudo simple visto desde arriba)
    twist: () => [...IN, [0.6, 0.4], [0.98, 1.05], [0.65, 1.78], [-0.1, 2.02], [-0.85, 1.68], [-1.08, 0.98], [-0.72, 0.48], [-0.12, 0.5], [0.5, 0.76], [0.98, 0.52], [1.32, 0.06], [1.9, -0.14], [2.8, 0]],
    // dos bucles seguidos, el segundo más pequeño
    pair: () => [...IN, ...arc(-50, 230, 16, 0.8, 0, 0.9), [0, 0], [0.7, -0.26], [1.2, -0.1], [1.5, 0], ...arc(-50, 230, 14, 0.55, 1.5, 0.6).map(([u, v]) => [u, v]), [1.5, 0], [2.0, -0.2], [2.6, -0.1], [3.4, 0]],
  };
  // variación por nudo (determinista, según su índice): tamaño, inclinación,
  // estiramiento y sentido de giro, para que no sean todos iguales
  function variant(i) {
    const h = n => { const x = Math.sin((i + 1) * 9301 + n * 49297) * 233280; return x - Math.floor(x); };
    return { scale: 0.85 + 0.35 * h(1), lean: (h(2) - 0.5) * 0.42, stretch: 0.9 + 0.3 * h(3), flip: h(4) > 0.5 };
  }
  // f = dirección de avance; side elige de qué lado queda el nudo
  function loop(cx, cy, R, fx, fy, side = 1, type = 'loop', vr = { scale: 1, lean: 0, stretch: 1, flip: false }) {
    const nx = -fy * side, ny = fx * side;        // hacia la línea base
    let L = (KNOTS[type] || KNOTS.loop)();
    if (vr.flip) L = L.slice().reverse().map(([u, v]) => [-u, v]);   // gira al revés, entra por el mismo lado
    L = L.map(([u, v]) => [(u + v * vr.lean) * vr.scale, v * vr.stretch * vr.scale]);
    const px = cx + nx * 1.05 * R * vr.stretch * vr.scale, py = cy + ny * 1.05 * R * vr.stretch * vr.scale;
    return L.map(([u, v]) => [px + fx * u * R - nx * v * R, py + fy * u * R - ny * v * R]);
  }
  // radio del bucle y distancia de la línea base al centro, para un elemento
  const knotGeom = (r, vr) => { const R = r * 0.9; return { R, base: 1.05 * R * vr.stretch * vr.scale }; };

  /* ---------------- trazo ---------------- */

  // dibuja el tramo [from, to] de las muestras S en un contexto 2D.
  // view (opcional): {top, bottom} en el mismo sistema de coordenadas, para no
  // dibujar hebras fuera de la pantalla.
  function stroke(ctx, S, from, to, st = STYLE, view) {
    if (!S.length || to <= from) return;
    to = Math.min(to, S[S.length - 1].l);
    const a = at(S, from), b = at(S, to);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color; ctx.lineWidth = st.width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    for (let i = 0; i < S.length; i++) {
      const p = S[i];
      if (p.l <= from) continue;
      if (p.l >= to) break;
      if (view && (p.y < view.top - 40 || p.y > view.bottom + 40)) { ctx.moveTo(p.x, p.y); continue; }
      ctx.lineTo(p.x, p.y);
    }
    ctx.lineTo(b.x, b.y); ctx.stroke();

    // hebras: trazos cortos cruzando la base en diagonal, a paso regular
    ctx.strokeStyle = st.ply; ctx.lineWidth = Math.max(1, st.width * 0.36);
    const half = st.width * 0.34;
    ctx.beginPath();
    for (let l = Math.ceil(from / st.plyGap) * st.plyGap + st.plyGap * 0.5; l < to - 1; l += st.plyGap) {
      const p = at(S, l);
      if (view && (p.y < view.top - 10 || p.y > view.bottom + 10)) continue;
      const c = Math.cos(p.ang + st.plyAngle) * half, s = Math.sin(p.ang + st.plyAngle) * half;
      ctx.moveTo(p.x - c, p.y - s); ctx.lineTo(p.x + c, p.y + s);
    }
    ctx.stroke();
  }

  function fitCanvas(canvas, w, h) {
    const d = DPR();
    canvas.width = Math.max(1, Math.round(w * d)); canvas.height = Math.max(1, Math.round(h * d));
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); return ctx;
  }

  /* ---------------- animación compartida ---------------- */
  const tickers = new Set();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const fn of tickers) { try { fn(dt, now / 1000); } catch (err) { console.error(err); tickers.delete(fn); } }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* =========================================================
     LOGO — la foto de hilo se revela por su trazado
     Puntos (en el sistema 1600×757 de logo-nudo.png) trazados a mano
     siguiendo el centro de cada letra, en el orden en que se escribiría.
     ========================================================= */
  const LOGO = {
    w: 1600, h: 757, mask: 92,
    letters: [
      [[192,265],[195,340],[199,420],[204,500],[212,545],[238,540],[236,500],[224,462],[217,415],[216,365],[224,325],[252,300],[292,292],[332,308],[361,346],[373,400],[377,470],[379,530],[383,572]],
      [[503,292],[507,360],[512,430],[522,490],[545,530],[580,555],[615,562],[650,545],[675,505],[685,450],[686,390],[683,340],[678,310],[668,292],[656,300],[660,318],[676,335],[684,370],[686,430],[682,480],[666,520],[640,545],[605,552],[570,540],[545,510],[530,460],[522,400],[520,340],[521,300]],
      [[995,205],[1002,270],[1010,330],[960,310],[905,312],[850,340],[815,400],[812,470],[840,530],[900,548],[960,545],[1000,525],[1030,540],[1045,520],[1040,490],[1030,460],[1035,400],[1033,340],[1030,280],[1030,220],[1032,190]],
      [[1215,315],[1300,312],[1380,350],[1408,435],[1385,520],[1300,562],[1215,545],[1160,470],[1165,380],[1210,318],[1290,322],[1370,360],[1398,435],[1375,515],[1295,552],[1225,535],[1175,470],[1180,385],[1225,330]],
    ],
  };
  function toPath(pts) {
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C ${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`;
    }
    return d;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };

  class Logo {
    constructor(el) {
      this.el = el;
      this.img = el.querySelector('img');
      this.canvas = document.createElement('canvas'); this.canvas.className = 'logo-canvas';
      el.appendChild(this.canvas);
      // una ruta por letra (el canvas reinicia el guion en cada «M»), con su
      // longitud y su posición dentro del trazado total: así se escriben en orden
      let off = 0;
      this.letters = LOGO.letters.map(pts => {
        const d = toPath(pts), L = svgEl('path', { d }).getTotalLength();
        const l = { path: new Path2D(d), L, off }; off += L; return l;
      });
      this.L = off;
      this.p = 0; this.target = 0; this.speed = 0.55; // fracción por segundo
      this.done = false; this.onDone = null; this.ready = false;
      const go = () => { this.ready = true; el.classList.add('is-yarn'); this.resize(); };
      this.img.complete && this.img.naturalWidth ? go() : this.img.addEventListener('load', go);
      new ResizeObserver(() => this.resize()).observe(el);
      tickers.add(dt => this.tick(dt));
      // un toque deshace el hilo y lo vuelve a dibujar
      el.addEventListener('click', () => this.redraw());
    }
    resize() {
      const r = this.el.getBoundingClientRect();
      if (!r.width) return;
      this.w = r.width; this.h = r.height; this.ctx = fitCanvas(this.canvas, r.width, r.height);
      this.pattern = this.ctx.createPattern(this.img, 'no-repeat');
      this.render();
    }
    set(p) { this.p = p; this.render(); }
    render() {
      if (!this.ready || !this.ctx) return;
      const ctx = this.ctx, k = this.w / LOGO.w;
      ctx.clearRect(0, 0, this.w, this.h);
      if (this.p <= 0) return;
      ctx.save(); ctx.scale(k, k);
      // la foto del hilo solo se ve dentro del trazo: el trazo se dibuja con la foto como patrón
      ctx.lineWidth = LOGO.mask; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = this.pattern;
      const drawn = this.L * this.p;
      for (const l of this.letters) {
        const d = clamp(drawn - l.off, 0, l.L);
        if (d <= 0) break;
        ctx.setLineDash([d, l.L + 10]);
        ctx.stroke(l.path);
      }
      ctx.restore();
    }
    tick(dt = 1 / 60) {
      if (Math.abs(this.target - this.p) < 0.002) {
        if (this.p !== this.target) this.set(this.target);
        if (this.p >= 1 && !this.done) { this.done = true; this.onDone && this.onDone(); }
        return;
      }
      const dir = Math.sign(this.target - this.p);
      this.set(clamp(this.p + dir * this.speed * dt, 0, 1));
    }
    draw(speed = 0.55) { this.speed = speed; this.target = 1; }
    redraw() { if (this.target < 1 || this.p < 1) return; this.speed = 2.2; this.target = 0; this.done = false; setTimeout(() => this.draw(0.8), 700); }
    // punto del trazado (inicio o fin) en coordenadas de la página
    point(where) {
      const r = this.el.getBoundingClientRect(), k = r.width / LOGO.w;
      const pts = LOGO.letters[where === 'start' ? 0 : LOGO.letters.length - 1];
      const p = where === 'start' ? pts[0] : pts[pts.length - 1];
      return [r.left + p[0] * k, r.top + scrollY + p[1] * k];
    }
  }

  /* =========================================================
     HILO DE LA PÁGINA
     ========================================================= */
  class Thread {
    constructor(opts = {}) {
      this.hero = opts.hero || null;     // Logo del inicio (el hilo nace de su «o»)
      this.footer = opts.footer || null; // Logo del pie (el hilo termina dibujándolo)
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'yarn-thread';
      document.body.appendChild(this.canvas);
      this.S = []; this.drawn = 0; this.target = 0; this.need = true;
      this.build();
      let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => this.build(), 150); });
      // el contenido cambia de alto cuando cargan imágenes y fuentes
      new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => this.build(), 150); }).observe(document.body);
      addEventListener('scroll', () => { this.need = true; }, { passive: true });
      styleListeners.add(() => { this.need = true; });
      tickers.add(dt => this.tick(dt));
    }

    gutter() {
      const sec = document.querySelector('main > section');
      if (!sec) return 24;
      const r = sec.getBoundingClientRect();
      return r.left + parseFloat(getComputedStyle(sec).paddingLeft) / 2;
    }

    build() {
      const vw = document.documentElement.clientWidth;
      const gx = this.gutter();
      const xAt = side => side < 0 ? gx : vw - gx;
      const pts = [];
      let side = -1; // margen por el que baja el hilo: -1 izquierdo, 1 derecho

      // nudos ordenados de arriba abajo y agrupados por filas
      // posición en la página sin contar transformaciones (las animaciones de
      // aparición desplazan los elementos mientras se mide)
      const pageRect = el => {
        let x = 0, y = 0;
        for (let e = el; e; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
        return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
      };
      const seed = [...location.pathname].reduce((a, c) => a + c.charCodeAt(0), 0);
      const knots = [...document.querySelectorAll('[data-knot]')]
        .map((el, i) => {
          const r = pageRect(el), vr = variant(seed + i), g = knotGeom(Math.max(10, r.width / 2), vr);
          return { el, vr, cx: r.left + r.width / 2, cy: r.top + r.height / 2, rad: g.R, base: g.base };
        })
        .filter(k => k.el.offsetWidth > 0).sort((a, b) => a.cy - b.cy);
      // tipo de nudo: el que diga data-knot, o se van alternando (los nudos con
      // número solo usan los que dejan el centro libre)
      let nl = 0, nn = 0;
      knots.forEach(k => {
        const numbered = !!k.el.querySelector('span');
        k.type = KNOTS[k.el.dataset.knot] ? k.el.dataset.knot : numbered ? ['loop', 'coil'][nn++ % 2] : ['loop', 'twist', 'coil', 'pair'][nl++ % 4];
      });
      this.knots = knots;
      this.ranges = [];   // tramos (en longitud) ocupados por nudos
      const rows = [];
      knots.forEach(k => { const row = rows[rows.length - 1]; if (row && Math.abs(row[0].cy - k.cy) < 40) row.push(k); else rows.push([k]); });

      // arranque: desde la cola de la «o» del logo baja por el margen derecho;
      // sin logo, entra por arriba a la izquierda
      if (this.hero) {
        const [ex, ey] = this.hero.point('end');
        const heroBottom = this.hero.el.closest('section').getBoundingClientRect().bottom + scrollY;
        const w = this.hero.el.getBoundingClientRect().width;   // la cola sale hacia arriba a la derecha y se curva
        pts.push([ex, ey], [ex + 0.034 * w, ey - 0.04 * w], [ex + 0.1 * w, ey - 0.05 * w], [ex + 0.16 * w, ey + 0.01 * w],
                 [Math.min(vw - gx, ex + 0.17 * w), ey + 0.11 * w], [vw - gx, heroBottom - 60]);
        side = 1;
      } else {
        pts.push([gx, -60], [gx, 120]);
      }

      // en cada fila de nudos el hilo cruza la página en horizontal: entra por el
      // margen en el que viene, pasa por los nudos y sigue hasta el otro margen,
      // por el que baja hasta la siguiente fila
      rows.forEach(row => {
        const cross = row.length > 1 || row[0].el.closest('.label');
        if (cross) {
          const fx = side < 0 ? 1 : -1;                       // sentido del cruce
          const y = row[0].cy + row[0].base;                  // línea por la que pasa el hilo (bajo los nudos)
          row.sort((a, b) => (a.cx - b.cx) * fx);
          const last = pts[pts.length - 1];
          // puntos intermedios en los tramos largos, para que el cruce vaya recto
          const across = (xa, xb) => { const n = Math.floor(Math.abs(xb - xa) / 260); for (let i = 1; i <= n; i++) pts.push([xa + (xb - xa) * i / (n + 1), y]); };
          const xs = xAt(side), xe = xAt(-side);
          const entry0 = row[0].cx - fx * 2.8 * row[0].rad * row[0].vr.scale;
          // si el primer nudo está pegado al margen, se entra en diagonal (no cabe una
          // esquina suave); los puntos de entrada solo si hay sitio por encima
          const room = y - last[1];
          if (Math.abs(entry0 - xs) < 90) { if (room > 170) pts.push([xs, y - 130], [(xs + entry0) / 2, y - 40]); }
          else { if (room > 120) pts.push([xs, y - 90]); if (room > 30) pts.push([xs, y]); }
          let x = pts[pts.length - 1][0];
          row.forEach(k => {
            const entry = k.cx - fx * 2.8 * k.rad * k.vr.scale;
            if (Math.abs(entry - x) > 60) across(x, entry);
            k.i0 = pts.length; pts.push(...loop(k.cx, k.cy, k.rad, fx, 0, fx, k.type, k.vr)); k.i1 = pts.length - 1;
            x = pts[pts.length - 1][0];
          });
          if (Math.abs(xe - x) < 90) pts.push([(xe + x) / 2, y + 40], [xe, y + 130]);
          else { across(x, xe); pts.push([xe, y]); }
          side = -side;
        } else {
          // un nudo solo con texto al lado: el hilo no cruza; baja por el margen
          // izquierdo, pasa junto al número, le da la vuelta y sigue bajando
          const k = row[0];
          if (side > 0) {
            // viene por la derecha: cruza por el hueco que hay encima del bloque
            const block = k.el.closest('.step, article, li, figure, .section-head') || k.el;
            const prev = pts[pts.length - 1];
            const ty = Math.max(pageRect(block).top - 24, prev[1] + 40);
            if (ty - 60 > prev[1] + 30) pts.push([xAt(1), ty - 60]);
            pts.push([xAt(1), ty], [vw * 0.5, ty + 6], [xAt(-1), ty]);
            side = -1;
          }
          // aproximación por encima del nudo solo si hay sitio (nunca volver atrás);
          // si el nudo anterior estaba en la misma vertical, el hilo sigue recto
          const x = k.cx - k.base, last = pts[pts.length - 1], topY = k.cy - 2.8 * k.rad * k.vr.scale;
          if (topY - last[1] > 130) pts.push([last[0], topY - 80], [x, topY - 30]);
          else if (topY - last[1] > 50 && Math.abs(last[0] - x) > 4) pts.push([x, topY - 25]);
          k.i0 = pts.length; pts.push(...loop(k.cx, k.cy, k.rad, 0, 1, 1, k.type, k.vr)); k.i1 = pts.length - 1;
        }
      });

      // final: entra en el logo del pie por el inicio de la «n»
      if (this.footer) {
        const [sx, sy] = this.footer.point('start');
        if (side > 0) pts.push([xAt(side), sy - 260], [vw * 0.5, sy - 150], [sx - 30, sy - 70], [sx, sy]);
        else pts.push([xAt(side), sy - 160], [sx - 40, sy - 70], [sx, sy]);
      } else {
        pts.push([xAt(side), document.documentElement.scrollHeight + 60]);
      }
      const fixed = new Set();
      knots.forEach(k => { if (k.i0 != null) for (let i = k.i0; i <= k.i1; i++) fixed.add(i); });
      // seguro: fuera de los nudos, un vértice que hace volver el hilo sobre sí mismo se quita
      this.removed = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        if (fixed.has(i)) continue;
        const a = pts[i - 1], p = pts[i], b = pts[i + 1];
        const d1 = [p[0] - a[0], p[1] - a[1]], d2 = [b[0] - p[0], b[1] - p[1]];
        const l1 = Math.hypot(...d1), l2 = Math.hypot(...d2);
        if (l1 > 1e-6 && l2 > 1e-6 && (d1[0] * d2[0] + d1[1] * d2[1]) / (l1 * l2) < -0.8) {
          this.removed++; console.warn('nudo: vértice eliminado por volver atrás', p);
          pts.splice(i, 1);
          knots.forEach(k => { if (k.i0 != null && k.i0 > i) { k.i0--; k.i1--; } });
          fixed.clear(); knots.forEach(k => { if (k.i0 != null) for (let j = k.i0; j <= k.i1; j++) fixed.add(j); });
          i -= 2; if (i < 0) i = 0;
        }
      }
      this.route = pts;   // ruta antes de vagar y redondear (para depurar)
      const w = wander(pts, fixed, seed, gx, vw);
      const f = fillet(w.pts);
      this.S = sample(f.pts, 3);
      this.ranges = knots.filter(k => k.i0 != null).map(k => [this.S.marks[f.map[w.map[k.i0]]], this.S.marks[f.map[w.map[k.i1]]]]);
      // «y» máxima acumulada: así la longitud dibujada crece de forma monótona con el scroll
      let m = -Infinity; this.maxY = this.S.map(p => (m = Math.max(m, p.y)));
      this.L = this.S.length ? this.S[this.S.length - 1].l : 0;
      this.need = true;
      this.resize();
    }

    resize() {
      const w = document.documentElement.clientWidth, h = innerHeight;
      if (this.w !== w || this.h !== h) { this.w = w; this.h = h; this.ctx = fitCanvas(this.canvas, w, h); }
    }

    lengthAtY(y) {
      let lo = 0, hi = this.maxY.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.maxY[mid] < y) lo = mid + 1; else hi = mid; }
      return this.S[lo] ? this.S[lo].l : 0;
    }

    tick(dt) {
      if (!this.S.length) return;
      // objetivo: la punta del hilo va un poco por debajo del centro de la pantalla
      let target = this.lengthAtY(scrollY + innerHeight * 0.72);
      if (this.hero && !this.hero.done) {
        // el hilo nace cuando el logo termina la «o»; si ya bajaste, el logo se apura
        if (scrollY > 120 && this.hero.target === 1 && this.hero.speed < 2) this.hero.draw(2.5);
        if (this.hero.p < 0.9) target = 0;
      }
      if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) target = this.L;
      if (reduced) target = this.L;
      this.target = target;
      let diff = this.target - this.drawn;
      // si la punta quedó muy atrás (un salto grande de scroll, un enlace al pie, una
      // página abierta por la mitad) salta hasta la pantalla: siempre hay hilo a la vista
      if (diff > innerHeight * 1.1) { this.drawn = this.target - innerHeight * 0.6; diff = this.target - this.drawn; this.need = true; }
      if (Math.abs(diff) > 0.5) {
        // se dibuja a una velocidad máxima: si bajas rápido, el hilo te alcanza;
        // dentro de un nudo va mucho más despacio, para verlo formarse
        const inKnot = (this.ranges || []).some(([a, b]) => this.drawn > a - 20 && this.drawn < b + 20);
        const vmax = inKnot ? 420 : 1300;
        const step = Math.sign(diff) * Math.min(Math.abs(diff) * 0.08, vmax * dt);
        this.drawn += Math.abs(step) < 0.5 ? diff : step; this.need = true;
      }
      if (this.footer && this.drawn >= this.L - 1 && !this.footer.done && this.footer.target < 1) this.footer.draw(0.7);
      if (!this.need) return; this.need = false;
      this.resize();
      const ctx = this.ctx, top = scrollY;
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.save(); ctx.translate(0, -top);
      stroke(ctx, this.S, 0, this.drawn, STYLE, { top, bottom: top + this.h });
      ctx.restore();
    }
  }

  /* =========================================================
     SUBRAYADO DE HILO (hover)
     ========================================================= */
  // opts: keep (queda cosido siempre; al pasar el cursor se descose y se vuelve
  // a coser), color (variable CSS, p. ej. '--lila'; si no, el color del hilo),
  // width (grosor; si no, según el tamaño de letra)
  class Underline {
    constructor(el, opts = {}) {
      this.el = el; el.classList.add('has-yarn-underline');
      this.canvas = document.createElement('canvas'); this.canvas.className = 'yarn-underline';
      el.appendChild(this.canvas);
      this.p = 0; this.S = []; this.w = 0; this.opts = opts;
      // el enlace de la página actual queda cosido siempre
      this.keep = opts.keep || el.hasAttribute('aria-current') || 'yarnKeep' in el.dataset;
      this.target = this.keep ? 1 : 0;
      this.restyle();
      const host = el.closest('[data-yarn-host]') || el;
      // los que están siempre cosidos no se descosen: se sacuden un momento
      const on = () => { if (this.keep) this.wiggle = 1; else this.target = 1; };
      const off = () => { if (!this.keep) this.target = 0; };
      host.addEventListener('pointerenter', on); host.addEventListener('pointerleave', off);
      host.addEventListener('focusin', on); host.addEventListener('focusout', off);
      styleListeners.add(() => { this.restyle(); this.dirty = true; });
      tickers.add((dt, t) => this.tick(dt, t));
    }
    restyle() {
      const fs = parseFloat(getComputedStyle(this.el).fontSize) || 16;
      const width = this.opts.width || clamp(fs / 13, 2.2, 5.5);
      const color = this.opts.color ? cssVar(this.opts.color) || STYLE.color : STYLE.color;
      this.style = { ...STYLE, color, ply: rgba(mix(color, cssVar('--rosa') || '#ffdada', 0.55), 0.85), width, plyGap: width * 1.6 };
      this.h = Math.ceil(width * 5); this.w = 0;
    }
    // la onda del hilo; con energía (wiggle) se sacude: más amplitud y la fase corre
    wave(t = 0, e = 0) {
      const y = this.h / 2, a = this.style.width, pts = [[0, y]];
      const step = a * 15, amp = a * (1 + 2.2 * e), ph = t * 16;
      for (let x = a * 11; x < this.w; x += step) pts.push([x + Math.sin(ph + x / step) * a * 2 * e, y + Math.sin(Math.PI * (pts.length % 2 ? 1.5 : 0.5) + ph * 0.5) * amp * 0]);
      // forma: zigzag suave; al sacudirse, cada vértice sube o baja según una onda que viaja
      pts.forEach((p, i) => { if (i) p[1] = y + (i % 2 ? -1 : 1) * amp * (e ? Math.cos(ph + i * 0.9) : 1); });
      pts.push([this.w, y]);
      return pts;
    }
    layout() {
      const w = Math.round(this.el.getBoundingClientRect().width), h = this.h;   // también para elementos en línea
      if (!w || w === this.w) return;
      this.w = w; this.ctx = fitCanvas(this.canvas, w, h);
      this.S = sample(this.wave(), 2); this.L = this.S[this.S.length - 1].l; this.dirty = true;
    }
    tick(dt, t) {
      if (this.p === this.target && !this.dirty && !this.wiggle) return;
      if (!this.el.isConnected) return;
      this.layout();
      if (!this.ctx) return;
      const speed = 2.4; // longitud completa por segundo
      this.p = this.target > this.p ? Math.min(this.target, this.p + speed * dt) : Math.max(this.target, this.p - speed * dt * 1.6);
      let S = this.S;
      if (this.wiggle) {
        this.wiggle *= Math.exp(-dt * 2.4);
        if (this.wiggle < 0.02) this.wiggle = 0;
        S = sample(this.wave(t, this.wiggle), 2);
      }
      this.dirty = false;
      this.ctx.clearRect(0, 0, this.w, this.h);
      // al recogerse, el hilo se va por donde entró (se acorta desde el final)
      stroke(this.ctx, S, 0, S[S.length - 1].l * this.p, this.style);
    }
  }

  /* ---------------- arranque ---------------- */
  function init() {
    refreshStyle();
    const logos = {};
    document.querySelectorAll('[data-logo]').forEach(el => { logos[el.dataset.logo] = new Logo(el); });
    if (reduced) {
      Object.values(logos).forEach(l => { l.set(1); l.done = true; l.target = 1; });
    } else {
      if (logos.hero) logos.hero.draw(0.5);
      if (logos.footer && !document.querySelector('.yarn-thread')) logos.footer.draw();
    }
    const thread = new Thread({ hero: logos.hero, footer: logos.footer });
    if (reduced) { thread.drawn = thread.L; if (logos.footer) logos.footer.set(1); }
    document.querySelectorAll('[data-yarn-underline]').forEach(el => new Underline(el));
    // palabras cosidas del texto: hilo del color de cada una, siempre puesto
    document.querySelectorAll('.sq').forEach(el => new Underline(el, { keep: true, color: el.dataset.color }));
    return { logos, thread };
  }

  return { init, sample, fillet, wander, at, loop, KNOTS, variant, stroke, STYLE, Logo, Thread, Underline, tickers, reduced };
})();
