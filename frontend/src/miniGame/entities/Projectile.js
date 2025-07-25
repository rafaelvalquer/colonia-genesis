// src/entities/Projectile.js

export class Projectile {
  constructor({ x, y, dx, row }) {
    this.id = Date.now();
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.row = row;
    this.active = true;
  }

  update() {
    this.x += this.dx;
    if (this.x > 1024) this.active = false;
  }

  checkCollision(enemy) {
    if (enemy.row === this.row && Math.abs(enemy.x - this.x) < 10) {
      enemy.takeDamage();
      this.active = false;
    }
  }
}
