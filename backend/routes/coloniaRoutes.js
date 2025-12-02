// backend/routes/coloniaRoutes.js
const express = require("express");
const router = express.Router();
const coloniaController = require("../controllers/coloniaController");
const exploradorCtrl = require("../controllers/exploradorController");
const invCtrl = require("../controllers/inventarioController");

// POST: Criar nova colônia
router.post("/", coloniaController.criarColonia);

// PUT: Atualizar colônia existente
router.put("/:id", coloniaController.atualizarColonia);

// PATCH: Atualizar um explorador específico
router.patch(
  "/:id/exploradores/:explorerId",
  coloniaController.atualizarExplorador
);

// GET: Buscar colônia por nome
router.get("/buscar/:nome", coloniaController.buscarColoniaPorNome);

// GET estado por ID (aplica regen on-read)
router.get("/:id/estado", coloniaController.getEstadoPorId);

// POST gastar água
router.post("/:id/gastar-agua", coloniaController.gastarAgua);

// GET Ranking
router.get("/ranking", coloniaController.getRanking);

//Equipar explorador
router.put(
  "/:coloniaId/exploradores/:explorerId/equipar",
  exploradorCtrl.equipar
);

router.get(
  "/:coloniaId/exploradores/:explorerId/detalhe",
  coloniaController.getExploradorDetalhado
);

// Inventário global da colônia
router.get("/:coloniaId/inventario", invCtrl.listar);
router.post("/:coloniaId/inventario/adicionar", invCtrl.adicionar);
router.post("/:coloniaId/inventario/remover", invCtrl.remover);

// Equipar direto do inventário global
router.post(
  "/:coloniaId/exploradores/:explorerId/equipar",
  invCtrl.equiparDoInventario
);
router.post(
  "/:coloniaId/exploradores/:explorerId/desequipar",
  invCtrl.desequiparParaInventario
);

module.exports = router;
