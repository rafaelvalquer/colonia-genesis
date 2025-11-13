// backend/routes/coloniaRoutes.js
const express = require("express");
const router = express.Router();
const coloniaController = require("../controllers/coloniaController");

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

module.exports = router;
