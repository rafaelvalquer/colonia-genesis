// backend/controllers/inventarioController.js
const mongoose = require("mongoose");
const Colonia = require("../models/colonia");
const Item = require("../models/item");

// Helper: incrementa/empilha no inventário
async function addToInventario(coloniaId, itemId, qty = 1) {
  // tenta empilhar
  const inc = await Colonia.updateOne(
    { _id: coloniaId, "inventario.itemId": itemId },
    { $inc: { "inventario.$.quantidade": qty } }
  );
  if (inc.matchedCount) return;

  // se não havia entrada, cria
  await Colonia.updateOne(
    { _id: coloniaId },
    {
      $push: {
        inventario: {
          itemId: new mongoose.Types.ObjectId(itemId),
          quantidade: qty,
        },
      },
    }
  );
}

// Helper: baixa quantidade e limpa zeros
async function removeFromInventario(coloniaId, itemId, qty = 1) {
  const res = await Colonia.updateOne(
    {
      _id: coloniaId,
      "inventario.itemId": itemId,
      "inventario.quantidade": { $gte: qty },
    },
    { $inc: { "inventario.$.quantidade": -qty } }
  );
  if (!res.matchedCount) throw new Error("Estoque insuficiente");

  await Colonia.updateOne(
    { _id: coloniaId },
    {
      $pull: {
        inventario: {
          itemId: new mongoose.Types.ObjectId(itemId),
          quantidade: { $lte: 0 },
        },
      },
    }
  );
}

// GET /colonia/:coloniaId/inventario
exports.listar = async (req, res) => {
  try {
    const { coloniaId } = req.params;
    const doc = await Colonia.findById(coloniaId).populate(
      "inventario.itemId",
      "nome tipo raridade icone descricao"
    );
    if (!doc) return res.status(404).json({ error: "Colônia não encontrada" });
    res.json(doc.inventario || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /colonia/:coloniaId/inventario/adicionar { itemId, quantidade }
exports.adicionar = async (req, res) => {
  try {
    const { coloniaId } = req.params;
    const { itemId, quantidade = 1 } = req.body;

    if (!itemId) return res.status(400).json({ error: "itemId é obrigatório" });
    if (!(await Item.exists({ _id: itemId })))
      return res.status(404).json({ error: "Item inexistente" });

    await addToInventario(coloniaId, itemId, Math.max(1, Number(quantidade)));
    const col = await Colonia.findById(coloniaId).populate(
      "inventario.itemId",
      "nome tipo raridade icone"
    );
    res.json(col.inventario || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// POST /colonia/:coloniaId/inventario/remover { itemId, quantidade }
exports.remover = async (req, res) => {
  try {
    const { coloniaId } = req.params;
    const { itemId, quantidade = 1 } = req.body;

    if (!itemId) return res.status(400).json({ error: "itemId é obrigatório" });
    await removeFromInventario(
      coloniaId,
      itemId,
      Math.max(1, Number(quantidade))
    );

    const col = await Colonia.findById(coloniaId).populate(
      "inventario.itemId",
      "nome tipo raridade icone"
    );
    res.json(col.inventario || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// POST /colonia/:coloniaId/exploradores/:explorerId/equipar { slot, itemId }
exports.equiparDoInventario = async (req, res) => {
  try {
    const { coloniaId, explorerId } = req.params;
    const { slot, itemId } = req.body; // slot: "arma" | "armadura" | "gadget"

    if (!["arma", "armadura", "gadget"].includes(slot))
      return res.status(400).json({ error: "slot inválido" });

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: "Item inexistente" });
    if (item.tipo !== slot)
      return res.status(400).json({ error: `Item não é do tipo ${slot}` });

    // baixa do inventário (1 unidade)
    await removeFromInventario(coloniaId, itemId, 1);

    // coloca no equipamento do explorador; se já houver, devolve o antigo ao inventário
    const col = await Colonia.findOne({
      _id: coloniaId,
      "exploradores.id": explorerId,
    });
    if (!col)
      return res
        .status(404)
        .json({ error: "Colônia/Explorador não encontrados" });

    const ex = col.exploradores.find((e) => e.id === explorerId);
    const old = ex.equipment?.[slot] || null;

    ex.equipment = ex.equipment || {};
    ex.equipment[slot] = item._id;
    ex.updatedAt = Date.now();

    await col.save();

    if (old) {
      // devolve o item antigo ao inventário
      await addToInventario(coloniaId, old.toString(), 1);
    }

    // resposta populada (apenas do explorador alterado)
    const populated = await Colonia.findById(coloniaId)
      .select("exploradores inventario")
      .populate(
        "exploradores.equipment.arma exploradores.equipment.armadura exploradores.equipment.gadget",
        "nome tipo raridade icone"
      )
      .populate("inventario.itemId", "nome tipo raridade icone");

    res.json({
      inventario: populated.inventario,
      explorador: populated.exploradores.find((e) => e.id === explorerId),
    });
  } catch (e) {
    // em caso de erro após ter removido do inventário, você pode optar por tentar reverter aqui
    res.status(400).json({ error: e.message });
  }
};

// POST /colonia/:coloniaId/exploradores/:explorerId/desequipar { slot }
exports.desequiparParaInventario = async (req, res) => {
  try {
    const { coloniaId, explorerId } = req.params;
    const { slot } = req.body;

    if (!["arma", "armadura", "gadget"].includes(slot))
      return res.status(400).json({ error: "slot inválido" });

    const col = await Colonia.findOne({
      _id: coloniaId,
      "exploradores.id": explorerId,
    });
    if (!col)
      return res
        .status(404)
        .json({ error: "Colônia/Explorador não encontrados" });

    const ex = col.exploradores.find((e) => e.id === explorerId);
    const cur = ex.equipment?.[slot] || null;
    if (!cur)
      return res.status(400).json({ error: `Nada equipado em ${slot}` });

    // devolve 1 ao inventário
    await addToInventario(coloniaId, cur.toString(), 1);

    // limpa slot
    ex.equipment[slot] = null;
    ex.updatedAt = Date.now();
    await col.save();

    const populated = await Colonia.findById(coloniaId)
      .select("exploradores inventario")
      .populate(
        "exploradores.equipment.arma exploradores.equipment.armadura exploradores.equipment.gadget",
        "nome tipo raridade icone"
      )
      .populate("inventario.itemId", "nome tipo raridade icone");

    res.json({
      inventario: populated.inventario,
      explorador: populated.exploradores.find((e) => e.id === explorerId),
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
