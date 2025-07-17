const Colonia = require("../models/colonia");

// Criar uma nova colônia
exports.criarColonia = async (req, res) => {
  try {
    const novaColonia = new Colonia(req.body);
    await novaColonia.save();
    res.status(201).json(novaColonia);
  } catch (error) {
    console.error("Erro ao criar colônia:", error);
    res.status(500).json({ erro: "Erro ao criar colônia." });
  }
};

// Atualizar uma colônia existente
exports.atualizarColonia = async (req, res) => {
  try {
    const { id } = req.params;
    const dadosAtualizados = req.body;

    const coloniaAtualizada = await Colonia.findByIdAndUpdate(
      id,
      dadosAtualizados,
      {
        new: true,
      }
    );

    if (!coloniaAtualizada) {
      return res.status(404).json({ erro: "Colônia não encontrada." });
    }

    res.status(200).json(coloniaAtualizada);
  } catch (error) {
    console.error("Erro ao atualizar colônia:", error);
    res.status(500).json({ erro: "Erro ao atualizar colônia." });
  }
};

exports.buscarColoniaPorNome = async (req, res) => {
  try {
    const { nome } = req.params;
    const colonia = await Colonia.findOne({ nome });

    if (!colonia) {
      return res.status(404).json({ mensagem: "Colônia não encontrada." });
    }

    res.json(colonia);
  } catch (error) {
    console.error("Erro ao buscar colônia:", error);
    res.status(500).json({ mensagem: "Erro interno ao buscar colônia." });
  }
};

