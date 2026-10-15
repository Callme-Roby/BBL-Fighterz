import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { input } from '../input/input';
import { inviteUrl, NET_VERSION, NetLink, preloadNet, type NetMsg } from '../net/peer';
import { Showroom } from '../render/showroom';
import { h, Menu, uiRoot } from '../ui/dom';
import { goMenu, goSelect } from './flow';

/** Online lobby: create a room (share the link) or join one. */
export class OnlineScreen implements Screen {
  private menu: Menu | null = null;
  private body!: HTMLElement;
  private link: NetLink | null = null;
  private showroom = new Showroom();
  private leaving = false;

  constructor(
    private app: App,
    private autoJoin?: string,
  ) {}

  enter() {
    audio.playMusic('select');
    // the network code is downloaded while the player reads the menu
    preloadNet().catch(() => undefined);
    this.body = h('div', { class: 'screen dim online-screen' });
    uiRoot().append(this.body);
    if (this.autoJoin) this.join(this.autoJoin);
    else this.home();
  }

  exit() {
    this.showroom.dispose();
    if (this.leaving) this.link?.close();
  }

  private home() {
    this.menu = new Menu(
      [
        { label: 'CRÉER UNE PARTIE', sub: 'Génère un lien à envoyer à ton pote', action: () => this.host() },
        { label: 'REJOINDRE', sub: "Colle le lien ou le code reçu", action: () => this.askCode() },
        { label: 'RETOUR', action: () => goMenu() },
      ],
      () => audio.sfx('cursor'),
    );
    this.body.replaceChildren(
      h('div', { class: 'h1' }, 'EN LIGNE'),
      h('div', { class: 'status' }, 'Connexion directe entre vos deux navigateurs (pair-à-pair). Joue avec quelqu’un pas trop loin pour une latence minimale !'),
      this.menu.el,
    );
  }

  private setStatus(text: string, err = false) {
    const el = this.body.querySelector('.status');
    if (el) {
      el.textContent = text;
      el.classList.toggle('err', err);
    }
  }

  private async host() {
    this.menu = null;
    this.body.replaceChildren(h('div', { class: 'h1' }, 'CRÉER UNE PARTIE'), h('div', { class: 'status blink' }, 'Connexion…'));
    try {
      const link = await NetLink.host((s) => this.setStatus(s));
      this.link = link;
      this.leaving = true;
      const url = inviteUrl(link.code);
      const field = h('input', { value: url, readOnly: true });
      const copy = h('button', { class: 'btn primary' }, 'COPIER');
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copy.textContent = 'COPIÉ !';
        } catch {
          field.select();
          document.execCommand?.('copy');
          copy.textContent = 'COPIÉ !';
        }
      });
      const share = h('button', { class: 'btn' }, 'PARTAGER');
      share.addEventListener('click', () => {
        void navigator.share?.({ title: 'BBL FIGHTERZ', text: 'Viens te battre sur BBL FIGHTERZ !', url }).catch(() => undefined);
      });
      const back = h('button', { class: 'btn' }, 'ANNULER');
      back.addEventListener('click', () => goMenu());
      this.body.replaceChildren(
        h('div', { class: 'h1' }, 'ENVOIE CE LIEN'),
        h('div', { class: 'share' }, field, copy, typeof navigator.share === 'function' ? share : null),
        h('div', { class: 'title-hint' }, 'CODE : ', h('b', { style: 'color:var(--orange2);font-size:18px' }, link.code.toUpperCase())),
        h('div', { class: 'status blink' }, "En attente de l'adversaire…"),
        back,
      );
      await link.waitForGuest();
      this.connected(link);
    } catch (e) {
      this.fail(e);
    }
  }

  private askCode() {
    this.menu = null;
    const field = h('input', { placeholder: 'Lien ou code (ex : k7m2pq)', autocomplete: 'off', spellcheck: false });
    const go = h('button', { class: 'btn primary' }, 'REJOINDRE');
    const submit = () => {
      const v = field.value.trim();
      const m = v.match(/[?&]room=([a-z0-9]+)/i);
      const code = (m ? m[1] : v).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (code.length >= 4) this.join(code);
      else this.setStatus('Code invalide.', true);
    };
    go.addEventListener('click', submit);
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') this.home();
    });
    const back = h('button', { class: 'btn' }, 'RETOUR');
    back.addEventListener('click', () => this.home());
    this.body.replaceChildren(h('div', { class: 'h1' }, 'REJOINDRE'), h('div', { class: 'share' }, field, go), h('div', { class: 'status' }, ''), back);
    setTimeout(() => field.focus(), 50);
  }

  private async join(code: string) {
    this.menu = null;
    this.body.replaceChildren(h('div', { class: 'h1' }, 'REJOINDRE'), h('div', { class: 'status blink' }, 'Connexion…'));
    try {
      const link = await NetLink.join(code, (s) => this.setStatus(s));
      this.link = link;
      this.leaving = true;
      // drop ?room= from the address bar
      history.replaceState(null, '', location.pathname);
      this.connected(link);
    } catch (e) {
      this.fail(e);
    }
  }

  private connected(link: NetLink) {
    link.send({ t: 'hello', version: NET_VERSION, name: 'BBL' });
    const off = link.on((m: NetMsg) => {
      if (m.t === 'hello' && m.version !== NET_VERSION) {
        this.setStatus("Versions du jeu différentes : rafraîchissez la page tous les deux.", true);
      }
    });
    audio.sfx('confirm');
    this.setStatus('Connecté !');
    this.leaving = false;
    setTimeout(() => {
      off();
      goSelect('online', link);
    }, 600);
  }

  private fail(e: unknown) {
    console.warn(e);
    const msg = e instanceof Error ? e.message : String(e);
    const nice = /unavailable-id|could not connect|peer-unavailable/i.test(msg) ? 'Partie introuvable : le lien a peut-être expiré.' : msg;
    const back = h('button', { class: 'btn' }, 'RETOUR');
    back.addEventListener('click', () => this.home());
    this.body.replaceChildren(h('div', { class: 'h1' }, 'OUPS'), h('div', { class: 'status err' }, nice), back);
    this.link?.close();
    this.link = null;
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (!this.menu) {
        if (e.action === 'back' && !document.activeElement?.matches('input')) {
          this.leaving = true;
          goMenu();
          return;
        }
        continue;
      }
      if (e.action === 'up') this.menu.move(-1);
      else if (e.action === 'down') this.menu.move(1);
      else if (e.action === 'confirm') {
        audio.sfx('confirm');
        this.menu.activate();
        return;
      } else if (e.action === 'back') {
        goMenu();
        return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
