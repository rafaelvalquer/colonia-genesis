//scripts/seed-itens.js
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Item = require("../models/item");

function buildMongoSrvUri() {
  const DB_USER = process.env.DB_USER || "";
  const DB_PASSWORD = encodeURIComponent(process.env.DB_PASSWORD || "");
  const DB_NAME = process.env.MONGO_DB || "coloniaGenesis";

  // Ajuste o host do seu cluster se necessário
  return (
    `mongodb+srv://${DB_USER}:${DB_PASSWORD}` +
    `@cluster0.ukwimz7.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`
  );
}

async function main() {
  const MONGO_SRV_URI = buildMongoSrvUri();

  await mongoose.connect(MONGO_SRV_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Quando a URI já inclui o DB, dbName é opcional; manter por clareza:
    dbName: process.env.MONGO_DB || "coloniaGenesis",
  });

  // Garante índices (inclui o índice único nome+versaoItem)
  await Item.syncIndexes();

  const file = path.join(__dirname, "..", "data", "itens.json");
  const raw = fs.readFileSync(file, "utf-8");
  const itens = JSON.parse(raw);

  if (!Array.isArray(itens) || itens.length === 0) {
    console.log("Nada para semear: data/itens.json vazio.");
    await mongoose.disconnect();
    return;
  }

  // Upsert por (nome, versaoItem)
  const ops = itens.map((doc) => ({
    updateOne: {
      filter: { nome: doc.nome, versaoItem: doc.versaoItem ?? 1 },
      update: { $set: doc },
      upsert: true,
    },
  }));

  const res = await Item.bulkWrite(ops, { ordered: false });

  console.log("— Seed de itens concluído —");
  console.log(`Arquivo: ${file}`);
  console.log(`Total processado: ${itens.length}`);
  console.log(`Upserts (novos): ${res.upsertedCount || 0}`);
  console.log(`Atualizados (existentes): ${res.modifiedCount || 0}`);

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Erro no seed:", e?.message || e);
    mongoose.disconnect().finally(() => process.exit(1));
  });
