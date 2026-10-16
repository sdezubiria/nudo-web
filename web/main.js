/* =========================================================
   nudo — interacciones
   - hilo del logo (WebGL): se deforma con el cursor, el dedo y el scroll
   - círculos de palabras que giran
   - hilos separadores que se pueden "pulsar"
   - hilo del proceso que se dibuja al hacer scroll
   - tarjetas de proyecto + galería
   ========================================================= */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- estado global: puntero y scroll ---------------- */
  const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0, type: 'mouse', down: false };
  function trackPointer(x, y, type) {
    const now = performance.now();
    const dt = Math.max(8, now - pointer.t) / 1000;
    if (pointer.t && now - pointer.t < 120) {
      pointer.vx = lerp(pointer.vx, (x - pointer.x) / dt, 0.5);
      pointer.vy = lerp(pointer.vy, (y - pointer.y) / dt, 0.5);
    } else { pointer.vx = pointer.vy = 0; }
    pointer.x = x; pointer.y = y; pointer.t = now; pointer.type = type;
  }
  addEventListener('pointermove', e => { if (e.pointerType !== 'touch') trackPointer(e.clientX, e.clientY, 'mouse'); }, { passive: true });
  addEventListener('touchstart', e => { const t = e.touches[0]; pointer.t = 0; trackPointer(t.clientX, t.clientY, 'touch'); pointer.down = true; }, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; trackPointer(t.clientX, t.clientY, 'touch'); }, { passive: true });
  addEventListener('touchend', () => { pointer.down = false; setTimeout(() => { if (!pointer.down) pointer.x = pointer.y = -9999; }, 60); }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.x = pointer.y = -9999; });

  let scrollV = 0, lastScrollY = scrollY;

  /* ---------------- loop de animación ---------------- */
  const tickers = new Set();
  let last = performance.now(), time = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    const y = scrollY;
    scrollV = lerp(scrollV, (y - lastScrollY) / Math.max(dt, 0.001), 0.18);
    lastScrollY = y;
    for (const fn of tickers) fn(dt, time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ejecuta un ticker solo cuando el elemento está en pantalla
  function whileVisible(el, fn, margin = '100px') {
    const io = new IntersectionObserver(([e]) => { e.isIntersecting ? tickers.add(fn) : tickers.delete(fn); }, { rootMargin: margin });
    io.observe(el);
  }

  /* ---------------- header + menú ---------------- */
  const header = document.querySelector('.site-header');
  const brandImg = document.querySelector('.brand img');
  let brandSkew = 0;
  tickers.add(() => {
    header.classList.toggle('scrolled', scrollY > 30);
    if (reduced) return;
    brandSkew = lerp(brandSkew, clamp(scrollV * -0.006, -12, 12), 0.12);
    brandImg.style.transform = `skewX(${brandSkew.toFixed(2)}deg) rotate(${(brandSkew * 0.25).toFixed(2)}deg)`;
  });

  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', open);
    menu.hidden = !open;
    menuBtn.querySelector('.menu-btn-label').textContent = open ? 'cerrar' : 'menú';
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ---------------- aparecer al hacer scroll ---------------- */
  const revealIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

  /* =========================================================
     HILO DEL LOGO — malla de resortes + WebGL
     ========================================================= */
  class Yarn {
    constructor(el, src, srcV) {
      this.el = el;
      this.canvas = el.querySelector('canvas');
      this.GW = 56; this.GH = 26;
      const n = this.GW * this.GH;
      this.off = new Float32Array(n * 2);
      this.vel = new Float32Array(n * 2);
      this.acc = new Float32Array(n * 2);
      this.bytes = new Uint8Array(n * 4);
      this.amp = 0.075;            // desplazamiento máximo (en uv)
      this.lastPX = null;
      this.ready = false;
      if (!this.initGL()) return;
      // en pantallas estrechas el hero usa el logo apilado (nu/do), teñido de vino
      const mq = srcV ? matchMedia('(max-width: 640px)') : null;
      const load = () => {
        const vert = !!(mq && mq.matches);
        const img = new Image();
        img.onload = () => { this.gl.uniform1f(this.uTintAmt, vert ? 1 : 0.45); this.setImage(img); this.resize(); };
        img.src = vert ? srcV : src;
      };
      load();
      if (mq) mq.addEventListener('change', load);
      this.resize();
      new ResizeObserver(() => this.resize()).observe(el);
      // tocar el hilo = darle un "golpecito"
      this.canvas.addEventListener('touchstart', e => {
        const t = e.touches[0]; const r = this.canvas.getBoundingClientRect();
        this.poke(t.clientX - r.left, t.clientY - r.top, r.width, r.height, 1.1);
      }, { passive: true });
      this.canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') return;
        const r = this.canvas.getBoundingClientRect();
        this.poke(e.clientX - r.left, e.clientY - r.top, r.width, r.height, 0.9);
      });
      whileVisible(el, (dt, t) => this.tick(dt, t));
    }

    initGL() {
      const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false });
      if (!gl) return false;
      this.gl = gl;
      const vs = `attribute vec2 p; varying vec2 v;
        void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
      const fs = `precision mediump float; varying vec2 v;
        uniform sampler2D uImg, uDisp; uniform float uAmp; uniform vec2 uGrid;
        uniform vec3 uTint; uniform float uTintAmt;
        void main(){
          vec2 du = (v * (uGrid - 1.) + .5) / uGrid;
          vec2 d = (texture2D(uDisp, du).rg - .5) * 2. * uAmp;
          vec4 c = texture2D(uImg, v - d);
          float l = dot(c.rgb, vec3(.299, .587, .114));
          c.rgb = mix(c.rgb, uTint * (.55 + 1.25 * l), uTintAmt);
          gl_FragColor = c;
        }`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const mkTex = unit => {
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      this.texImg = mkTex(0);
      this.texDisp = mkTex(1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.GW, this.GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.bytes);
      const u = name => gl.getUniformLocation(prog, name);
      gl.uniform1i(u('uImg'), 0);
      gl.uniform1i(u('uDisp'), 1);
      gl.uniform1f(u('uAmp'), this.amp);
      gl.uniform2f(u('uGrid'), this.GW, this.GH);
      gl.uniform3f(u('uTint'), 0x70 / 255, 0x1d / 255, 0x3b / 255);  // vino #701d3b
      this.uTintAmt = u('uTintAmt');
      gl.uniform1f(this.uTintAmt, 0.45);
      gl.clearColor(0, 0, 0, 0);
      return true;
    }

    setImage(img) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texImg);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img); }
      catch (err) { return; } // imagen bloqueada: se queda el <img> de respaldo
      this.ready = true;
      this.draw();
      this.el.classList.add('gl');
    }

    resize() {
      const r = this.el.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.w = r.width; this.h = r.height;
      this.canvas.width = Math.max(1, Math.round(r.width * dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * dpr));
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (this.ready) this.draw();
    }

    // empujón radial (toque / clic)
    poke(px, py, w, h, strength) {
      const { GW, GH, vel } = this;
      const R = Math.max(80, w * 0.12) * 1.3;
      for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
        const nx = i / (GW - 1) * w, ny = j / (GH - 1) * h;
        const dx = nx - px, dy = ny - py, d = Math.hypot(dx, dy);
        if (d > R || d < 0.001) continue;
        const f = (1 - d / R) ** 2 * strength, k = (j * GW + i) * 2;
        vel[k] += dx / d * f; vel[k + 1] += dy / d * f;
      }
    }

    tick(dt, t) {
      if (!this.ready) return;
      const { GW, GH, off, vel, acc, amp } = this;
      const r = this.canvas.getBoundingClientRect();
      const w = r.width, h = r.height;

      // 1) el puntero arrastra el hilo
      const px = pointer.x - r.left, py = pointer.y - r.top;
      const R = Math.max(80, w * 0.12);
      const fresh = performance.now() - pointer.t < 90;
      if (fresh && px > -R && px < w + R && py > -R && py < h + R) {
        const pvx = clamp(pointer.vx / w, -5, 5), pvy = clamp(pointer.vy / h, -5, 5);
        const grip = pointer.type === 'touch' ? 0.5 : 0.32;
        for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
          const dx = i / (GW - 1) * w - px, dy = j / (GH - 1) * h - py;
          const d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          const f = (1 - Math.sqrt(d2) / R) ** 2 * grip, k = (j * GW + i) * 2;
          vel[k] += (pvx * 0.55 - vel[k]) * f;
          vel[k + 1] += (pvy * 0.55 - vel[k + 1]) * f;
        }
      }

      // 2) resortes + acoplamiento entre vecinos (la "tela" del hilo)
      const K = 70, C = 260, D = 4.2;
      const sv = clamp(scrollV / h, -6, 6);   // inercia del scroll (uv/s)
      const sub = 2, h2 = dt / sub;
      for (let s = 0; s < sub; s++) {
        for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
          const k = (j * GW + i) * 2;
          const l = i > 0 ? k - 2 : k, rr = i < GW - 1 ? k + 2 : k;
          const u = j > 0 ? k - GW * 2 : k, dn = j < GH - 1 ? k + GW * 2 : k;
          const ux = i / (GW - 1), vy = j / (GH - 1);
          const shape = 0.55 + 0.45 * Math.sin(ux * 6.28 + t * 1.3);
          // respiración suave en reposo
          const bx = 0.22 * Math.cos(t * 0.9 + vy * 5 + ux * 2);
          const by = 0.28 * Math.sin(t * 1.1 + ux * 6 + vy * 3);
          acc[k]     = -K * off[k]     + C * (off[l] + off[rr] + off[u] + off[dn] - 4 * off[k])         - D * vel[k]     + bx + sv * 0.35 * Math.cos(ux * 4 + t);
          acc[k + 1] = -K * off[k + 1] + C * (off[l + 1] + off[rr + 1] + off[u + 1] + off[dn + 1] - 4 * off[k + 1]) - D * vel[k + 1] + by + sv * 1.3 * shape;
        }
        for (let k = 0; k < off.length; k++) {
          vel[k] += acc[k] * h2;
          off[k] += vel[k] * h2;
          if (off[k] > amp) { off[k] = amp; vel[k] *= 0.5; }
          else if (off[k] < -amp) { off[k] = -amp; vel[k] *= 0.5; }
        }
      }
      this.draw();
    }

    draw() {
      const { gl, off, bytes, amp, GW, GH } = this;
      for (let k = 0, n = GW * GH; k < n; k++) {
        bytes[k * 4] = 127.5 + 127.5 * off[k * 2] / amp;
        bytes[k * 4 + 1] = 127.5 + 127.5 * off[k * 2 + 1] / amp;
        bytes[k * 4 + 3] = 255;
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texDisp);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  if (!reduced) {
    const src = window.NUDO_LOGO || 'assets/img/logo-nudo.png';
    const srcV = window.NUDO_LOGO_V || 'assets/img/logo-nudo-vertical.png';
    document.querySelectorAll('[data-yarn]').forEach(el => new Yarn(el, src, 'vertical' in el.dataset ? srcV : null));
  }

  /* =========================================================
     CÍRCULOS DE PALABRAS
     ========================================================= */
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
      // repartir las palabras según su largo, con el mismo espacio entre ellas
      const total = ring.words.reduce((s, w) => s + w.length, 0);
      const gap = (2 * Math.PI * r / 10.5 - total) / ring.words.length;  // ≈10.5 unidades por letra
      let acc = 0;
      ring.words.forEach(word => {
        const center = acc + gap / 2 + word.length / 2;
        acc += word.length + gap;
        const text = mk('text', { fill: ring.color, class: 'w' }, g);
        const tp = mk('textPath', { href: `#${id}`, startOffset: `${(center / (total + gap * ring.words.length) * 100).toFixed(2)}%`, 'text-anchor': 'middle' }, text);
        tp.textContent = word;
      });
      return { g, angle: ri * 17, ...ring };
    });
    // centro: * creación *
    const c = mk('g', {}, svg);
    mk('use', { href: '#ast', x: -12, y: -62, width: 24, height: 24, style: 'color: var(--lila)' }, c);
    const t = mk('text', { 'text-anchor': 'middle', y: 8, fill: 'var(--naranja)', style: 'font-size: 24px' }, c);
    t.textContent = 'creación';
    mk('use', { href: '#ast', x: -12, y: 34, width: 24, height: 24, style: 'color: var(--lila)' }, c);

    let hover = 0, hoverT = 0;
    svg.addEventListener('pointerenter', () => hoverT = 1);
    svg.addEventListener('pointerleave', () => hoverT = 0);
    const spinRings = dt => {
      hover = lerp(hover, hoverT, 0.05);
      const boost = 1 + hover * 2.2 + Math.min(Math.abs(scrollV) * 0.004, 6);
      for (const r of groups) {
        r.angle += r.dir * r.speed * boost * dt;
        r.g.setAttribute('transform', `rotate(${r.angle.toFixed(3)})`);
      }
    };
    if (reduced) groups.forEach(r => r.g.setAttribute('transform', `rotate(${r.angle})`));
    else whileVisible(svg, spinRings);
  }

  /* =========================================================
     HILOS SEPARADORES — se pueden pulsar con el cursor o el dedo
     ========================================================= */
  document.querySelectorAll('.hilo').forEach(el => {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    const base = document.createElementNS(NS, 'path'); base.setAttribute('class', 'h-base');
    const twist = document.createElementNS(NS, 'path'); twist.setAttribute('class', 'h-twist');
    s.append(base, twist); el.appendChild(s);
    let a = 0, va = 0, x = 0.5, grabbed = false;
    const H = 70, MID = H / 2, MAX = 26;
    const render = () => {
      const w = el.clientWidth, X = clamp(x, 0.04, 0.96) * w, Y = MID + a;
      const d = `M 0 ${MID} C ${X / 2} ${MID} ${X / 2} ${Y} ${X} ${Y} C ${X + (w - X) / 2} ${Y} ${X + (w - X) / 2} ${MID} ${w} ${MID}`;
      base.setAttribute('d', d); twist.setAttribute('d', d);
    };
    render();
    if (reduced) { addEventListener('resize', render); return; }
    const tick = dt => {
      const r = el.getBoundingClientRect();
      const px = pointer.x - r.left, py = pointer.y - r.top;
      const inside = px >= 0 && px <= r.width && py >= 4 && py <= r.height - 4 && performance.now() - pointer.t < 400;
      if (inside) {
        if (!grabbed) { grabbed = true; x = px / r.width; }
        x = lerp(x, px / r.width, 0.35);
        const target = clamp(py - MID, -MAX, MAX);
        va += ((target - a) * 900 - va * 30) * dt;
      } else {
        if (grabbed) { grabbed = false; va += clamp(pointer.vy * 0.05, -300, 300); }
        const force = -a * 380 - va * 3.2 + clamp(scrollV, -3000, 3000) * 0.9;
        va += force * dt;
        x = lerp(x, 0.5, 0.01);
      }
      a += va * dt;
      a = clamp(a, -MAX * 1.4, MAX * 1.4);
      render();
    };
    whileVisible(el, tick, '0px');
    // en el móvil: un pequeño "pluck" al aparecer en pantalla
    new IntersectionObserver(([e]) => { if (e.isIntersecting && !canHover) va += 220; }, { threshold: 1 }).observe(el);
  });

  /* =========================================================
     HILO DEL PROCESO — se dibuja con el scroll y hace un nudo en cada paso
     ========================================================= */
  const steps = document.querySelector('.steps');
  if (steps) {
    const thread = steps.querySelector('.thread');
    const maskP = thread.querySelector('.thread-mask');
    const baseP = thread.querySelector('.thread-base');
    const twistP = thread.querySelector('.thread-twist');
    const mask = thread.querySelector('mask');
    ['x', 'y'].forEach(k => mask.setAttribute(k, -4000));
    ['width', 'height'].forEach(k => mask.setAttribute(k, 10000));
    const stepEls = [...steps.querySelectorAll('.step')];
    let L = 1, marks = [], prog = reduced ? 1 : 0;
    const P = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;

    function build() {
      const sr = steps.getBoundingClientRect();
      const vertical = innerWidth <= 900;
      const f = vertical ? [0, 1] : [1, 0];
      const n = vertical ? [1, 0] : [0, -1];
      const knots = stepEls.map(s => {
        const k = s.querySelector('.knot').getBoundingClientRect();
        return { cx: k.left - sr.left + k.width / 2, cy: k.top - sr.top + k.height / 2, size: k.width };
      });
      const r = knots[0].size / 3.1;
      const base = knots.map(k => [k.cx - 1.6 * r * n[0], k.cy - 1.6 * r * n[1]]);
      const add = (p, v, s) => [p[0] + v[0] * s, p[1] + v[1] * s];
      const loop = p => {
        const T = add(p, n, 3.2 * r);
        return ` C ${P(...add(p, f, 2.1 * r))} ${P(...add(add(p, f, 2.1 * r), n, 3.2 * r))} ${P(...T)}` +
               ` C ${P(...add(T, f, -2.1 * r))} ${P(...add(p, f, -2.1 * r))} ${P(...p)}`;
      };
      const link = (a, b, wob) => {
        const s = ((b[0] - a[0]) * f[0] + (b[1] - a[1]) * f[1]) * 0.5;
        return ` C ${P(...add(add(a, f, s), n, wob))} ${P(...add(add(b, f, -s), n, -wob))} ${P(...b)}`;
      };
      const start = vertical ? [base[0][0], -60] : [-sr.left, base[0][1] + 36];
      const end = vertical ? [base.at(-1)[0], sr.height + 40] : [innerWidth - sr.left, base.at(-1)[1] - 30];
      const parts = [`M ${P(...start)}` + link(start, base[0], vertical ? 10 : 26)];
      base.forEach((p, i) => {
        parts.push(loop(p));
        if (i < base.length - 1) parts.push(link(p, base[i + 1], vertical ? 14 : 30 * (i % 2 ? -1 : 1)));
      });
      parts.push(link(base.at(-1), end, vertical ? 10 : -22));
      const d = parts.join('');
      [maskP, baseP, twistP].forEach(p => p.setAttribute('d', d));
      L = maskP.getTotalLength();
      // longitud acumulada hasta cada nudo (para encender cada paso)
      marks = base.map((_, i) => {
        maskP.setAttribute('d', parts.slice(0, 2 + i * 2).join(''));
        return maskP.getTotalLength();
      });
      maskP.setAttribute('d', d);
      maskP.style.strokeDasharray = `${L} ${L}`;
      update(true);
    }
    function update(force) {
      const r = steps.getBoundingClientRect(), vh = innerHeight;
      const target = reduced ? 1 : clamp((vh * 0.9 - r.top) / (r.height * 0.5 + vh * 0.35), 0, 1);
      const before = prog;
      prog = force && reduced ? 1 : lerp(prog, target, 0.1);
      if (!force && Math.abs(before - prog) < 0.0002) return;
      const drawn = prog * L;
      maskP.style.strokeDashoffset = (L - drawn).toFixed(1);
      stepEls.forEach((s, i) => s.classList.toggle('on', drawn >= marks[i] - 10));
    }
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    fontsReady.then(build);
    new ResizeObserver(() => build()).observe(steps);
    whileVisible(steps, () => update(false), '200px');
  }

  /* =========================================================
     PROYECTOS — tarjetas y galería
     Textos PROVISIONALES: no venían en los documentos del proyecto.
     ========================================================= */
  const img = (p, n) => Array.from({ length: n }, (_, i) => ({ src: `assets/img/proyectos/${p}-${String(i + 1).padStart(2, '0')}.webp` }));
  const PROJECTS = {
    b23: {
      title: 'B23', tags: 'revista · edición · diseño · ilustración',
      text: 'Revista con secciones de moda, juegos, relatos e ilustración. Dos portadas, incluida una edición de Halloween. (Texto provisional)',
      media: img('b23', 12),
    },
    ocupar: {
      title: 'Ocupar espacio', tags: 'publicaciones · objeto editorial · materialidad',
      text: 'Serie de publicaciones que exploran el formato y los materiales: diapositivas, collage, crucigramas, papel y dibujo. (Texto provisional)',
      media: [{ src: 'assets/video/ocupar-espacio.mp4', video: true }, ...img('ocupar', 10)],
    },
    nams: {
      title: 'El mundo de Ñams', tags: 'libro ilustrado · personajes · diseño',
      text: 'Libro ilustrado — edición espacial — con personajes, recetas galácticas y un viaje por las estrellas. (Texto provisional)',
      media: img('nams', 10),
    },
    etno: {
      title: 'Etno DJ', tags: 'ilustración · exposición · identidad',
      text: 'Ilustraciones de fauna, flora y escenas cotidianas, y su montaje en la exposición «Tejer lo universal». (Texto provisional)',
      media: [...img('etno', 3), { src: 'assets/video/etno-1.mp4', video: true }, { src: 'assets/video/etno-2.mp4', video: true }, ...img('etno', 12).slice(3)],
    },
    carey: {
      title: 'Carey', tags: 'ilustración · pictogramas · portada',
      text: 'Portada ilustrada y sistema de pictogramas. (Texto provisional)',
      media: img('carey', 2),
    },
    setas: {
      title: 'El mundo de las setas', tags: 'próximamente',
      text: 'Este proyecto aparece en la web actual de nudo, pero todavía no tenemos sus imágenes.',
      media: [{ placeholder: 'Imágenes pendientes' }, { placeholder: 'Imágenes pendientes' }],
    },
  };

  const cursorLabel = document.querySelector('.cursor-label');
  document.querySelectorAll('.card').forEach(card => {
    const media = card.querySelector('.card-media');
    media.addEventListener('click', () => openProject(card.dataset.project));
    if (!canHover || reduced) return;
    media.addEventListener('pointermove', e => {
      const r = media.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      media.style.setProperty('--ry', `${(nx * 7).toFixed(2)}deg`);
      media.style.setProperty('--rx', `${(-ny * 7).toFixed(2)}deg`);
      cursorLabel.style.setProperty('--x', `${e.clientX}px`);
      cursorLabel.style.setProperty('--y', `${e.clientY}px`);
      cursorLabel.classList.add('on');
    });
    media.addEventListener('pointerleave', () => {
      media.style.setProperty('--rx', '0deg'); media.style.setProperty('--ry', '0deg');
      cursorLabel.classList.remove('on');
    });
  });

  // videos de las tarjetas: solo se reproducen en pantalla
  document.querySelectorAll('.card video').forEach(v => {
    if (reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
    new IntersectionObserver(([e]) => { e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }).observe(v);
  });

  const lb = document.getElementById('lightbox');
  const track = lb.querySelector('.lb-track');
  const count = lb.querySelector('.lb-count');
  let figs = [];
  function openProject(id) {
    const p = PROJECTS[id]; if (!p) return;
    lb.querySelector('.lb-title').textContent = p.title;
    lb.querySelector('.lb-tags').textContent = p.tags;
    lb.querySelector('.lb-text').textContent = p.text;
    track.innerHTML = '';
    figs = p.media.map((m, i) => {
      const fig = document.createElement('figure');
      if (m.placeholder) {
        fig.innerHTML = `<div class="ph-slide">${m.placeholder}</div>`;
      } else if (m.video) {
        fig.innerHTML = `<video src="${m.src}" muted loop playsinline autoplay preload="metadata"></video>`;
      } else {
        fig.innerHTML = `<img src="${m.src}" alt="${p.title} — imagen ${i + 1}" loading="${i < 3 ? 'eager' : 'lazy'}">`;
      }
      track.appendChild(fig);
      return fig;
    });
    track.scrollLeft = 0;
    updateCount();
    lb.showModal();
    document.documentElement.style.overflow = 'hidden';
    cursorLabel.classList.remove('on');
  }
  function current() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bd = Infinity;
    figs.forEach((f, i) => { const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function updateCount() { count.textContent = figs.length ? `${current() + 1} / ${figs.length}` : ''; }
  function go(dir) {
    const i = clamp(current() + dir, 0, figs.length - 1), f = figs[i];
    track.scrollTo({ left: f.offsetLeft - (track.clientWidth - f.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }
  track.addEventListener('scroll', () => requestAnimationFrame(updateCount), { passive: true });
  lb.querySelector('.lb-prev').addEventListener('click', () => go(-1));
  lb.querySelector('.lb-next').addEventListener('click', () => go(1));
  lb.querySelector('.lb-close').addEventListener('click', () => lb.close());
  lb.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  lb.addEventListener('close', () => { track.querySelectorAll('video').forEach(v => v.pause()); document.documentElement.style.overflow = ''; });
  // las imágenes cargan después: recalcular el contador
  track.addEventListener('load', updateCount, true);

  /* ---------------- contacto ---------------- */
  const toast = document.querySelector('.toast');
  let toastTimer;
  function say(msg) {
    toast.textContent = msg; toast.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), 2200);
  }
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); say('¡correo copiado! ✻'); }
    catch { say(b.dataset.copy); }
  }));

  // la cuerda se mece y sigue un poquito al cursor
  const cuerda = document.querySelector('.cuerda');
  if (cuerda && !reduced) {
    let dx = 0, dy = 0;
    whileVisible(cuerda, (dt, t) => {
      const r = cuerda.getBoundingClientRect();
      const tx = pointer.x > -999 ? clamp((pointer.x - (r.left + r.width / 2)) * 0.03, -18, 18) : 0;
      const ty = pointer.y > -999 ? clamp((pointer.y - (r.top + r.height / 2)) * 0.03, -18, 18) : 0;
      dx = lerp(dx, tx, 0.04); dy = lerp(dy, ty, 0.04);
      cuerda.style.setProperty('--sway', `${(Math.sin(t * 0.7) * 2.2 + scrollV * 0.002).toFixed(2)}deg`);
      cuerda.style.setProperty('--dx', `${dx.toFixed(1)}px`);
      cuerda.style.setProperty('--dy', `${dy.toFixed(1)}px`);
    });
  }
})();
