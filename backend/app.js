// backend/app.js
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const itemRoutes = require("./routes/itemRoutes");

// Rotas
const coloniaRoutes = require("./routes/coloniaRoutes");

const app = express();

// Middlewares
app.use(cors());

// Evitar cache em endpoints (útil para health checks)
app.use((req, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  next();
});

// ✅ Defina um ÚNICO parser com limite adequado antes das rotas
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ===== Endpoints de Saúde =====

// Liveness: somente verifica se o processo está de pé
app.get("/healthz", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    service: "colonia-genesis-backend",
    uptime_s: Math.round(process.uptime()),
    node: process.versions.node,
    memory_mb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

// Readiness: só retorna 200 quando o MongoDB estiver conectado
app.get("/readyz", async (req, res) => {
  const stateMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
    99: "uninitialized",
  };
  const readyState = mongoose.connection?.readyState ?? 99;

  if (readyState !== 1) {
    return res.status(503).json({
      status: "unready",
      db: stateMap[readyState] || String(readyState),
      timestamp: new Date().toISOString(),
    });
  }

  // Ping opcional com timeout curto
  let pingMs = null;
  try {
    const t0 = Date.now();
    await mongoose.connection.db.admin().command({ ping: 1 });
    pingMs = Date.now() - t0;
  } catch (_) {
    // mantém pingMs = null; readiness ainda é true pois estamos conectados
  }

  res.json({
    status: "ready",
    db: stateMap[readyState] || String(readyState),
    ping_ms: pingMs,
    timestamp: new Date().toISOString(),
  });
});

// Rotas de domínio
app.use("/colonia", coloniaRoutes);

// 404 padrão
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use("/itens", itemRoutes);

module.exports = app;
