// src/entities/Enemy.js

import { enemyTypes, enemyAnimations } from "./EnemyTypes.js";

console.log("Criando inimigo do tipo:", enemyTypes);

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

    // Animação
    this.frames = enemyAnimations[tipo];
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameRate = 3;
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

    // animação
    this.frameTimer++;
    if (this.frameTimer >= this.frameRate) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }

    if (this.hitTimer > 0) this.hitTimer -= 1;
  }
}
