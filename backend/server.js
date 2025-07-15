// backend/server.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app"); // importa o app configurado

// Carrega as variáveis de ambiente ANTES de acessá-las
dotenv.config();

const PORT = process.env.PORT || 5000;
const user = process.env.DB_USER;
const password = encodeURIComponent(process.env.DB_PASSWORD);
const uri = `mongodb+srv://${user}:${password}@cluster0.ukwimz7.mongodb.net/coloniaGenesis?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Conectado ao MongoDB Atlas com sucesso!");
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar ao MongoDB Atlas:", err);
  });
