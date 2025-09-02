// src/pages/CreateAccountForm.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import coloniaService from "../services/coloniaService";

export default function CreateAccountForm({ setEstadoAtual }) {
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) return alert("Informe um nome para a colônia.");

    try {
      setLoading(true);
      const novaColonia = await coloniaService.criarColonia(nomeTrim);

      // guarda para o fluxo que busca por nome depois
      localStorage.setItem("nomeColonia", novaColonia.nome);

      setEstadoAtual(novaColonia);
      navigate("/jogo");
      console.log("Colônia criada:", novaColonia);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.erro || "Erro ao criar colônia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Criar Conta</h2>
      <input
        type="text"
        placeholder="Nome da Colônia"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 mb-4 text-white"
        disabled={loading}
      />
      <button
        onClick={handleCreate}
        className="w-full bg-green-600 hover:bg-green-700 p-2 rounded disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Criando..." : "Criar"}
      </button>
    </>
  );
}
