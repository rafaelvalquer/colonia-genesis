import GameCanvas from "../miniGame/GameCanvas";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import HUD from "../miniGame/HUD";

const MiniGamePage = () => {
  const location = useLocation();
  const estadoInicial = location.state?.estadoAtual;

  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);

  if (!estadoAtual) {
    return <div>Erro: Estado não fornecido</div>;
  }

  return (
    <div className="bg-slate-900 h-screen text-white p-4">
      <h1 className="text-2xl mb-4">Minigame: Tower Defense</h1>

      <HUD populacao={estadoAtual.populacao} />

      <GameCanvas 
        estadoAtual={estadoAtual} 
        onEstadoChange={setEstadoAtual} 
      />
    </div>
  );
};

export default MiniGamePage;
