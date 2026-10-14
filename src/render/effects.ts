import * as THREE from 'three';
import type { CineFx } from '../sim/ultimates';
import { makeCanvasTexture } from './ps1Material';

/** Hit sparks, block sparks, dust: pooled additive sprites. */

interface Particle {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
  gravity: number;
  baseScale: number;
  /** circling particle (dizzy stars): centre, radius, angle, angular speed (rad/frame) */
  orbit?: { c: THREE.Vector3; r: number; a: number; w: number };
  /** drag per frame (0 = none) */
  drag: number;
  /** pop-in: scale overshoots then settles during the first frames */
  pop: boolean;
}

export type CineFxId = CineFx;

let glyphs: Record<'question' | 'exclaim' | 'star5' | 'drop' | 'vein' | 'web', THREE.Texture> | null = null;
function glyphTex() {
  if (glyphs) return glyphs;
  const text = (ch: string, fill: string) =>
    makeCanvasTexture(32, 32, (ctx, w, h) => {
      ctx.font = 'bold 28px Arial Black, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.strokeText(ch, w / 2, h / 2 + 2);
      ctx.fillStyle = fill;
      ctx.fillText(ch, w / 2, h / 2 + 2);
    });
  glyphs = {
    question: text('?', '#ffe040'),
    exclaim: text('!', '#ff3a2a'),
    star5: makeCanvasTexture(16, 16, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 3 : 7.5;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
    }),
    drop: makeCanvasTexture(8, 12, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.quadraticCurveTo(8, 8, 4, 11);
      ctx.quadraticCurveTo(0, 8, 4, 0);
      ctx.fill();
    }),
    // manga anger mark
    vein: makeCanvasTexture(24, 24, (ctx, w, h) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.translate(w / 2, h / 2);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(2, -9);
        ctx.quadraticCurveTo(2, -2, 9, -2);
        ctx.stroke();
      }
    }),
    web: makeCanvasTexture(32, 32, (ctx, w, h) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.translate(w / 2, h / 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }
      for (const r of [4, 8, 12]) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
      }
    }),
  };
  return glyphs;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

let textures: { star: THREE.Texture; dot: THREE.Texture; ring: THREE.Texture; puff: THREE.Texture } | null = null;
function tex() {
  if (textures) return textures;
  textures = {
    star: makeCanvasTexture(32, 32, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(3, 0);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }),
    dot: makeCanvasTexture(8, 8, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(2, 1, 4, 6);
      ctx.fillRect(1, 2, 6, 4);
    }),
    ring: makeCanvasTexture(32, 32, (ctx, w, h) => {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
      ctx.stroke();
    }),
    puff: makeCanvasTexture(16, 16, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }),
  };
  return textures;
}

export class Effects {
  readonly group = new THREE.Group();
  private parts: Particle[] = [];

  private spawn(
    map: THREE.Texture,
    color: THREE.ColorRepresentation,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    scale: number,
    life: number,
    opts: { grow?: number; gravity?: number; additive?: boolean; opacity?: number; drag?: number; pop?: boolean; orbit?: Particle['orbit'] } = {},
  ) {
    const mat = new THREE.SpriteMaterial({
      map,
      color,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: opts.opacity ?? 1,
      blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    mat.userData.o = opts.opacity ?? 1;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 10;
    this.group.add(sprite);
    this.parts.push({
      sprite,
      vel,
      life,
      max: life,
      grow: opts.grow ?? 0,
      gravity: opts.gravity ?? 0,
      baseScale: scale,
      drag: opts.drag ?? 0,
      pop: !!opts.pop,
      orbit: opts.orbit,
    });
    return sprite;
  }

  hit(x: number, y: number, strength: 'light' | 'medium' | 'heavy', counter: boolean, scale = 1, z = 0.35) {
    const t = tex();
    const p = new THREE.Vector3(x, y, z);
    const big = (strength === 'heavy' ? 1.6 : strength === 'medium' ? 1.2 : 0.9) * scale;
    const col = counter ? 0xff4030 : strength === 'heavy' ? 0xffa020 : strength === 'medium' ? 0xffd040 : 0xfff0a0;
    this.spawn(t.star, 0xffffff, p.clone(), new THREE.Vector3(), 0.55 * big, 7, { grow: 0.09 * big });
    this.spawn(t.star, col, p.clone(), new THREE.Vector3(), 0.8 * big, 9, { grow: 0.06 * big });
    this.spawn(t.ring, col, p.clone(), new THREE.Vector3(), 0.2, 10, { grow: 0.12 * big });
    const n = strength === 'heavy' ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.03 + Math.random() * 0.05) * big;
      this.spawn(t.dot, col, p.clone(), new THREE.Vector3(Math.cos(a) * s, Math.sin(a) * s + 0.02, (Math.random() - 0.5) * s), 0.06 + Math.random() * 0.05, 14 + Math.random() * 10, {
        gravity: 0.004,
      });
    }
  }

