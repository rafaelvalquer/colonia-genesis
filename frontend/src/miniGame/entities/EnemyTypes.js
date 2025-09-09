// src/entities/EnemyTypes.js

import { loadEnemyFrames } from "../assets/enemy/loadEnemyFrames";

export const enemyTypes = {
  medu: {
    nome: "medu",
    hp: 10,
    alcance: 1, // em colunas
    speed: 1,
    dano: 2,
    cooldown: 80, // em ticks do loop
    cor: "red",
    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 41, frameInterval: 4 },
      attack: { frameCount: 41, frameInterval: 1 },
      idle: { frameCount: 41, frameInterval: 4 },
    },
    hitFrame: "last", // ou -1
  },
  alienVermelho: {
    nome: "alien",
    hp: 10,
    alcance: 1,
    speed: 3,
    dano: 2,
    cooldown: 60,
    cor: "purple",
    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 3, frameInterval: 8 },
      attack: { frameCount: 3, frameInterval: 6 },
      idle: { frameCount: 3, frameInterval: 10 },
    },
  },
  /*
  robot: {
    nome: "Robô",
    hp: 10,
    alcance: 1,
    speed: 0.8,
    dano: 3,
    cooldown: 60,
    cor: "gray",

    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 10, frameInterval: 8 },
      attack: { frameCount: 6, frameInterval: 6 },
      idle: { frameCount: 4, frameInterval: 10 },
    },
  },*/
};

// Pré-carrega todos os frames por estado
export const enemyAnimations = Object.fromEntries(
  Object.entries(enemyTypes).map(([tipo, config]) => [
    tipo,
    loadEnemyFrames(
      tipo,
      config.estados || ["walking", "attack", "idle"],
      config.animacoes || {}
    ),
  ])
);
