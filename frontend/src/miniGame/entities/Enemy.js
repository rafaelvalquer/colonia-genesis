// src/entities/Enemy.js

import { enemyTypes, enemyAnimations } from "./EnemyTypes.js";

console.log("Criando inimigo do tipo:", enemyTypes);

export class Enemy {
  constructor(tipo, row, x = 1024) {
    const config = enemyTypes[tipo];
    console.log(config);

    // ---- guarde a config na instância (para CollisionManager ler) ----
    this.config = config;

    this.id = Date.now();
    this.tipo = tipo;
    this.row = row;
    this.hp = config.hp;
    this.maxHp = config.hp;
    this.speed = config.speed;
    this.baseSpeed = this.speed;
    this.dano = config.dano;
    this.cooldown = config.cooldown;
    this.cooldownOnFinish = config.cooldownOnFinish ?? config.cooldown;

    this.alcance = config.alcance ?? 20;
    this.cor = config.cor;
    this.x = x;
    this.hitTimer = 0;

    // Controle de ataque (timer que de fato conta pra atacar de novo)
    this.cooldownTimer = 0;

    // >>> expose também os campos usados na resolveHitFrames (opcional, mas útil)
    this.hitFrame = config.hitFrame; // ex.: 18
    this.hitFrameIndexBase = config.hitFrameIndexBase ?? 0; // 0 (default) ou 1

    // estado/anim
    this.state = "walking";
    this.framesByState = enemyAnimations[tipo];
    this.animacoes = config.animacoes; // se você quiser ler daqui
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

  // src/entities/Enemy.js

  updateAnimation() {
    const animCfg = this.animacoes?.[this.state] || { frameInterval: 8 };
    const frames = this.framesByState?.[this.state] || [];
    const interval = animCfg.frameInterval || 8;

    this.frameTick++;
    if (this.frameTick >= interval) {
      this.frameTick = 0;
      this.frameIndex++;

      // 👇 Apenas faz wrap; NÃO muda o estado aqui
      const len = frames.length || 1;
      if (this.frameIndex >= len) {
        this.frameIndex = 0; // loop
      }
    }
  }
}