  block(x: number, y: number) {
    const t = tex();
    const p = new THREE.Vector3(x, y, 0.35);
    this.spawn(t.ring, 0x60c8ff, p.clone(), new THREE.Vector3(), 0.15, 9, { grow: 0.07 });
    this.spawn(t.star, 0xa0e0ff, p.clone(), new THREE.Vector3(), 0.4, 6, { grow: 0.02 });
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(t.dot, 0x80d8ff, p.clone(), new THREE.Vector3(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0), 0.05, 10, { gravity: 0.003 });
    }
  }

  /** Parry: big cyan ring + sparks */
  parry(x: number, y: number) {
    const t = tex();
    const p = new THREE.Vector3(x, y, 0.35);
    this.spawn(t.ring, 0x60e0ff, p.clone(), new THREE.Vector3(), 0.2, 14, { grow: 0.12 });
    this.spawn(t.ring, 0xffffff, p.clone(), new THREE.Vector3(), 0.1, 10, { grow: 0.08 });
    this.spawn(t.star, 0xa0f0ff, p.clone(), new THREE.Vector3(), 0.9, 8, { grow: 0.05 });
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(t.dot, 0x9ff0ff, p.clone(), new THREE.Vector3(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0), 0.06, 16, { gravity: 0.002 });
    }
  }

  dust(x: number, big = false) {
    const t = tex();
    const n = big ? 10 : 5;
    for (let i = 0; i < n; i++) {
      const dir = (Math.random() - 0.5) * 2;
      this.spawn(
        t.puff,
        0xb8a890,
        new THREE.Vector3(x + dir * 0.3, 0.08, (Math.random() - 0.5) * 0.4),
        new THREE.Vector3(dir * 0.02, 0.006 + Math.random() * 0.01, (Math.random() - 0.5) * 0.01),
        big ? 0.5 : 0.3,
        26 + Math.random() * 10,
        { grow: 0.015, additive: false, opacity: 0.7 },
      );
    }
  }

  aura(pos: THREE.Vector3) {
    const t = tex();
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.2;
      this.spawn(
        t.puff,
        Math.random() < 0.5 ? 0xff8020 : 0xffd040,
        new THREE.Vector3(pos.x + Math.cos(a) * r, 0.2 + Math.random() * 1.6, Math.sin(a) * r),
        new THREE.Vector3(0, 0.02 + Math.random() * 0.02, 0),
        0.25,
        20,
        { grow: -0.008 },
      );
    }
  }

  /**
   * BBL MAX cinematic effects. `pos` = anchor (usually the chest or head of a character),
   * `dir` = +1/-1 the attacker's facing (for directional effects).
   */
  cine(fx: CineFxId, pos: THREE.Vector3, scale = 1, dir = 1) {
    const t = tex();
    const g = glyphTex();
    const P = () => pos.clone();
    const k = scale;
    switch (fx) {
      case 'explosion': {
        this.spawn(t.star, 0xffffff, P(), new THREE.Vector3(), 0.7 * k, 7, { grow: 0.06 * k });
        this.spawn(t.ring, 0xffc040, P(), new THREE.Vector3(), 0.3 * k, 14, { grow: 0.12 * k });
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = rnd(0.008, 0.032) * k;
          const v = new THREE.Vector3(Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp + 0.008, rnd(-0.015, 0.015));
          this.spawn(t.puff, Math.random() < 0.5 ? 0xff6a10 : 0xffc030, P(), v, rnd(0.25, 0.45) * k, rnd(16, 26), { grow: 0.012 * k, drag: 0.05 });
        }
        for (let i = 0; i < 10; i++) {
          const v = new THREE.Vector3(rnd(-0.02, 0.02) * k, rnd(0.01, 0.03), rnd(-0.01, 0.01));
          this.spawn(t.puff, 0x3a3634, P().add(new THREE.Vector3(rnd(-0.25, 0.25) * k, rnd(0, 0.3) * k, 0)), v, rnd(0.35, 0.55) * k, rnd(50, 70), {
            grow: 0.008 * k,
            additive: false,
            opacity: 0.75,
            drag: 0.03,
          });
        }
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = rnd(0.04, 0.09) * k;
          this.spawn(t.dot, 0xffa040, P(), new THREE.Vector3(Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp, rnd(-0.03, 0.03)), 0.07, rnd(20, 34), { gravity: 0.004 });
        }
        break;
      }
      case 'muzzle':
        this.spawn(t.star, 0xfff2a0, P(), new THREE.Vector3(), 0.45 * k, 4, { grow: 0.04 });
        this.spawn(t.puff, 0xffa020, P(), new THREE.Vector3(), 0.3 * k, 5);
        this.spawn(t.puff, 0x8a8478, P(), new THREE.Vector3(rnd(-0.004, 0.004), 0.008, 0), 0.12 * k, 18, { grow: 0.01, additive: false, opacity: 0.5 });
        break;
      case 'poof':
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const v = new THREE.Vector3(Math.cos(a) * 0.022 * k, Math.sin(a) * 0.016 * k + 0.004, rnd(-0.01, 0.01));
          this.spawn(t.puff, 0xf2f0ea, P().add(new THREE.Vector3(rnd(-0.1, 0.1), rnd(-0.4, 0.4) * k, rnd(-0.1, 0.1))), v, rnd(0.45, 0.7) * k, rnd(26, 36), {
            grow: 0.012 * k,
            additive: false,
            opacity: 0.95,
            drag: 0.06,
          });
        }
        this.spawn(t.star, 0xffffff, P(), new THREE.Vector3(), 0.6 * k, 6, { grow: 0.05 });
        break;
      case 'powerAura': {
        this.spawn(t.ring, 0xffe040, P(), new THREE.Vector3(), 0.3 * k, 16, { grow: 0.16 * k });
        this.spawn(t.star, 0xfff8c0, P(), new THREE.Vector3(), 1.4 * k, 10, { grow: 0.08 * k });
        for (let i = 0; i < 26; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = rnd(0.25, 0.5) * k;
          const base = new THREE.Vector3(pos.x + Math.cos(a) * r, pos.y + rnd(-1.1, 0.7) * k, pos.z + Math.sin(a) * r);
          this.spawn(t.puff, Math.random() < 0.6 ? 0xffd030 : 0xfff090, base, new THREE.Vector3(0, rnd(0.03, 0.06), 0), rnd(0.25, 0.4) * k, rnd(20, 32), {
            grow: -0.006,
          });
        }
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          this.spawn(t.dot, 0xffffa0, P(), new THREE.Vector3(Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0), 0.06, 20, { drag: 0.04 });
        }
        break;
      }
      case 'stars':
        for (let i = 0; i < 5; i++) {
          this.spawn(g.star5, 0xffe040, P(), new THREE.Vector3(), 0.13 * k, 150, {
            orbit: { c: P(), r: 0.22 * k, a: (i / 5) * Math.PI * 2, w: 0.09 },
          });
        }
        break;
      case 'sweat':
        for (let i = 0; i < 5; i++) {
          const a = rnd(0.3, 2.8);
          this.spawn(g.drop, 0xb8e0ff, P().add(new THREE.Vector3(Math.cos(a) * 0.12, 0.05, 0.1)), new THREE.Vector3(Math.cos(a) * 0.02, Math.sin(a) * 0.025 + 0.01, 0.005), 0.08 * k, 30, {
            gravity: 0.0018,
            additive: false,
          });
        }
        break;
      case 'question':
      case 'exclaim': {
        const sp = this.spawn(fx === 'question' ? g.question : g.exclaim, 0xffffff, P(), new THREE.Vector3(0, 0.002, 0), 0.38 * k, 70, { additive: false, pop: true });
        sp.renderOrder = 11;
        break;
      }
      case 'shine':
        this.spawn(t.star, 0xffffff, P(), new THREE.Vector3(), 0.1, 18, { grow: 0.05 * k });
        this.spawn(g.star5, 0xfff8d0, P(), new THREE.Vector3(), 0.25 * k, 22, { pop: true });
        for (let i = 0; i < 4; i++) {
          this.spawn(g.star5, 0xffffff, P().add(new THREE.Vector3(rnd(-0.25, 0.25), rnd(-0.2, 0.25), 0.05)), new THREE.Vector3(0, 0.003, 0), 0.08 * k, rnd(16, 26), {
            pop: true,
          });
        }
        break;
      case 'smoke':
        for (let i = 0; i < 8; i++) {
          this.spawn(t.puff, 0x5a5652, P().add(new THREE.Vector3(rnd(-0.2, 0.2), rnd(-0.1, 0.2), 0)), new THREE.Vector3(rnd(-0.004, 0.004), rnd(0.006, 0.014), 0), rnd(0.35, 0.55) * k, rnd(60, 90), {
            grow: 0.008,
            additive: false,
            opacity: 0.6,
          });
        }
        break;
      case 'confetti': {
        const cols = [0xff4060, 0x40c0ff, 0xffe040, 0x60ff80, 0xff80ff, 0xffffff];
        for (let i = 0; i < 40; i++) {
          const a = rnd(Math.PI * 0.15, Math.PI * 0.85);
          const sp = rnd(0.04, 0.09) * k;
          this.spawn(t.dot, cols[i % cols.length], P(), new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp, rnd(-0.03, 0.03)), 0.06, rnd(50, 80), {
            gravity: 0.0016,
            drag: 0.03,
            additive: false,
          });
        }
        break;
      }
      case 'pain':
        this.spawn(t.star, 0xff2a2a, P(), new THREE.Vector3(), 0.3 * k, 12, { grow: 0.05 * k });
        this.spawn(t.ring, 0xff5040, P(), new THREE.Vector3(), 0.1, 12, { grow: 0.06 * k });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          this.spawn(t.dot, 0xff4030, P(), new THREE.Vector3(Math.cos(a) * 0.035, Math.sin(a) * 0.035, 0), 0.07, 14, { drag: 0.08 });
        }
        break;
      case 'veins': {
        const sp = this.spawn(g.vein, 0xff2020, P().add(new THREE.Vector3(0.12 * dir, 0.12, 0.12)), new THREE.Vector3(), 0.22 * k, 40, { additive: false, pop: true });
        sp.renderOrder = 11;
        for (let i = 0; i < 6; i++) {
          this.spawn(t.puff, 0xffffff, P().add(new THREE.Vector3(rnd(-0.2, 0.2), rnd(-0.1, 0.1), 0)), new THREE.Vector3(rnd(-0.01, 0.01), rnd(0.015, 0.03), 0), 0.25 * k, rnd(24, 36), {
            grow: 0.01,
            additive: false,
            opacity: 0.7,
          });
        }
        break;
      }
      case 'web':
        this.spawn(g.web, 0xffffff, P(), new THREE.Vector3(), 0.2 * k, 60, { grow: 0.05 * k, additive: false });
        break;
      case 'speed':
        for (let i = 0; i < 10; i++) {
          const v = new THREE.Vector3(-dir * rnd(0.03, 0.08), rnd(0, 0.006), rnd(-0.01, 0.01));
          this.spawn(t.puff, i % 2 ? 0xd8d0c0 : 0xffffff, P().add(new THREE.Vector3(0, rnd(-0.9, 0.6), rnd(-0.2, 0.2))), v, rnd(0.15, 0.3) * k, rnd(10, 18), {
            additive: false,
            opacity: 0.7,
          });
        }
        this.dust(pos.x, false);
        break;
    }
  }

  /** one smoke puff (rocket trail) */
  trail(pos: THREE.Vector3) {
    const t = tex();
    this.spawn(t.puff, 0xd0ccc4, pos.clone(), new THREE.Vector3(rnd(-0.003, 0.003), 0.004, 0), 0.18, 30, { grow: 0.01, additive: false, opacity: 0.6 });
    this.spawn(t.puff, 0xffa020, pos.clone(), new THREE.Vector3(), 0.12, 4);
  }

  update(dtFrames: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dtFrames;
      if (p.life <= 0) {
        this.group.remove(p.sprite);
        p.sprite.material.dispose();
        this.parts.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dtFrames;
      if (p.drag) p.vel.multiplyScalar(Math.pow(1 - p.drag, dtFrames));
      if (p.orbit) {
        const o = p.orbit;
        o.a += o.w * dtFrames;
        p.sprite.position.set(o.c.x + Math.cos(o.a) * o.r, o.c.y + Math.sin(o.a * 2) * 0.03, o.c.z + Math.sin(o.a) * o.r * 0.6);
      } else {
        p.sprite.position.addScaledVector(p.vel, dtFrames);
      }
      if (p.pop) {
        const age = p.max - p.life;
        const t = Math.min(1, age / 8);
        p.sprite.scale.setScalar(p.baseScale * (t < 1 ? 0.2 + 1.2 * Math.sin(t * Math.PI * 0.75) : 1));
      } else {
        const s = Math.max(0.01, p.sprite.scale.x + p.grow * dtFrames);
        p.sprite.scale.setScalar(s);
      }
      const k = p.life / p.max;
      p.sprite.material.opacity = Math.min(1, k * 1.6) * (p.sprite.material.userData.o ?? 1);
    }
  }

  clear() {
    for (const p of this.parts) {
      this.group.remove(p.sprite);
      p.sprite.material.dispose();
    }
    this.parts.length = 0;
  }
}
