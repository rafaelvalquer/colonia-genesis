// src/pages/ExplorerPage.jsx
import { useLocation } from "react-router-dom";
import { useState } from "react";
import ExplorerCanvas from "../explorador/GameCanvas"; // ajuste o caminho se diferente

const ExplorerPage = () => {
  const location = useLocation();
  const estadoInicial = location.state?.estadoAtual;

  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);

  if (!estadoAtual) {
    return <div className="p-4 text-red-300">Erro: Estado não fornecido</div>;
  }

  return (
    <div className="bg-slate-900 h-screen text-white p-4">
      <ExplorerCanvas
        estadoAtual={estadoAtual}
        onEstadoChange={setEstadoAtual}
      />
    </div>
  );
};

export default ExplorerPage;
