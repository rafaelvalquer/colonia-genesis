// src/pages/CreateAccountForm.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import coloniaService from "../services/coloniaService";

export default function CreateAccountForm({ setEstadoAtual }) {
  const [nome, setNome] = useState("");
  const navigate = useNavigate();

  const handleCreate = async () => {
    try {
      const novaColonia = await coloniaService.criarColonia(nome);
    setEstadoAtual(novaColonia);
      navigate("/jogo");
      console.log("Colônia criada:", novaColonia);
    } catch (err) {
      alert("Erro ao criar colônia.");
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
      />
      <button
        onClick={handleCreate}
        className="w-full bg-green-600 hover:bg-green-700 p-2 rounded"
      >
        Criar
      </button>
    </>
  );
}
