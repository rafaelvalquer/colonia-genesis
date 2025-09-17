//backend/controllers/coloniaController.js
const bcrypt = require("bcryptjs");
const Colonia = require("../models/colonia");

/* ===== Helpers de água ===== */

function computeRegen(doc, now = Date.now()) {
  const agua = Number(doc.agua ?? 0);
  const maxAgua = Number(doc.maxAgua ?? 0);
  const last = Number(doc.waterLastTs ?? now);
  const rate = Number(doc.waterRateMs ?? 60000);

  if (agua >= maxAgua) return null;
  const ticks = Math.floor((now - last) / rate);
  if (ticks <= 0) return null;

  const add = Math.min(ticks, maxAgua - agua);
  const newLastTs = last + add * rate;
  const nextAt = newLastTs + rate;
  return { add, newLastTs, nextAt, rateMs: rate };
}

function metaFrom(doc) {
  const nextAt =
    doc.agua < doc.maxAgua
      ? Number(doc.waterLastTs) + Number(doc.waterRateMs)
      : null;
  return { nextAt, rateMs: Number(doc.waterRateMs ?? 60000) };
}

async function ensureWaterDefaults(doc) {
  const patch = {};
  if (doc.waterRateMs == null) patch.waterRateMs = 60000;
  if (doc.waterLastTs == null) patch.waterLastTs = Date.now();
  if (Object.keys(patch).length) {
    await Colonia.updateOne({ _id: doc._id }, { $set: patch });
    Object.assign(doc, patch);
  }
}

/* ===== Criação ===== */

// Criar uma nova colônia a partir apenas de { nome }
exports.criarColonia = async (req, res) => {
  try {
    const { usuario, senha, nome, landingSite, doutrina } = req.body || {};

    // valida nome (sempre)
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
    }

    // checa duplicidades de nome/usuario
    const [existeNome, existeUsuario] = await Promise.all([
      Colonia.findOne({ nome: nome.trim() }).lean(),
      usuario ? Colonia.findOne({ usuario: usuario.trim() }).lean() : null,
    ]);
    if (existeNome)
      return res
        .status(409)
        .json({ erro: "Já existe uma colônia com esse nome." });
    if (existeUsuario)
      return res.status(409).json({ erro: "Usuário já cadastrado." });

    // presets de bônus por local de pouso (percentual em fração)
    const landingPresets = {
      vale_nebuloso: { agricultura: +0.2, mineracao: 0.0, energia: -0.1 },
      escarpa_basalto: { agricultura: -0.1, mineracao: +0.2, energia: 0.0 },
      planicie_vento_frio: {
        agricultura: -0.05,
        mineracao: -0.05,
        energia: +0.15,
      },
    };
    const mods =
      landingSite && landingPresets[landingSite]
        ? landingPresets[landingSite]
        : { agricultura: 0, mineracao: 0, energia: 0 };

    // prédios iniciais por doutrina
    const baseBuildings = {
      fazenda: 0,
      sistemaDeIrrigacao: 0,
      matrizDeGravidade: 0,
      muralhaReforcada: 0,
      minaDeCarvao: 0,
      minaProfunda: 0,
      centroDePesquisa: 0,
      laboratorioAvancado: 0,
      postoMedico: 0,
      hospitalCentral: 0,
      geradorSolar: 0,
      reatorGeotermico: 0,
      estacaoDeTratamento: 0,
      coletorAtmosferico: 0,
    };
    if (doutrina === "agronomia") baseBuildings.fazenda = 1;
    if (doutrina === "saude") baseBuildings.postoMedico = 1;
    if (doutrina === "mineracao") baseBuildings.minaDeCarvao = 1;
    if (doutrina === "energia") baseBuildings.geradorSolar = 1;

    // hash da senha (se veio via novo fluxo)
    let senhaHash = null;
    if (usuario || senha) {
      if (!usuario || !usuario.trim() || !senha) {
        return res.status(400).json({ erro: "Informe 'usuario' e 'senha'." });
      }
      if (String(senha).length < 6) {
        return res
          .status(400)
          .json({ erro: "A senha deve ter pelo menos 6 caracteres." });
      }
      senhaHash = await bcrypt.hash(String(senha), 10);
    }

    // defaults gerais
    const defaults = {
      usuario: usuario?.trim() || null,
      senhaHash,
      nome: nome.trim(),
      avatarIndex: 1,

      landingSite: landingSite || null,
      doutrina: doutrina || null,
      landingModifiers: {
        agricultura: mods.agricultura,
        mineracao: mods.mineracao,
        energia: mods.energia,
      },

      turno: 1,
      integridadeEstrutural: 100,

      populacao: {
        colonos: 100,
        guardas: 0,
        exploradores: 0,
        marines: 0,
        snipers: 0,
        rangers: 0,
      },
      exploradores: [],

      energia: 200,
      agua: 100,
      maxAgua: 100,
      waterLastTs: Date.now(),
      waterRateMs: 60000,

      comida: 150,
      minerais: 100,
      saude: 100,
      sustentabilidade: 100,
      ciencia: 100,

      construcoes: baseBuildings,

      hospital: { fila: [], internados: [], historicoAltas: [] },

      filaConstrucoes: [],
      filaMissoes: [],
      pesquisa: [],

      battleCampaign: {
        currentMissionId: "fase_01",
        index: 0,
        attempts: 0,
        lastOutcome: null,
        lastPlayedAt: null,
        seed: Date.now(),
        history: {
          fase_01: {
            attempts: 0,
            victories: 0,
            defeats: 0,
            lastOutcome: null,
            lastPlayedAt: null,
          },
        },
      },
    };
    const novaColonia = await Colonia.create(defaults);
    return res
      .status(201)
      .json({ ...novaColonia.toObject(), water: metaFrom(novaColonia) });
  } catch (error) {
    console.error("Erro ao criar colônia:", error);
    return res.status(500).json({ erro: "Erro ao criar colônia." });
  }
};

