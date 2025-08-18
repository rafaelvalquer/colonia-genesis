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

const filaMissoesSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    nome: { type: String, required: true },
    tempoRestante: { type: Number, required: true },
  },
  { _id: false } // evita gerar um _id para cada item da fila
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
    combate: { type: Number, min: 0, default: 0 },
    ciencia: { type: Number, min: 0, default: 0 },
    furtividade: { type: Number, min: 0, default: 0 },
    forca: { type: Number, min: 0, default: 0 },
    arqueologia: { type: Number, min: 0, default: 0 },
    sobrevivencia: { type: Number, min: 0, default: 0 },
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
/** ---------------------------------------------- */

const coloniaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  turno: { type: Number, default: 1 },
  integridadeEstrutural: { type: Number, default: 100 },
  populacao: {
    colonos: { type: Number, default: 0 },
    exploradores: { type: Number, default: 0 },
    marines: { type: Number, default: 0 },
  },
  exploradores: {
    type: [exploradorSchema],
    default: [],
  },
  energia: { type: Number, required: true },
  agua: { type: Number, required: true },
  maxAgua: { type: Number, default: 100 },
  comida: { type: Number, required: true },
  minerais: { type: Number, required: true },
  saude: { type: Number, required: true },
  sustentabilidade: { type: Number, default: 100 },
  ciencia: { type: Number, default: 100 },

  construcoes: {
    fazenda: { type: Number, default: 0 },
    sistemaDeIrrigacao: { type: Number, default: 0 },
    torreDeVigilancia: { type: Number, default: 0 },
    muralhaReforcada: { type: Number, default: 0 },
    minaDeCarvao: { type: Number, default: 0 },
    minaProfunda: { type: Number, default: 0 },
    centroDePesquisa: { type: Number, default: 0 },
    laboratorioAvancado: { type: Number, default: 0 },
    postoMedico: { type: Number, default: 0 },
    hospitalCentral: { type: Number, default: 0 },
    geradorSolar: { type: Number, default: 0 },
    reatorGeotermico: { type: Number, default: 0 },
    estacaoDeTratamento: { type: Number, default: 0 },
    coletorAtmosferico: { type: Number, default: 0 },
  },

  filaConstrucoes: [filaConstrucaoSchema],
  filaMissoes: [filaMissoesSchema],
  pesquisa: [pesquisaSchema],
});

module.exports = mongoose.model("Colonia", coloniaSchema);
