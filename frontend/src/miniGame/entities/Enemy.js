// src/entities/Enemy.js

export const enemyTypes = {
  fraco: { hp: 3, speed: 3, cor: "#aaffaa", dano: 1 },
  rapido: { hp: 2, speed: 5, cor: "#ffdd55", dano: 1 },
  tanque: { hp: 8, speed: 1, cor: "#ff5555", dano: 2 },
  elite: { hp: 12, speed: 2, cor: "#cc66ff", dano: 3 }, // exemplo novo
};

export class Enemy {
  constructor(tipo, row, x = 1024) {
    const config = enemyTypes[tipo];

    this.id = Date.now();
    this.tipo = tipo;
    this.row = row;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.dano = config.dano;
    this.cor = config.cor;
    this.x = x;
    this.hitTimer = 0;
  }

  takeDamage(dano = 1) {
    this.hp -= dano;
    this.hitTimer = 5;
  }

  isDead() {
    return this.hp <= 0 || this.x <= 0;
  }

  updatePosition() {
    this.x -= this.speed;
    if (this.hitTimer > 0) this.hitTimer -= 1;
  }
}
