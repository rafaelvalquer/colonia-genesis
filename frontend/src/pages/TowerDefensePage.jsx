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
    
    <div className="bg-gray-800 p-4 rounded-lg mb-4">
      <h2 className="text-lg font-semibold mb-2">Tropas Disponíveis</h2>
      <div className="flex justify-between">
        <div className="flex gap-1 mb-4">
          <div className="pr-4">
            <p className="text-sm text-slate-400">Colonos</p>
            <p className="text-xl font-mono">{estadoAtual.populacao.colonos}</p>
          </div>
          <div className="border-l border-slate-600 pl-4">
            <p className="text-sm text-slate-400">Marines</p>
            <p className="text-xl font-mono">{estadoAtual.populacao.marines}</p>
          </div>
        </div>
      </div>
    </div>
    
    <GameCanvas estadoAtual={estadoAtual} />
  </div>
);


};

export default MiniGamePage;
