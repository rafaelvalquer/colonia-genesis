// backend/server.js
const http = require("http");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app"); // importa o app configurado

dotenv.config();

const PORT = Number(process.env.PORT || 5000);

// Monte a URI a partir das variáveis base
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = encodeURIComponent(process.env.DB_PASSWORD || "");
const DB_NAME = process.env.MONGO_DB || "coloniaGenesis";

// Se houver MONGO_URI explícita, use-a; senão, construa
const MONGO_URI =
  `mongodb+srv://${DB_USER}:${DB_PASSWORD}` +
  `@cluster0.ukwimz7.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

let server; // referência ao servidor HTTP
let shuttingDown = false; // evita múltiplos shutdowns

async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      // Em Mongoose 8, estes flags são padrão, mas mantidos por clareza:
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Conectado ao MongoDB Atlas com sucesso!");

    server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });

    // Trata erros do servidor HTTP
    server.on("error", (err) => {
      console.error("❌ Erro no servidor HTTP:", err);
      process.exit(1);
    });
  } catch (err) {
    console.error("❌ Erro ao conectar ao MongoDB Atlas:", err);
    process.exit(1);
  }
}

/**
 * Fechamento gracioso:
 * - Para aceitar novas conexões (server.close)
 * - Aguarda conexões existentes finalizarem
 * - Fecha conexão com Mongo
 * - Encerra o processo com timeout de segurança
 */
function gracefulShutdown(signal) {
  return async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n📴 Recebido ${signal}. Iniciando shutdown gracioso...`);

    // Timeout de segurança para evitar travar indefinidamente
    const FORCE_EXIT_AFTER_MS = 10000;
    const forceExitTimer = setTimeout(() => {
      console.warn("⏱️ Timeout no shutdown. Forçando encerramento.");
      process.exit(1);
    }, FORCE_EXIT_AFTER_MS).unref();

    try {
      // 1) Para aceitar novas conexões
      if (server) {
        await new Promise((resolve) => {
          server.close((err) => {
            if (err) {
              console.error("Erro ao fechar servidor HTTP:", err);
            } else {
              console.log(
                "🛑 Servidor HTTP encerrado (não aceita novas conexões)."
              );
            }
            resolve();
          });
        });
      }

      // 2) Fecha conexão Mongo
      try {
        await mongoose.disconnect();
        console.log("🔒 Conexão com Mongo encerrada.");
      } catch (e) {
        console.error("Erro ao encerrar conexão Mongo:", e?.message || e);
      }

      clearTimeout(forceExitTimer);
      console.log("✅ Shutdown concluído com sucesso. Até mais!");
      process.exit(0);
    } catch (e) {
      clearTimeout(forceExitTimer);
      console.error("❌ Erro no shutdown:", e?.message || e);
      process.exit(1);
    }
  };
}

// Sinais de encerramento (Docker/K8s/PM2/etc)
process.on("SIGINT", gracefulShutdown("SIGINT"));
process.on("SIGTERM", gracefulShutdown("SIGTERM"));

// Extras: trate rejeições não-capturadas para derrubar o processo de forma controlada
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ unhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ uncaughtException:", err);
  // opcional: iniciar shutdown gracioso
  gracefulShutdown("uncaughtException")();
});

start();