// Atualizar uma colônia existente
exports.atualizarColonia = async (req, res) => {
  try {
    const { id } = req.params;
    const dadosAtualizados = req.body;
    // nunca permitir atualização direta da senha em claro
    if ("senha" in dadosAtualizados) delete dadosAtualizados.senha;

    const coloniaAtualizada = await Colonia.findByIdAndUpdate(
      id,
      dadosAtualizados,
      { new: true }
    );
    if (!coloniaAtualizada)
      return res.status(404).json({ erro: "Colônia não encontrada." });

    res.status(200).json({
      ...coloniaAtualizada.toObject(),
      water: metaFrom(coloniaAtualizada),
    });
  } catch (error) {
    console.error("Erro ao atualizar colônia:", error);
    res.status(500).json({ erro: "Erro ao atualizar colônia." });
  }
};

// Busca Colonia existente por nome
exports.buscarColoniaPorNome = async (req, res) => {
  try {
    const { nome } = req.params;
    let doc = await Colonia.findOne({ nome });
    if (!doc)
      return res.status(404).json({ mensagem: "Colônia não encontrada." });

    await ensureWaterDefaults(doc);

    // regen on-read com guarda de corrida
    const patch = computeRegen(doc);
    if (patch) {
      const updated = await Colonia.findOneAndUpdate(
        { _id: doc._id, agua: doc.agua, waterLastTs: doc.waterLastTs },
        { $inc: { agua: patch.add }, $set: { waterLastTs: patch.newLastTs } },
        { new: true }
      );
      doc = updated || (await Colonia.findById(doc._id));
    }

    return res.json({ ...doc.toObject(), water: metaFrom(doc) });
  } catch (error) {
    console.error("Erro ao buscar colônia:", error);
    res.status(500).json({ mensagem: "Erro interno ao buscar colônia." });
  }
};

/* ===== Novos endpoints: estado por ID e gastar água ===== */

exports.getEstadoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    let doc = await Colonia.findById(id);
    if (!doc) return res.status(404).json({ erro: "Colônia não encontrada." });

    await ensureWaterDefaults(doc);

    const patch = computeRegen(doc);
    if (patch) {
      const updated = await Colonia.findOneAndUpdate(
        { _id: doc._id, agua: doc.agua, waterLastTs: doc.waterLastTs },
        { $inc: { agua: patch.add }, $set: { waterLastTs: patch.newLastTs } },
        { new: true }
      );
      doc = updated || (await Colonia.findById(id));
    }

    return res.json({ ...doc.toObject(), water: metaFrom(doc) });
  } catch (e) {
    console.error("Erro ao obter estado:", e);
    res.status(500).json({ erro: "Erro ao obter estado." });
  }
};

exports.gastarAgua = async (req, res) => {
  try {
    const { id } = req.params;
    const cost = Math.max(0, Number(req.body?.cost || 0));
    if (!cost) return res.status(400).json({ erro: "cost inválido" });

    let doc = await Colonia.findById(id);
    if (!doc) return res.status(404).json({ erro: "Colônia não encontrada." });

    await ensureWaterDefaults(doc);

    // regen on-write
    const patch = computeRegen(doc);
    if (patch) {
      await Colonia.updateOne(
        { _id: doc._id, agua: doc.agua, waterLastTs: doc.waterLastTs },
        { $inc: { agua: patch.add }, $set: { waterLastTs: patch.newLastTs } }
      );
      doc = await Colonia.findById(id);
    }

    // débito atômico
    const updated = await Colonia.findOneAndUpdate(
      { _id: id, agua: { $gte: cost } },
      { $inc: { agua: -cost } },
      { new: true }
    );
    if (!updated) return res.status(409).json({ erro: "Água insuficiente" });

    return res.json({ ...updated.toObject(), water: metaFrom(updated) });
  } catch (e) {
    console.error("Erro ao gastar água:", e);
    res.status(500).json({ erro: "Erro ao gastar água." });
  }
};
