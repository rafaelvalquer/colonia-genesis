// backend/routes/personagemRoutes.js
const express = require("express");
const router = express.Router();
const coloniaController = require("../controllers/coloniaController");

// POST: Criar nova colônia
router.post("/", coloniaController.criarColonia);

// PUT: Atualizar colônia existente
router.put("/:id", coloniaController.atualizarColonia);

module.exports = router;
