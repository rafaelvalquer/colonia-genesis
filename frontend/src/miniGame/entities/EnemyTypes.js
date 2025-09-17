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
      walking: { frameCount: 30, frameInterval: 3 },
      attack: { frameCount: 41, frameInterval: 1 },
      idle: { frameCount: 30, frameInterval: 3 },
    },
    hitFrame: "last", // ou -1
  },
  crix: {
    nome: "crix",
    hp: 10,
    alcance: 1,
    speed: 2,
    dano: 2,
    cooldown: 60,
    cor: "purple",
    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 29, frameInterval: 2 },
      attack: { frameCount: 50, frameInterval: 1 },
      idle: { frameCount: 38, frameInterval: 2 },
    },
    hitFrameIndexBase: 1, // << usa contagem humana (1..50)
    hitFrame: "middle", // ou -1
  },
  krulax: {
    nome: "krulax",
    hp: 15,
    alcance: 1,
    speed: 0.8,
    dano: 3,
    cooldown: 100,
    cor: "purple",
    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 31, frameInterval: 3 },
      attack: { frameCount: 54, frameInterval: 1 },
      idle: { frameCount: 31, frameInterval: 2 },
    },
    hitFrameIndexBase: 1, // << usa contagem humana (1..50)
    hitFrame: "middle", // ou -1
  },
  krakhul: {
    nome: "krakhul",
    hp: 30,
    alcance: 1,
    speed: 0.6,
    dano: 6,
    cooldown: 120,
    cor: "purple",
    estados: ["walking", "attack", "idle"],
    animacoes: {
      walking: { frameCount: 43, frameInterval: 2 },
      attack: { frameCount: 43, frameInterval: 1 },
      idle: { frameCount: 43, frameInterval: 2 },
    },
    //hitFrameIndexBase: 1, // << usa contagem humana (1..50)
    hitFrame: 27, // ou -1
    spriteScale: 1.6, // <<< maior que 1 aumenta o tamanho (1 = padrão)
    spriteLiftPx: -70, // << +sobe / -desce (em px)
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
