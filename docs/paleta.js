/* =========================================================
   paleta.js — ayuda para probar colores mientras se decide la paleta.
   Cambia las variables CSS en vivo (fondo, tinta y acentos), guarda la
   elección en el navegador y avisa al hilo para que se redibuje.
   Para quitarla: borrar este archivo y su <script> en el pie.
   ========================================================= */
(() => {
  'use strict';
  const KEY = 'nudo-paleta';
  const VARS = [
    ['--rosa', 'fondo'], ['--vino', 'tinta'], ['--lila', 'lila'], ['--naranja', 'naranja'], ['--verde', 'verde'],
  ];
  const PRESETS = {
    rosa:   { '--rosa': '#ffdada', '--vino': '#701d3b', '--lila': '#e2a2d4', '--naranja': '#d8694e', '--verde': '#384f49' },
    crema:  { '--rosa': '#f5ecdf', '--vino': '#701d3b', '--lila': '#e2a2d4', '--naranja': '#d8694e', '--verde': '#384f49' },
    hueso:  { '--rosa': '#f8f3ec', '--vino': '#701d3b', '--lila': '#e2a2d4', '--naranja': '#d8694e', '--verde': '#384f49' },
    lino:   { '--rosa': '#efe6d6', '--vino': '#5e1a32', '--lila': '#d99ac9', '--naranja': '#d8694e', '--verde': '#384f49' },
    oscuro: { '--rosa': '#701d3b', '--vino': '#ffdada', '--lila': '#e2a2d4', '--naranja': '#f0a08c', '--verde': '#bcd1c9' },
  };
  const root = document.documentElement;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

  function apply(vals) {
    VARS.forEach(([v]) => vals && vals[v] ? root.style.setProperty(v, vals[v]) : root.style.removeProperty(v));
    // «rosa-2» es el fondo un poco más oscuro (marcos vacíos)
    if (vals && vals['--rosa']) root.style.setProperty('--rosa-2', mix(vals['--rosa'], vals['--vino'] || '#701d3b', 0.1));
    else root.style.removeProperty('--rosa-2');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vals?.['--rosa'] || '#ffdada');
    dispatchEvent(new Event('nudo:theme'));
    sync();
  }
  function mix(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('');
  }
  function current() {
    const out = {};
    VARS.forEach(([v]) => { out[v] = getComputedStyle(root).getPropertyValue(v).trim(); });
    return out;
  }

  // ---- panel
  const btn = document.createElement('button');
  btn.className = 'paleta-btn'; btn.type = 'button'; btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = 'colores <svg class="ast"><use href="#ast"/></svg>';
  const panel = document.createElement('div');
  panel.className = 'paleta'; panel.hidden = true; panel.id = 'paleta';
  btn.setAttribute('aria-controls', 'paleta');
  panel.innerHTML = `
    <h2>probar colores</h2>
    <div class="presets">${Object.keys(PRESETS).map(k => `<button type="button" data-preset="${k}">${k}</button>`).join('')}</div>
    ${VARS.map(([v, label]) => `<label>${label} <code data-code="${v}"></code> <input type="color" data-var="${v}"></label>`).join('')}
    <button type="button" class="reset">volver a la paleta original</button>`;
  document.body.append(btn, panel);

  function sync() {
    const c = current();
    panel.querySelectorAll('input[data-var]').forEach(i => { i.value = c[i.dataset.var] || '#000000'; });
    panel.querySelectorAll('code[data-code]').forEach(e => { e.textContent = c[e.dataset.code]; });
    const saved = load();
    panel.querySelectorAll('[data-preset]').forEach(b => {
      const p = PRESETS[b.dataset.preset];
      b.setAttribute('aria-pressed', VARS.every(([v]) => (saved?.[v] || PRESETS.rosa[v]) === p[v]));
    });
  }
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', !panel.hidden); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (b) { const v = { ...PRESETS[b.dataset.preset] }; save(b.dataset.preset === 'rosa' ? null : v); apply(v); }
    if (e.target.closest('.reset')) { save(null); apply(null); }
  });
  panel.addEventListener('input', e => {
    const i = e.target.closest('input[data-var]'); if (!i) return;
    const v = { ...(load() || PRESETS.rosa), [i.dataset.var]: i.value };
    save(v); apply(v);
  });

  const saved = load();
  if (saved) apply(saved); else sync();
})();
