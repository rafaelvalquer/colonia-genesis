// src/entities/WaveConfig.js

export const missionDefs = {
  fase_01: {
    id: "fase_01",
    nome: "Perímetro Leste",
    intervalBetweenWavesMs: 25000,
    defaultSpawnCadence: 150, // menor = mais rápido
    waves: [
      { enemies: [{ type: "crix", count: 5 }] },
      { enemies: [{ type: "crix", count: 10 }] },
      /*{ enemies: [{ type: "krulax", count: 10 }] },
      {
        enemies: [
          { type: "medu", count: 8 },
          { type: "krulax", count: 6 },
        ],
      },
      { enemies: [{ type: "crix", count: 12 }] }, */
    ],
  },

  fase_02: {
    id: "fase_02",
    nome: "Falésia Sul",
    intervalBetweenWavesMs: 28000,
    defaultSpawnCadence: 28,
    waves: [
      {
        enemies: [
          { type: "medu", count: 10 },
          { type: "crix", count: 4 },
        ],
      },
    ],
  },

  fase_03: {
    id: "fase_03",
    nome: "Falésia Sul",
    intervalBetweenWavesMs: 28000,
    defaultSpawnCadence: 28,
    waves: [
      {
        enemies: [
          { type: "medu", count: 8 },
          { type: "crix", count: 6 },
        ],
      },
      {
        enemies: [
          { type: "medu", count: 8 },
          { type: "krulax", count: 6 },
        ],
      },
    ],
  },
  fase_04: {
    id: "fase_04",
    nome: "Falésia Sul",
    intervalBetweenWavesMs: 28000,
    defaultSpawnCadence: 28,
    waves: [
      {
        enemies: [
          { type: "medu", count: 8 },
          { type: "crix", count: 6 },
          { type: "krulax", count: 2 },
        ],
      },
      {
        enemies: [
          { type: "medu", count: 8 },
          { type: "krulax", count: 6 },
          { type: "krakhul", count: 2 },
        ],
      },
    ],
  },

  // adicione outras fases aqui...
};

export const missionOrder = ["fase_01", "fase_02" /*, "fase_03", ...*/];

export function getNextMissionId(currentId = "fase_01") {
  const match = /^fase_(\d+)$/.exec(currentId);
  if (!match) {
    // fallback: se não bater no padrão esperado, começa do zero
    return "fase_01";
  }

  const num = parseInt(match[1], 10);
  const nextNum = num + 1;

  // garante sempre 2 dígitos (01, 02, ..., 10, 11, etc.)
  const nextId = `fase_${String(nextNum).padStart(2, "0")}`;
  return nextId;
}

// === Adaptador: missionDef -> API compatível com GameCanvas ===
export function makeWaveConfig(missionDef) {
  const waves = missionDef?.waves ?? [];
  const interval = missionDef?.intervalBetweenWavesMs ?? 30000;
  const cadence = missionDef?.defaultSpawnCadence ?? 30;

  return {
    intervaloOndaMs: interval,
    frequenciaSpawn: cadence,
    totalOndas: waves.length,

    // mantém assinatura antiga
    tiposPorOnda: (ondaIndex1) => {
      const w = waves[ondaIndex1 - 1];
      return w?.enemies?.map((e) => e.type) ?? ["medu"];
    },

    quantidadePorOnda: (ondaIndex1) => {
      const w = waves[ondaIndex1 - 1];
      if (!w?.enemies) return 0;
      return w.enemies.reduce((sum, e) => sum + (e.count || 0), 0);
    },

    // útil se quiser saber o “por tipo” diretamente
    porTipoPorOnda: (ondaIndex1) => {
      const w = waves[ondaIndex1 - 1];
      if (!w?.enemies) return {};
      return Object.fromEntries(w.enemies.map((e) => [e.type, e.count || 0]));
    },
  };
}

// === Helper: pega a fase pelo id (ex.: battleCampaign.currentMissionId) ===
export function getWaveConfigByMissionId(missionId) {
  const def = missionDefs[missionId] ?? missionDefs.fase_01;
  return makeWaveConfig(def);
}
