// src/entities/Troop.js

export const troopTypes = {
  arqueiro: {
    preco: 10,
    alcance: 5,
    cooldown: 50,
    dano: 2,
    cor: "green",
    corProjetil: "yellow",
    velocidadeProjetil: 6,
  },
  guerreiro: {
    preco: 15,
    alcance: 2,
    cooldown: 60,
    dano: 3,
    cor: "orange",
    corProjetil: "red",
    velocidadeProjetil: 5,
  },
  mago: {
    preco: 20,
    alcance: 4,
    cooldown: 80,
    dano: 4,
    cor: "blue",
    corProjetil: "cyan",
    velocidadeProjetil: 4,
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
