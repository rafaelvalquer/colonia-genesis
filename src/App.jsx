import { useState } from "react";
import ParameterPanel from "./components/ParameterPanel";
import StatusPanel from "./components/StatusPanel";
import { runSimulationTurn } from "./utils/simulationEngine";
import scenarioList from "./data/scenarios.json";
import buildings from "./data/buildings.json";

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
    construcoes: {
      fazenda: 0,
      sistemaDeIrrigacao: 0,
      // depois: defesa, minas...
    },
  });

  const [filaConstrucoes, setFilaConstrucoes] = useState([]);
  const [log, setLog] = useState([]);


  const handleParametrosChange = (parametrosSelecionados) => {
    console.log("estadoAtual:", estadoAtual);
    console.log("parametrosSelecionados:", parametrosSelecionados);
    console.log("cenarioSelecionado:", cenarioSelecionado);
    console.log("filaConstrucoes:", filaConstrucoes);

        console.log("parametrosSelecionados:", parametrosSelecionados);

    const resultado = runSimulationTurn(
      estadoAtual,
      parametrosSelecionados,
      cenarioSelecionado,
      parametrosSelecionados.filaConstrucoes,
      buildings
    );

    console.log("Novo resultado:", JSON.stringify(resultado));

    console.log("Novo estado:", resultado.novoEstado);
    console.log("Log da rodada:");
    resultado.log.forEach((msg) => console.log("•", msg));

    // Atualiza o estado para o próximo turno
    setEstadoAtual(resultado.novoEstado);
    setFilaConstrucoes(resultado.novaFila); // atualiza fila
    setLog((old) => [...old, "Parâmetros atualizados!"]);
  };

  const handleConstruir = (tipo) => {
    const construcao = buildings[tipo];
    if (!construcao) return;

    const { custo, tempo, nome } = construcao;

    const temRecursos = Object.entries(custo).every(
      ([recurso, valor]) => estadoAtual[recurso] >= valor
    );

    if (!temRecursos) {
      alert("Recursos insuficientes para construir.");
      return;
    }

    // Desconta os recursos, mas não aplica a construção ainda
    const novoEstado = { ...estadoAtual };
    Object.entries(custo).forEach(([recurso, valor]) => {
      novoEstado[recurso] -= valor;
    });

    setEstadoAtual(novoEstado);

    // Adiciona à fila
    setFilaConstrucoes((fila) => [
      ...fila,
      {
        id: tipo,
        nome,
        tempoRestante: tempo,
      },
    ]);
  };


  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="text-3xl font-bold text-center mb-6">Colônia Gênesis</h1>

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
            estadoAtual={estadoAtual}
            onConstruir={handleConstruir}
            filaConstrucoes={filaConstrucoes}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
