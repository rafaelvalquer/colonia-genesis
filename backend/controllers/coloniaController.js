const Colonia = require("../models/colonia");

// Criar uma nova colônia
// Criar uma nova colônia a partir apenas de { nome }
exports.criarColonia = async (req, res) => {
  try {
    const { nome } = req.body || {};
    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: "O campo 'nome' é obrigatório." });
    }

    // (opcional) evitar nomes duplicados
    const existe = await Colonia.findOne({ nome: nome.trim() }).lean();
    if (existe) {
      return res
        .status(409)
        .json({ erro: "Já existe uma colônia com esse nome." });
    }

    const defaults = {
      nome: nome.trim(),
      turno: 1,
      integridadeEstrutural: 100,
      populacao: { colonos: 100, exploradores: 0, marines: 0 },
      exploradores: [],
      energia: 200,
      agua: 100,
      maxAgua: 100,
      comida: 150,
      minerais: 100,
      saude: 100,
      sustentabilidade: 100,
      ciencia: 100,

      construcoes: {
        fazenda: 0,
        sistemaDeIrrigacao: 0,
        torreDeVigilancia: 0,
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
      },

      hospital: { fila: [], internados: [], historicoAltas: [] },

      filaConstrucoes: [],
      filaMissoes: [],
      pesquisa: [],
    };

    const novaColonia = await Colonia.create(defaults);
    return res.status(201).json(novaColonia);
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

// Busca Colonia existente por nome
exports.buscarColoniaPorNome = async (req, res) => {
  try {
    const { nome } = req.params;
    const colonia = await Colonia.findOne({ nome });

    if (!colonia) {
      return res.status(404).json({ mensagem: "Colônia não encontrada." });
    }
    console.log(colonia);
    res.json(colonia);
  } catch (error) {
    console.error("Erro ao buscar colônia:", error);
    res.status(500).json({ mensagem: "Erro interno ao buscar colônia." });
  }
};
