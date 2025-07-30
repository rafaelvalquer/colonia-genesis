import GameCanvas from "../miniGame/GameCanvas";
import { useLocation } from "react-router-dom";

const MiniGamePage = () => {
  const location = useLocation();
  const estadoAtual = location.state?.estadoAtual;

  if (!estadoAtual) {
    return <div>Erro: Estado não fornecido</div>;
  }

  return (
    <div className="bg-slate-900 h-screen text-white p-4">
      <h1 className="text-2xl mb-4">Minigame: Tower Defense</h1>
      <p>População: {estadoAtual.populacao}</p>
      <GameCanvas estadoAtual={estadoAtual} />
    </div>
  );
};

export default MiniGamePage;
