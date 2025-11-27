// backend/controllers/exploradorController.js
const Colonia = require("../models/colonia");
const Item = require("../models/item");

exports.equipar = async (req, res) => {
  try {
    const { coloniaId, explorerId } = req.params;
    const { armaId, armaduraId, gadgetId } = req.body; // envie apenas o que quiser alterar

    // valida itens (opcional: garantir compatibilidade de tipo/nível aqui)
    const set = {};
    if (armaId) {
      const it = await Item.findById(armaId).lean();
      if (!it || it.tipo !== "arma")
        return res.status(400).json({ error: "armaId inválido" });
      set["exploradores.$.equipment.arma"] = it._id;
    }
    if (armaduraId) {
      const it = await Item.findById(armaduraId).lean();
      if (!it || it.tipo !== "armadura")
        return res.status(400).json({ error: "armaduraId inválido" });
      set["exploradores.$.equipment.armadura"] = it._id;
    }
    if (gadgetId) {
      const it = await Item.findById(gadgetId).lean();
      if (!it || it.tipo !== "gadget")
        return res.status(400).json({ error: "gadgetId inválido" });
      set["exploradores.$.equipment.gadget"] = it._id;
    }

    if (!Object.keys(set).length)
      return res.status(400).json({ error: "Nada para equipar" });

    const r = await Colonia.updateOne(
      { _id: coloniaId, "exploradores.id": explorerId },
      { $set: set, $currentDate: { updatedAt: true } }
    );

    if (!r.matchedCount)
      return res
        .status(404)
        .json({ error: "Colônia/Explorador não encontrado" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Falha ao equipar", details: e.message });
  }
};
