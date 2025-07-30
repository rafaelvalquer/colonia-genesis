// src/entities/EnemyTypes.js

import { loadEnemyFrames } from "../assets/enemy/loadEnemyFrames";

export const enemyTypes = {
  alienBege: {
    nome: "alienBege",
    hp: 3,
    speed: 1,
    dano: 1,
    cor: "red",
    frameCount: 7,
    frameInterval: 8, // menor = animação mais rápida
  },
  alienVermelho: {
    nome: "alien",
    hp: 2,
    speed: 3,
    dano: 2,
    cor: "purple",
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
