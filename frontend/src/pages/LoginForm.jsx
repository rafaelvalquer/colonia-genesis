// src/pages/LoginForm.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import coloniaService from "../services/coloniaService";

export default function LoginForm({ setEstadoAtual }) {
  const [nome, setNome] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const colonia = await coloniaService.buscarColonia(nome);
      if (colonia) {
        // salve no estado global ou redirecione
        console.log("Login OK:", colonia);
        localStorage.setItem("nomeColonia", colonia.nome); // ou dados._id
        setEstadoAtual(colonia);
        navigate("/jogo");
      } else {
        alert("Colônia não encontrada.");
      }
    } catch (err) {
      alert("Erro ao buscar colônia.");
    }
  };

  return (
    <>
      <h2 className="text-lg font-semibold mb-4">Entrar</h2>
      <input
        type="text"
        placeholder="Nome da Colônia"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        className="w-full p-2 rounded bg-gray-700 mb-4 text-white"
      />
      <button
        onClick={handleLogin}
        className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded"
      >
        Entrar
      </button>
    </>
  );
}
