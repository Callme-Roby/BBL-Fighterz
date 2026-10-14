import * as THREE from 'three';
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
}

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
    opts: { grow?: number; gravity?: number; additive?: boolean; opacity?: number } = {},
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
    this.parts.push({ sprite, vel, life, max: life, grow: opts.grow ?? 0, gravity: opts.gravity ?? 0, baseScale: scale });
  }

  hit(x: number, y: number, strength: 'light' | 'medium' | 'heavy', counter: boolean) {
    const t = tex();
    const p = new THREE.Vector3(x, y, 0.35);
    const big = strength === 'heavy' ? 1.6 : strength === 'medium' ? 1.2 : 0.9;
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
      p.sprite.position.addScaledVector(p.vel, dtFrames);
      const s = Math.max(0.01, p.sprite.scale.x + p.grow * dtFrames);
      p.sprite.scale.setScalar(s);
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
