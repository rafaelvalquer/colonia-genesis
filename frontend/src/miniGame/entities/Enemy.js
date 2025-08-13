// src/entities/Enemy.js

import { enemyTypes, enemyAnimations } from "./EnemyTypes.js";

console.log("Criando inimigo do tipo:", enemyTypes);

export class Enemy {
  constructor(tipo, row, x = 1024) {
    const config = enemyTypes[tipo];
    console.log(config);
    this.id = Date.now();
    this.tipo = tipo;
    this.row = row;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.baseSpeed = this.speed;
    this.dano = config.dano;
    this.cooldown = config.cooldown;
    this.alcance = config.alcance || 20;
    this.cor = config.cor;
    this.x = x;
    this.hitTimer = 0;

    // Controle de ataque
    this.cooldownTimer = 0; // frames até próximo ataque

    // estado/anim
    this.state = "walking";
    this.framesByState = enemyAnimations[tipo];
    this.frameIndex = 0;
    this.frameTick = 0;
  }

  takeDamage(dano = 1) {
    this.hp -= dano;
    this.hitTimer = 5;
  }

  isDead() {
    return this.hp <= 0 || this.x <= 0;
  }

  canAttack() {
    return this.cooldownTimer <= 0;
  }

  attack(tropa) {
    if (!this.canAttack()) return;
    // aplica dano
    tropa.takeDamage(this.dano);

    // inicia cooldown e coloca no estado "attack" (anim de ataque toca agora)
    this.cooldownTimer = this.cooldown;
    this.state = "attack";
    this.frameIndex = 0;
    this.frameTick = 0;
  }

  updatePosition() {
    // reduz cooldown de ataque
    if (this.cooldownTimer > 0) this.cooldownTimer--;

    // move apenas quando está "walking"
    if (this.state === "walking") {
      this.x -= this.speed;
    }

    // se está em cooldown e não tem alvo naquele frame, pode ficar idle
    if (this.cooldownTimer > 0 && this.state !== "attack") {
      this.state = "idle";
    }

    if (this.hitTimer > 0) this.hitTimer--;

    // animação por estado
    this.updateAnimation();
  }

  updateAnimation() {
    const animCfg = enemyTypes[this.tipo].animacoes?.[this.state] || {
      frameInterval: 8,
    };
    const frames = this.framesByState?.[this.state] || [];
    const interval = animCfg.frameInterval || 8;

    this.frameTick++;
    if (this.frameTick >= interval) {
      this.frameTick = 0;
      this.frameIndex++;

      if (this.frameIndex >= frames.length) {
        // se acabou o ataque, volta para idle (ou walking será setado pelo CollisionManager)
        if (this.state === "attack") {
          this.state = "idle";
        }
        this.frameIndex = 0;
      }
    }
  }
}
