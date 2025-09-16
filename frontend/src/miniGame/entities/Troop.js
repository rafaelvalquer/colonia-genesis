// src/entities/Troop.js

import { loadTroopFrames } from "../assets/troop/loadTroopFrames";

export const troopTypes = {
  colono: {
    preco: 10,
    hp: 7,
    alcance: 1,
    cooldown: 20,
    dano: 4,
    retornaAoFinal: true,
    cor: "#8D6E63",
    projetil: "melee",
    corProjetil: "yellow",
    velocidadeProjetil: 6,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 25, frameInterval: 4 },
      attack: { frameCount: 37, frameInterval: 3 },
    },
    muzzle: {
      units: "spritePx", // interpreta offsets no espaço do sprite
      attack: { x: 200, y: -350 }, // ajuste fino por tropa
    },
    fireFrame: [7], // dispara projétil no frame 7 da animação de attack
    cooldownPerShot: true, // (opcional) faz o cooldown só depois do último frame
    deployCost: 3,
    deployCooldownMs: 4000,
  },
  guarda: {
    preco: 12,
    hp: 6,
    alcance: 5,
    cooldown: 12,
    dano: 2,
    retornaAoFinal: true,
    cor: "#8D6E63",
    projetil: "bola",
    corProjetil: "yellow",
    velocidadeProjetil: 8,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 25, frameInterval: 4 },
      attack: { frameCount: 37, frameInterval: 3 },
    },
    muzzle: {
      units: "spritePx", // interpreta offsets no espaço do sprite
      attack: { x: 200, y: -350 }, // ajuste fino por tropa
    },
    fireFrame: [7], // dispara projétil no frame 12 da animação de attack
    cooldownPerShot: true, // (opcional) faz o cooldown só depois do último frame
    deployCost: 4,
    deployCooldownMs: 5000,
  },
  marine: {
    preco: 15,
    hp: 8,
    alcance: 6,
    cooldown: 80,
    dano: 1,
    retornaAoFinal: true,
    cor: "#4FC3F7",
    projetil: "bola",
    corProjetil: "#B3E5FC",
    velocidadeProjetil: 6,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 29, frameInterval: 4 },
      attack: { frameCount: 47, frameInterval: 1 },
    },
    muzzle: {
      units: "spritePx",
      attack: { x: 200, y: -180 },
    },
    fireFrame: [8, 23, 38], // dispara projétil no frame 12 da animação de attack
    cooldownPerShot: false, // (opcional) faz o cooldown só depois do último frame
    deployCost: 5,
    deployCooldownMs: 5000,
  },
  sniper: {
    preco: 20,
    hp: 4,
    alcance: 7,
    cooldown: 100,
    dano: 4,
    retornaAoFinal: true,
    cor: "#F4511E",
    projetil: "bola",
    corProjetil: "#FF8A65",
    velocidadeProjetil: 6,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 39, frameInterval: 4 },
      attack: { frameCount: 34, frameInterval: 2 },
    },
    muzzle: {
      units: "spritePx",
      attack: { x: 200, y: -350 },
    },
    fireFrame: [12], // dispara projétil no frame 12 da animação de attack
    cooldownPerShot: false, // (opcional) faz o cooldown só depois do último frame
    deployCost: 7,
    deployCooldownMs: 6000,
  },
  ranger: {
    preco: 25,
    hp: 4,
    alcance: 9,
    cooldown: 80,
    dano: 1,
    retornaAoFinal: true,
    cor: "#F4511E",
    projetil: "laser",
    corProjetil: "#fc5ad4ff",
    velocidadeProjetil: 6,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 39, frameInterval: 4 },
      attack: { frameCount: 34, frameInterval: 2 },
    },
    muzzle: {
      units: "spritePx",
      attack: { x: 200, y: -350 },
    },
    fireFrame: [12], // dispara projétil no frame 12 da animação de attack
    cooldownPerShot: false, // (opcional) faz o cooldown só depois do último frame
    deployCost: 7,
    deployCooldownMs: 6000,
  },
  muralhaReforcada: {
    preco: 15,
    hp: 20,
    alcance: 0,
    cooldown: 0,
    dano: 0,
    retornaAoFinal: false,
    estados: ["idle", "defense"],
    animacoes: {
      defense: { frameCount: 3, frameInterval: 999999 }, // não anima por tempo
    },
    deployCost: 6,
    deployCooldownMs: 2500,
  },
  /*
  grenadier: {
    preco: 18,
    alcance: 3,
    cooldown: 90,
    dano: 3,
    cor: "#9CCC65",
    corProjetil: "#C5E1A5",
    velocidadeProjetil: 4,
    frameCount: 6, // ← quantidade de frames
    frameInterval: 8, // ← intervalo entre frames
    estados: ["idle", "attack"],
  },
  psi: {
    preco: 25,
    alcance: 4,
    cooldown: 100,
    dano: 3,
    cor: "#AB47BC",
    corProjetil: "#E1BEE7",
    velocidadeProjetil: 3,
    frameCount: 6, // ← quantidade de frames
    frameInterval: 8, // ← intervalo entre frames
    estados: ["idle", "attack"],
  },*/
};

