// src/minigames/explorador-fov/engine/CollisionManager.js

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rpx = bx - ax,
    rpy = by - ay;
  const spx = dx - cx,
    spy = dy - cy;
  const denom = rpx * spy - rpy * spx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((cx - ax) * spy - (cy - ay) * spx) / denom;
  const u = ((cx - ax) * rpy - (cy - ay) * rpx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + t * rpx, y: ay + t * rpy, t, u };
}

function segVsCircle(px1, py1, px2, py2, cx, cy, r) {
  const vx = px2 - px1,
    vy = py2 - py1;
  const wx = cx - px1,
    wy = cy - py1;
  const vv = vx * vx + vy * vy || 1e-8;
  let t = (vx * wx + vy * wy) / vv;
  t = Math.max(0, Math.min(1, t));
  const nx = px1 + t * vx,
    ny = py1 + t * vy;
  const dist2 = (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy);
  return dist2 <= r * r ? { t, x: nx, y: ny } : null;
}

export function stepProjectiles({
  projectiles,
  walls,
  enemies,
  dt,
  bulletDamage = 4,
}) {
  const killed = []; // {idx, xp}
  for (const b of projectiles) {
    if (b.dead) continue;

    const prevX = b.x,
      prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    b.travel += Math.hypot(b.x - prevX, b.y - prevY);

    // parede
    for (const s of walls) {
      if (segIntersect(prevX, prevY, b.x, b.y, s.x1, s.y1, s.x2, s.y2)) {
        b.dead = true;
        break;
      }
    }
    if (b.dead) continue;

    // inimigos
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.__dead) continue;
      const hit = segVsCircle(prevX, prevY, b.x, b.y, e.x, e.y, e.r + b.r);
      if (hit) {
        e.hp = (e.hp ?? 1) - bulletDamage;
        b.dead = true; // sem penetração
        if (e.hp <= 0) {
          e.__dead = true;
          killed.push({ idx: i, xp: e.xp ?? 0 });
        }
        break;
      }
    }

    if (b.life <= 0 || b.travel > (b.maxDist || 1000)) b.dead = true;
  }
  return { killed };
}
