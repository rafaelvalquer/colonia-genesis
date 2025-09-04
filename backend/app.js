// backend/app.js
const express = require("express");
const cors = require("cors");

// Rotas
const coloniaRoutes = require("./routes/coloniaRoutes");

const app = express();

// Middlewares
app.use(cors());

// ✅ Defina um ÚNICO parser com limite adequado antes das rotas
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use(express.json());

// Rotas
app.use("/colonia", coloniaRoutes);

module.exports = app;
