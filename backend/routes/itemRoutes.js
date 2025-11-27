// backend/routes/itemRoutes.js
const router = require("express").Router();
const ctrl = require("../controllers/itemController");

// GET /itens?tipo=arma&raridade=raro&q=pisto&tags=leve,balistica&page=1&limit=50
router.get("/", ctrl.listar);

// GET /itens/:id
router.get("/:id", ctrl.detalhar);

module.exports = router;
