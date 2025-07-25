// src/entities/WaveConfig.js

export const waveConfig = {
  intervaloOndaMs: 30000,
  frequenciaSpawn: 30, // menor = mais rápido

  tiposPorOnda: (onda) => {
    if (onda < 3) return ["fraco"];
    if (onda < 6) return Math.random() < 0.5 ? ["fraco"] : ["rapido"];
    if (onda < 9) return Math.random() < 0.5 ? ["rapido"] : ["tanque"];
    if (onda < 10) return Math.random() < 0.5 ? ["tanque"] : ["elite"];
    return ["tanque", "rapido"];
  },

  quantidadePorOnda: (onda) => {
    if (onda < 3) return 5;
    if (onda < 6) return 8;
    if (onda < 9) return 10;
    if (onda < 12) return 12;
    return 15 + Math.floor((onda - 12) * 1.5);
  },
};
