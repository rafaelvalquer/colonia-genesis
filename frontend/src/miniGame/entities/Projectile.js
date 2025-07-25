// src/entities/Projectile.js

export class Projectile {
  constructor({ x, y, dx, row, tipo, dano }) {
    this.id = Date.now();
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.row = row;
    this.tipo = tipo;
    this.dano = dano;
    this.active = true;
  }

  update() {
    this.x += this.dx;
    if (this.x > 1024) this.active = false;
  }

  checkCollision(enemy) {
    if (enemy.row === this.row && Math.abs(enemy.x - this.x) < 10) {
      enemy.hp -= this.dano;
      this.active = false;
      enemy.hitTimer = 5;
      console.log(
        `Projectile (${this.tipo}) acertou inimigo: dano = ${this.dano}`
      );
    }
  }
}
