type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript helper. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const uiRoot = () => document.getElementById('ui')!;

export function clearUi() {
  uiRoot().replaceChildren();
}

/**
 * Keyboard/gamepad-navigable vertical menu.
 * Returns the element plus helpers to move the selection from the screen's input handler.
 */
export interface MenuItem {
  label: string;
  sub?: string;
  action: () => void;
  disabled?: boolean;
}

export class Menu {
  readonly el: HTMLDivElement;
  index = 0;
  private buttons: HTMLButtonElement[] = [];

  constructor(
    private items: MenuItem[],
    private onMove?: () => void,
  ) {
    this.el = h('div', { class: 'menu' });
    this.render();
  }

  private render() {
    this.buttons = this.items.map((it, i) => {
      const b = h('button', { disabled: !!it.disabled }, it.label, it.sub ? h('span', { class: 'sub' }, it.sub) : null);
      b.addEventListener('mouseenter', () => this.select(i, false));
      b.addEventListener('click', () => {
        this.select(i, false);
        it.action();
      });
      return b;
    });
    this.el.replaceChildren(...this.buttons);
    this.select(this.index, false);
  }

  select(i: number, sound = true) {
    const n = this.items.length;
    let j = ((i % n) + n) % n;
    let guard = 0;
    while (this.items[j].disabled && guard++ < n) j = (j + (i >= this.index ? 1 : -1) + n) % n;
    if (j !== this.index && sound) this.onMove?.();
    this.index = j;
    this.buttons.forEach((b, k) => b.classList.toggle('sel', k === j));
  }

  move(d: number) {
    this.select(this.index + d);
  }

  activate() {
    const it = this.items[this.index];
    if (it && !it.disabled) it.action();
  }
}