// Pré-carrega os frames das tropas
export const troopAnimations = Object.fromEntries(
  Object.entries(troopTypes).map(([tipo, config]) => [
    tipo,
    loadTroopFrames(tipo, config.estados || ["idle"], config.animacoes || {}),
  ])
);

export class Troop {
  constructor(tipo, row, col) {
    this.tipo = tipo;
    this.row = row;
    this.col = col;
    this.config = troopTypes[tipo];

    // Combate e vida
    this.hp = this.config.hp;
    this.maxHp = this.config.hp; // << adiciona isso
    this.isDead = false;

    // Animação
    // Estado inicial: muralha começa em 'defense', demais em 'idle'
    this.state = tipo === "muralhaReforcada" ? "defense" : "idle";
    this.frameIndex = 0; // ✅
    this.frameTick = 0; // ✅
    this.cooldown = 0; // ✅

    // morte suave
    this.isDying = false;
    this.opacity = 1;
    this.deathDuration = 20;
    this._deathStep = 1 / this.deathDuration;
    this.remove = false;

    // Se for muralha, já ajusta o frame conforme HP atual
    if (this.state === "defense") {
      this.updateDefenseAppearance();
    }
  }

  updateCooldown() {
    this.cooldown = Math.max(0, this.cooldown - 1);
  }

  canAttack() {
    // muralha não ataca
    if (this.state === "defense") return false;
    return !this.isDead && this.cooldown <= 0;
  }

  attack(tileWidth, tileHeight) {
    // muralha não cria projétil
    if (this.state === "defense") return null;

    // se não tem animação de ataque OU dano <= 0, não cria projétil
    if (!this.config.animacoes?.attack || (this.config.dano ?? 0) <= 0) {
      return null;
    }

    // NÃO muda state, frame, nem cooldown aqui!
    return {
      id: Date.now(),
      // posição “fallback” — o CollisionManager vai sobrescrever com o muzzle
      x: this.col * tileWidth + tileWidth / 2,
      y: this.row * tileHeight + tileHeight / 2,
      // velocidade base para quem precisar
      speed: this.config.velocidadeProjetil,
      row: this.row,
      tipo: this.tipo,
      projetil: this.config.projetil || "bola", // << NOVO
      active: true,
      dano: this.config.dano,
      cor: this.config.corProjetil || "#fff",
    };
  }

  // 🔹 Ajusta o frame do estado 'defense' conforme a vida
  updateDefenseAppearance() {
    if (this.state !== "defense") return;
    const ratio = this.hp / this.maxHp;

    if (ratio <= 0.25) {
      this.frameIndex = 2; // 25% ou menos → último frame
    } else if (ratio <= 0.5) {
      this.frameIndex = 1; // entre 50% e 25% → frame 1
    } else {
      this.frameIndex = 0; // acima de 50% → frame 0
    }
  }

  takeDamage(dano) {
    if (this.remove || this.isDead) return;
    this.hp -= dano;
    if (this.hp <= 0) {
      this.hp = 0;
      this.startDeath(); // ✅ sempre usa o funil único de morte
    }
  }

  startDeath() {
    if (this.remove) return; // já finalizado
    this.isDead = true; // marca como morto logicamente
    if (!this.isDying) {
      // inicia fade apenas uma vez
      this.isDying = true;
      this.state = "idle"; // ou "dead" se existir
    }
  }

  updateDeath() {
    // ✅ autocorreção: se hp<=0, garante isDying=true
    if (this.hp <= 0 && !this.isDying && !this.remove) {
      this.startDeath();
    }
    if (!this.isDying) return;

    this.opacity -= this._deathStep;
    if (this.opacity <= 0) {
      this.opacity = 0;
      this.isDying = false;
      this.remove = true; // só aqui é removido do array
    }
  }

  updateAnimation() {
    // Se for muralha, não avançamos frames por tempo; o frame é controlado pelo HP.
    if (this.state === "defense") {
      // ainda assim, garantimos que está coerente (caso algo altere HP fora do takeDamage)
      this.updateDefenseAppearance();
      return;
    }

    const stateConfig = this.config.animacoes?.[this.state] || {};
    const interval = stateConfig.frameInterval || 8;

    this.frameTick++;

    if (this.frameTick >= interval) {
      const frames = troopAnimations[this.tipo]?.[this.state] || [];
      this.frameIndex++;

      if (this.frameIndex >= frames.length) {
        if (this.state === "attack") {
          this.state = "idle";
        }
        this.frameIndex = 0;
      }

      this.frameTick = 0;
    }
  }
}
