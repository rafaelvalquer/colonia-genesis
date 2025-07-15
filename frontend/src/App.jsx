import { useState } from "react";
import ParameterPanel from "./components/ParameterPanel";
import StatusPanel from "./components/StatusPanel";
import { runSimulationTurn } from "./utils/simulationEngine";
import scenarioList from "./data/scenarios.json";
import buildings from "./data/buildings.json";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Slide from "@mui/material/Slide";

function App() {
  // Pegando o primeiro cenário por enquanto
  const cenarioSelecionado = scenarioList[0];

  const [estadoAtual, setEstadoAtual] = useState({
    nome: "",
    turno: 1,
    integridadeEstrutural: 100,
    populacao: cenarioSelecionado.populacaoInicial,
    energia: cenarioSelecionado.energiaInicial,
    agua: cenarioSelecionado.aguaInicial,
    maxAgua: 100,
    comida: cenarioSelecionado.comidaInicial,
    minerais: cenarioSelecionado.mineraisIniciais,
    saude: cenarioSelecionado.saude,
    sustentabilidade: 100,
    ciencia: 100,
    construcoes: {
      fazenda: 0,
      sistemaDeIrrigacao: 0,
      torreDeVigilancia: 0,
      muralhaReforcada: 0,
      minaDeCarvao: 0,
      minaProfunda: 0,
      centroDePesquisa: 0,
      laboratorioAvancado: 0,
      postoMedico: 0,
      hospitalCentral: 0,
      geradorSolar: 0,
      reatorGeotermico: 0,
      estacaoDeTratamento: 0,
      coletorAtmosferico: 0,
      // depois: defesa, minas...
    },
    pesquisa: [],
  });

  const [filaConstrucoes, setFilaConstrucoes] = useState([]);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbarQueue, setSnackbarQueue] = useState([]);

  const showSnackbar = (mensagem, tipo = "info") => {
    const id = Date.now();
    setSnackbarQueue((prev) => [...prev, { id, mensagem, tipo }]);

    // Remover automaticamente após 3 segundos
    setTimeout(() => {
      setSnackbarQueue((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  };

  const handleParametrosChange = (parametrosSelecionados) => {
    setLoading(true); // inicia o carregamento

    setTimeout(() => {
      const resultado = runSimulationTurn(
        estadoAtual,
        parametrosSelecionados,
        cenarioSelecionado,
        parametrosSelecionados.filaConstrucoes,
        buildings
      );

      console.log("Novo resultado:", JSON.stringify(resultado));

      console.log("estadoAtual:", estadoAtual);
      console.log("parametrosSelecionados:", parametrosSelecionados);
      console.log("cenarioSelecionado:", cenarioSelecionado);
      console.log("filaConstrucoes:", filaConstrucoes);

      console.log("parametrosSelecionados:", parametrosSelecionados);

      console.log("Novo resultado:", JSON.stringify(resultado));

      setEstadoAtual(resultado.novoEstado);
      setFilaConstrucoes(resultado.novaFila);
      setLog((old) => [...old, "Parâmetros atualizados!"]);

      setLoading(false); // encerra o carregamento
    }, 200); // pequeno delay para permitir render do spinner
  };

  const handleConstruir = (tipo) => {
    const construcao = buildings[tipo];
    if (!construcao) return;

    const { custo, tempo, nome } = construcao;

    const temRecursos = Object.entries(custo).every(
      ([recurso, valor]) => estadoAtual[recurso] >= valor
    );

    if (!temRecursos) {
      showSnackbar("❌ Recursos insuficientes para construção.", "error");
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

    showSnackbar(`✅ Construção de ${nome} iniciada!`, "success");
  };

  const handleGastarCiencia = (quantidade) => {
    if (estadoAtual.ciencia < quantidade) {
      showSnackbar("❌ Ciência insuficiente!", "error");
      return false; // Falha
    }

    const novoEstado = {
      ...estadoAtual,
      ciencia: estadoAtual.ciencia - quantidade,
    };
    setEstadoAtual(novoEstado);
    showSnackbar(`✅ Você gastou ${quantidade} de ciência!`, "success");
    return true; // Sucesso
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
            onGastarCiencia={handleGastarCiencia}
          />
        </section>
      </main>
      <Box
        sx={{
          position: "fixed",
          bottom: 16,
          left: 16,
          zIndex: 1400,
          display: "flex",
          flexDirection: "column-reverse", // empilha de baixo pra cima
          gap: 1,
        }}
      >
        {snackbarQueue.map((snack, index) => (
          <Slide
            key={snack.id}
            direction="up"
            in={true}
            mountOnEnter
            unmountOnExit
          >
            <Snackbar
              open={true}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              sx={{ position: "relative" }} // importante para Slide animar
            >
              <Alert
                severity={snack.tipo}
                variant="filled"
                sx={{ width: "100%" }}
              >
                {snack.mensagem}
              </Alert>
            </Snackbar>
          </Slide>
        ))}
      </Box>
    </div>
  );
}

export default App;
