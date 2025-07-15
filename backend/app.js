// backend/app.js
const express = require("express");
const cors = require("cors");

// Rotas
const coloniaRoutes = require("./routes/coloniaRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use("/colonia", coloniaRoutes);

module.exports = app;
