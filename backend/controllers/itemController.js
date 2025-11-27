// backend/controllers/itemController.js
const Item = require("../models/item");

exports.listar = async (req, res) => {
  try {
    const { tipo, raridade, q, tags, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (tipo) filter.tipo = tipo;
    if (raridade) filter.raridade = raridade;
    if (q) filter.nome = { $regex: q, $options: "i" };
    if (tags) {
      const arr = Array.isArray(tags) ? tags : String(tags).split(",");
      filter.tags = { $all: arr.map((t) => t.trim()) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Item.find(filter)
        .sort({ raridade: 1, nome: 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Item.countDocuments(filter),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (e) {
    res
      .status(500)
      .json({ error: "Falha ao listar itens", details: e.message });
  }
};

exports.detalhar = async (req, res) => {
  try {
    const doc = await Item.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: "Item não encontrado" });
    res.json(doc);
  } catch (e) {
    res
      .status(500)
      .json({ error: "Falha ao detalhar item", details: e.message });
  }
};
