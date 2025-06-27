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
    console.log("cenarioSelecionado:", cenarioSelecionado);
    console.log("Parâmetros aplicados:", parametrosSelecionados);

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
    <div className="app">
      <h1>Colônia Gênesis</h1>
      <StatusPanel estado={estadoAtual} />
      <ParameterPanel
        onChange={handleParametrosChange}
        populacao={estadoAtual.populacao}
      />
    </div>
  );
}

export default App;
//teste
