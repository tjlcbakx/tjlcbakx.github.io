// ui.js — tiny DOM helpers shared by every interactive. No framework: this
// is the whole "component library".

export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

// A labelled range input. Keyboard arrows work for free — accessibility floor.
export function slider({ label, min, max, step, value, format = (v) => v.toFixed(2), oninput, onchange }) {
  const out = el('span', { class: 'readout', text: format(value) });
  const input = el('input', {
    type: 'range', min, max, step, value,
    'aria-label': label,
  });
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = format(v);
    oninput?.(v);
  });
  if (onchange) input.addEventListener('change', () => onchange(parseFloat(input.value)));
  const wrap = el('label', { class: 'slider' }, [
    el('span', { class: 'slider-label', html: label }), out, input,
  ]);
  wrap.input = input;
  wrap.set = (v) => { input.value = v; out.textContent = format(v); };
  return wrap;
}

export function button(text, onclick, opts = {}) {
  return el('button', { type: 'button', class: opts.class || 'btn', onclick, ...opts.attrs }, [text]);
}

// The live status line under an interactive. Every audio cue writes here too:
// a player with sound off, or a screen-reader user, loses charm, not
// information (SONIFICATION.md §4, SCOPE.md O5).
export class Status {
  constructor(node) {
    this.node = node;
    this.node.setAttribute('role', 'status');
    this.node.setAttribute('aria-live', 'polite');
  }

  set(text) { this.node.textContent = text; }

  // A captioned audio cue: shown as text, prefixed with a speaker glyph.
  cue(text) {
    this.node.innerHTML = '';
    this.node.append(el('span', { class: 'cue', text: '♪' }), ' ' + text);
  }
}

export const fmtZ = (z) => z.toFixed(2);
