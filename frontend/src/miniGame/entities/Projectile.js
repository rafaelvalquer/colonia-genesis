// src/entities/Projectile.js
export class Projectile {
  constructor(data = {}) {
    // copia tudo que vier (dano, tipo, row, etc.)
    Object.assign(this, data);

    // suporte a vx/vy (novo) e dx/dy (legado)
    this.vx = data.vx ?? data.dx ?? 0;
    this.vy = data.vy ?? data.dy ?? 0;

    this.radius = data.radius ?? 5;
    this.active = data.active ?? true;

    // limites do mundo (em coords do mapa) — opcionais
    this.bounds = data.bounds || null;

    // info de escala pra colisão (usar a altura real de tile)
    this.tileH = data.tileH ?? 64;

    // TTL em ticks (não ms). 300 ticks ~ ~10s se seu loop é ~32ms
    this.ticks = 0;
    this.maxTicks = data.maxTicks ?? 300;
  }

  update() {
    if (!this.active) return;

    this.x += this.vx;
    this.y += this.vy;

    this.ticks++;
    if (this.ticks > this.maxTicks) {
      this.active = false;
      return;
    }

    // NÃO colidir com “parede”/tile; só respeitar limites amplos se fornecidos
    if (this.bounds) {
      const { minX = -1e6, maxX = 1e6, minY = -1e6, maxY = 1e6 } = this.bounds;
      if (
        this.x < minX - this.radius ||
        this.x > maxX + this.radius ||
        this.y < minY - this.radius ||
        this.y > maxY + this.radius
      ) {
        this.active = false;
      }
    }
  }

  checkCollision(enemy) {
    if (!this.active) return;
    // (opcional) gate por linha
    if (this.row != null && enemy.row != null && enemy.row !== this.row) return;

    // centro aproximado do inimigo na linha
    const enemyCenterX = enemy.x;
    const enemyCenterY = enemy.row * this.tileH + this.tileH / 2;

    // raio do inimigo (ajuste fino se quiser no Enemy: enemy.hitRadius)
    const enemyR = enemy.hitRadius ?? this.tileH * 0.35;

    const dx = enemyCenterX - this.x;
    const dy = enemyCenterY - this.y;
    const r = this.radius + enemyR;

    if (dx * dx + dy * dy <= r * r) {
      // aplica dano e desativa
      enemy.takeDamage?.(this.dano ?? 1, this);
      this.active = false;
    }
  }
}
