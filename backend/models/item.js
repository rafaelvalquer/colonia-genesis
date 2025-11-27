// backend/models/item.js
const mongoose = require("mongoose");
const { Schema, model } = mongoose;

const ItemSchema = new Schema(
  {
    nome: { type: String, required: true, index: true },
    tipo: {
      type: String,
      enum: ["arma", "armadura", "gadget"],
      required: true,
      index: true,
    },
    raridade: {
      type: String,
      enum: ["comum", "incomum", "raro", "epico", "lendario"],
      default: "comum",
      index: true,
    },
    nivelRequerido: { type: Number, default: 1 },
    tags: [{ type: String, index: true }],
    versaoItem: { type: Number, default: 1, index: true }, // controle de balanceamento
    icone: { type: String },
    descricao: { type: String },

    // Blocos por tipo (apenas um será preenchido)
    arma: {
      slot: { type: String, default: "arma", immutable: true },
      stats: {
        dano: { base: Number, min: Number, max: Number },
        cadencia: Number, // tiros/seg ou similar
        alcance: Number, // unidades do seu mundo
        chanceCritico: Number, // 0..1
        multiplicadorCritico: Number, // ex.: 1.5, 2.0
        velocidadeProjetil: Number,
        custoStamina: Number,
      },
    },

    armadura: {
      slot: { type: String, default: "armadura", immutable: true },
      stats: {
        bonusHp: Number,
        bonusStamina: Number,
        reducaoDano: Number, // 0..1
        multVelocidadeMovimento: Number, // 0.9 = -10%
        bonusFovGraus: Number,
      },
    },

    gadget: {
      slot: { type: String, default: "gadget", immutable: true },
      stats: {
        recarga: Number, // cooldown em s
        cargas: Number,
        efeito: String, // "scanner", "flash", etc.
        valores: Schema.Types.Mixed, // payload específico do efeito
      },
    },
  },
  { timestamps: true }
);

ItemSchema.index({ nome: 1, versaoItem: 1 }, { unique: true });

// Validação por tipo
ItemSchema.pre("validate", function (next) {
  if (this.tipo === "arma" && !this.arma)
    return next(new Error("Campo 'arma' é obrigatório quando tipo=arma"));
  if (this.tipo === "armadura" && !this.armadura)
    return next(
      new Error("Campo 'armadura' é obrigatório quando tipo=armadura")
    );
  if (this.tipo === "gadget" && !this.gadget)
    return next(new Error("Campo 'gadget' é obrigatório quando tipo=gadget"));
  next();
});

module.exports = model("Item", ItemSchema);
