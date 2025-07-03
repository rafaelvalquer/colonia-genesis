import { useState } from "react";
import ParameterPanel from "./components/ParameterPanel";
import StatusPanel from "./components/StatusPanel";
import { runSimulationTurn } from "./utils/simulationEngine";
import scenarioList from "./data/scenarios.json";

function App() {
  // Pegando o primeiro cenário por enquanto
  const cenarioSelecionado = scenarioList[0];

  const [estadoAtual, setEstadoAtual] = useState({
    turno: 1,
    integridadeEstrutural: 100,
    populacao: cenarioSelecionado.populacaoInicial,
    energia: cenarioSelecionado.energiaInicial,
    agua: cenarioSelecionado.aguaInicial,
    comida: cenarioSelecionado.comidaInicial,
    minerais: cenarioSelecionado.mineraisIniciais,
    saude: cenarioSelecionado.saude,
    sustentabilidade: 50,
  });

  const handleParametrosChange = (parametrosSelecionados) => {
    console.log("estadoAtual:", estadoAtual);
    console.log("Parâmetros aplicados:", parametrosSelecionados);
    console.log("cenarioSelecionado:", cenarioSelecionado);

    const resultado = runSimulationTurn(
      estadoAtual,
      parametrosSelecionados,
      cenarioSelecionado
    );

    console.log("Novo estado:", resultado.novoEstado);
    console.log("Log da rodada:");
    resultado.log.forEach((msg) => console.log("•", msg));

    // Atualiza o estado para o próximo turno
    setEstadoAtual(resultado.novoEstado);
  };

  return (
    <div className="flex h-screen bg-slate-900 text-white">

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-6">
          Colônia Gênesis
        </h1>

        {/* Painel de status */}
        <section
          id="status"
          className="bg-slate-800 rounded-lg p-4 flex flex-wrap justify-around mb-6 shadow-lg"
        >
          <StatusPanel estado={estadoAtual} />
        </section>

        {/* Painel de parâmetros */}
        <section id="distribuicao">
          <ParameterPanel
            onChange={handleParametrosChange}
            populacao={estadoAtual.populacao}
          />
        </section>
      </main>
    </div>
  );
}

export default App;