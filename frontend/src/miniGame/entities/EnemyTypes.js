// src/entities/EnemyTypes.js

import { loadEnemyFrames } from "../assets/enemy/loadEnemyFrames";

export const enemyTypes = {
  alienBege: {
    nome: "alienBege",
    hp: 20,
    alcance: 1,
    speed: 1,
    dano: 2,
    cooldown: 60,
    cor: "red",
    velocidadeProjetil: 10,
    frameCount: 7,
    frameInterval: 8, // menor = animação mais rápida
  },
  alienVermelho: {
    nome: "alien",
    hp: 20,
    alcance: 1,
    speed: 3,
    dano: 2,
    cooldown: 60,
    cor: "purple",
    velocidadeProjetil: 10,
    frameCount: 6,
  },
  robot: {
    nome: "Robô",
    hp: 10,
    speed: 0.8,
    dano: 3,
    cor: "gray",
    frameCount: 10,
  },
};

// Pré-carrega todos os frames
export const enemyAnimations = Object.fromEntries(
  Object.entries(enemyTypes).map(([tipo, config]) => [
    tipo,
    loadEnemyFrames(tipo, config.frameCount),
  ])
);
