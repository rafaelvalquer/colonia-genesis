// backend/models/colonia.js
const mongoose = require("mongoose");

const pesquisaSchema = new mongoose.Schema({
  id: String,
  source: String,
  target: String,
  label: String,
  type: String,
});

const filaConstrucaoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    nome: { type: String, required: true },
    tempoRestante: { type: Number, required: true },
  },
  { _id: false } // evita gerar um _id para cada item da fila
);

// backend/models/colonia.js

const filaMissoesSchema = new mongoose.Schema(
  {
    // id da missão base (ex.: "templo", "vulcao", "floresta")
    id: { type: String, required: true },

    // título para exibir
    nome: { type: String, required: true },

    // turnos restantes e totais para progresso
    tempoRestante: { type: Number, required: true },
    turnosTotais: { type: Number, required: true },

    // vínculo com o explorador alocado
    explorerId: { type: String, required: true },
    explorerNome: { type: String, required: true },

    // estado da tarefa de missão
    status: {
      type: String,
      enum: ["emAndamento", "aguardandoInicio", "pronta", "concluida"],
      default: "emAndamento",
    },

    // opcional: facilita no front
    readyToStart: { type: Boolean, default: false },
    // 👇 recompensas vindas do JSON da missão
    recompensasRaw: {
      type: [
        {
          label: { type: String }, // texto para exibição
          cor: { type: String }, // cor do texto no front
          // quaisquer campos extras como colono, comida, minerais etc
          // ficam em formato flexível
          _meta: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const hpSchema = new mongoose.Schema(
  {
    current: { type: Number, min: 0, required: true },
    max: { type: Number, min: 1, required: true },
  },
  { _id: false }
);

const staminaSchema = new mongoose.Schema(
  {
    current: { type: Number, min: 0, required: true },
    max: { type: Number, min: 1, required: true },
  },
  { _id: false }
);

const skillsSchema = new mongoose.Schema(
  {
    visao: { type: Number, min: 0, max: 10, default: 0 },
    agilidade: { type: Number, min: 0, max: 10, default: 0 },
    folego: { type: Number, min: 0, max: 10, default: 0 },
    furtividade: { type: Number, min: 0, max: 10, default: 0 },
    resiliencia: { type: Number, min: 0, max: 10, default: 0 },
  },
  { _id: false }
);

const equipmentSchema = new mongoose.Schema(
  {
    arma: { type: String, default: null },
    armadura: { type: String, default: null },
    gadget: { type: String, default: null },
  },
  { _id: false }
);

const exploradorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // ex: "exp_001"
    name: { type: String, required: true },
    nickname: { type: String, default: null },
    level: { type: Number, min: 1, default: 1 },
    xp: { type: Number, min: 0, default: 0 },
    xpNext: { type: Number, min: 1, default: 100 },
    hp: { type: hpSchema, required: true },
    stamina: { type: staminaSchema, required: true },
    skills: { type: skillsSchema, default: () => ({}) },
    traits: { type: [String], default: [] },
    equipment: { type: equipmentSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["disponivel", "emMissao", "ferido", "descansando"],
      default: "disponivel",
    },
    missionId: { type: String, default: null },
    portrait: { type: String, default: null },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { _id: false }
);

const pacienteSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // ex.: 'pac_123'
    tipo: { type: String, enum: ["colono", "explorador"], required: true },
    refId: { type: String, default: null }, // se explorador, id do explorador
    severidade: { type: String, enum: ["leve", "grave"], required: true },
    entrouEm: { type: Number, required: true }, // timestamp
    turnosRestantes: { type: Number, min: 0, required: true },
    origem: { type: String, default: null }, // 'evento' | 'missao' | 'fome' | ...
    status: {
      type: String,
      enum: ["fila", "internado", "alta", "obito"],
      default: "fila",
    },
    turnosNaFila: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const hospitalSchema = new mongoose.Schema(
  {
    fila: { type: [pacienteSchema], default: [] },
    internados: { type: [pacienteSchema], default: [] },
    historicoAltas: { type: [mongoose.Schema.Types.Mixed], default: [] }, // opcional
  },
  { _id: false }
);

const skillDistribuicaoSchema = new mongoose.Schema(
  {
    agricultura: { type: Number, min: 0, max: 1, default: 0 },
    mineracao: { type: Number, min: 0, max: 1, default: 0 },
    laboratorio: { type: Number, min: 0, max: 1, default: 0 },
    construcao: { type: Number, min: 0, max: 1, default: 0 },
    saude: { type: Number, min: 0, max: 1, default: 0 },
    energia: { type: Number, min: 0, max: 1, default: 0 },
  },
  { _id: false }
);

const battleCampaignSchema = new mongoose.Schema(
  {
    currentMissionId: { type: String, default: "fase_01" },
    index: { type: Number, default: 0 }, // índice numérico (0 para fase_01, 1 para fase_02...)
    attempts: { type: Number, default: 0 }, // tentativas globais
    lastOutcome: {
      type: String,
      enum: ["victory", "defeat", null],
      default: null,
    },
    lastPlayedAt: { type: Number, default: null },
    seed: { type: Number, default: () => Date.now() },
    history: {
      type: Map,
      of: new mongoose.Schema(
        {
          attempts: { type: Number, default: 0 },
          victories: { type: Number, default: 0 },
          defeats: { type: Number, default: 0 },
          lastOutcome: {
            type: String,
            enum: ["victory", "defeat", null],
            default: null,
          },
          lastPlayedAt: { type: Number, default: null },
        },
        { _id: false }
      ),
      default: {},
    },
  },
  { _id: false }
);

// 🔧 Garantir flatten para Maps (como battleCampaign.history)
battleCampaignSchema.set("toJSON", { flattenMaps: true });
battleCampaignSchema.set("toObject", { flattenMaps: true });

/* ---------------------------------------------- */

const coloniaSchema = new mongoose.Schema({
  /* Conta */
  usuario: {
    type: String,
    trim: true,
    index: true,
    unique: true,
    sparse: true,
  }, // opcional para retrocompat
  senhaHash: { type: String, default: null }, // NUNCA salve senha em claro

  /* Personalização */
  nome: { type: String, required: true, trim: true, index: true, unique: true },
  avatarIndex: { type: Number, default: 1, min: 1, max: 10 },

  /* Setup inicial: pouso + doutrina */
  landingSite: {
    type: String,
    enum: ["vale_nebuloso", "escarpa_basalto", "planicie_vento_frio"],
    default: null,
  },
  doutrina: {
    type: String,
    enum: ["agronomia", "saude", "mineracao", "energia"],
    default: null,
  },
  // modificadores percentuais (ex.: 0.20 = +20%, -0.10 = -10%)
  landingModifiers: {
    agricultura: { type: Number, default: 0 },
    mineracao: { type: Number, default: 0 },
    energia: { type: Number, default: 0 },
  },

  /* Estado geral */
  turno: { type: Number, default: 1 },
  integridadeEstrutural: { type: Number, default: 100 },
  populacao: {
    colonos: { type: Number, default: 0 },
    exploradores: { type: Number, default: 0 },
    guardas: { type: Number, default: 0 },
    marines: { type: Number, default: 0 },
    snipers: { type: Number, default: 0 },
    rangers: { type: Number, default: 0 },
  },
  exploradores: {
    type: [exploradorSchema],
    default: [],
  },
  energia: { type: Number, required: true },
  agua: { type: Number, required: true },
  maxAgua: { type: Number, default: 100 },
  waterLastTs: { type: Number, default: () => Date.now() },
  waterRateMs: { type: Number, default: 60000 },
  comida: { type: Number, required: true },
  minerais: { type: Number, required: true },
  saude: { type: Number, required: true },
  sustentabilidade: { type: Number, default: 100 },
  ciencia: { type: Number, default: 100 },

  construcoes: {
    fazenda: { type: Number, default: 0 },
    sistemaDeIrrigacao: { type: Number, default: 0 },
    matrizDeGravidade: { type: Number, default: 0 },
    muralhaReforcada: { type: Number, default: 0 },
    minaDeCarvao: { type: Number, default: 0 },
    minaProfunda: { type: Number, default: 0 },
    geoSolar: { type: Number, default: 0 },
    centroDePesquisa: { type: Number, default: 0 },
    laboratorioAvancado: { type: Number, default: 0 },
    postoMedico: { type: Number, default: 0 },
    hospitalCentral: { type: Number, default: 0 },
    geradorSolar: { type: Number, default: 0 },
    reatorGeotermico: { type: Number, default: 0 },
    estacaoDeTratamento: { type: Number, default: 0 },
    coletorAtmosferico: { type: Number, default: 0 },
  },

  skillsDistribuicao: { type: skillDistribuicaoSchema, default: () => ({}) },

  hospital: {
    type: hospitalSchema,
    default: () => ({ fila: [], internados: [], historicoAltas: [] }),
  },

  battleCampaign: { type: battleCampaignSchema, default: () => ({}) },

  filaConstrucoes: [filaConstrucaoSchema],
  filaMissoes: [filaMissoesSchema],
  pesquisa: [pesquisaSchema],
});

// ✅ Flatten Maps globalmente neste modelo
coloniaSchema.set("toJSON", { flattenMaps: true });
coloniaSchema.set("toObject", { flattenMaps: true });

module.exports = mongoose.model("Colonia", coloniaSchema);
