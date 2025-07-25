// src/entities/Troop.js

export const troopTypes = {
  colono: {
    preco: 10,
    alcance: 5,
    cooldown: 50,
    dano: 1,
    cor: "#8D6E63",
    corProjetil: "yellow",
    velocidadeProjetil: 6,
  },
  marine: {
    preco: 15,
    alcance: 2,
    cooldown: 60,
    dano: 3,
    cor: "#4FC3F7",
    corProjetil: "#B3E5FC",
    velocidadeProjetil: 5,
  },
  heavy: {
    preco: 20,
    alcance: 4,
    cooldown: 80,
    dano: 4,
    cor: "#F4511E",
    corProjetil: "#FF8A65",
    velocidadeProjetil: 4,
  },
  grenadier: {
    preco: 18,
    alcance: 3,
    cooldown: 90,
    dano: 3,
    cor: "#9CCC65",
    corProjetil: "#C5E1A5",
    velocidadeProjetil: 4,
  },
  psi: {
    preco: 25,
    alcance: 4,
    cooldown: 100,
    dano: 3,
    cor: "#AB47BC",
    corProjetil: "#E1BEE7",
    velocidadeProjetil: 3,
  },
};

export class Troop {
  constructor(tipo, row, col) {
    this.tipo = tipo;
    this.row = row;
    this.col = col;
    this.cooldown = 0;
    this.config = troopTypes[tipo];
  }

  updateCooldown() {
    this.cooldown = Math.max(0, this.cooldown - 1);
  }

  canAttack() {
    return this.cooldown <= 0;
  }

  attack(tileWidth, tileHeight) {
    this.cooldown = this.config.cooldown;

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
}
