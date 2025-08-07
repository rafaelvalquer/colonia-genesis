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

const coloniaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  turno: { type: Number, default: 1 },
  integridadeEstrutural: { type: Number, default: 100 },
  populacao: {
    colonos: { type: Number, default: 0 },
    exploradores: { type: Number, default: 0 },
    marines: { type: Number, default: 0 },
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
  pesquisa: [pesquisaSchema],
});

module.exports = mongoose.model("Colonia", coloniaSchema);
