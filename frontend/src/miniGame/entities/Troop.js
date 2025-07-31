// src/entities/Troop.js

import { loadTroopFrames } from "../assets/troop/loadTroopFrames";

export const troopTypes = {
  colono: {
    preco: 10,
    alcance: 5,
    cooldown: 50,
    dano: 1,
    cor: "#8D6E63",
    corProjetil: "yellow",
    velocidadeProjetil: 6,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 7, frameInterval: 8 },
      attack: { frameCount: 4, frameInterval: 6 },
    },
  },
  marine: {
    preco: 15,
    alcance: 2,
    cooldown: 60,
    dano: 3,
    cor: "#4FC3F7",
    corProjetil: "#B3E5FC",
    velocidadeProjetil: 5,
    estados: ["idle", "attack"],
    animacoes: {
      idle: { frameCount: 9, frameInterval: 8 },
      attack: { frameCount: 4, frameInterval: 6 },
    },
  } /*
  heavy: {
    preco: 20,
    alcance: 4,
    cooldown: 80,
    dano: 4,
    cor: "#F4511E",
    corProjetil: "#FF8A65",
    velocidadeProjetil: 4,
    frameCount: 6, // ← quantidade de frames
    frameInterval: 8, // ← intervalo entre frames
    estados: ["idle", "attack"],
  },
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
  },*/,
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
    this.cooldown = 0;
    this.config = troopTypes[tipo];

    // Animação
    this.state = "idle";
    this.frameTick = 0;
    this.frameIndex = 0;
  }

  updateCooldown() {
    this.cooldown = Math.max(0, this.cooldown - 1);
  }

  canAttack() {
    return this.cooldown <= 0;
  }

  attack(tileWidth, tileHeight) {
    this.cooldown = this.config.cooldown;
    this.state = "attack";
    this.frameIndex = 0;
    this.frameTick = 0;

    return {
      id: Date.now(),
      x: this.col * tileWidth + tileWidth / 2,
      y: this.row * tileHeight + tileHeight / 2,
      dx: this.config.velocidadeProjetil,
      row: this.row,
      tipo: this.tipo,
      active: true,
      dano: this.config.dano,
    };
  }
  updateAnimation() {
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
