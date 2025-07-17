// src/pages/AuthPage.js
import React, { useState } from "react";
import LoginForm from "./LoginForm";
import CreateAccountForm from "./CreateAccountForm";

export default function AuthPage({ setEstadoAtual }) {
  const [modo, setModo] = useState("login");

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Colônia Gênesis</h1>

        {modo === "login" ? (
          <>
            <LoginForm setEstadoAtual={setEstadoAtual} />
            <p className="text-center mt-4">
              Não tem uma conta?{" "}
              <button className="text-blue-400" onClick={() => setModo("criar")}>
                Criar conta
              </button>
            </p>
          </>
        ) : (
          <>
            <CreateAccountForm setEstadoAtual={setEstadoAtual} />
            <p className="text-center mt-4">
              Já tem conta?{" "}
              <button className="text-blue-400" onClick={() => setModo("login")}>
                Fazer login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
