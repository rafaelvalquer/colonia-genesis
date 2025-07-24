import { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ParameterPanel from "./components/ParameterPanel";
import StatusPanel from "./components/StatusPanel";
import { runSimulationTurn } from "./utils/simulationEngine";
import scenarioList from "./data/scenarios.json";
import buildings from "./data/buildings.json";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Slide from "@mui/material/Slide";
import AuthPage from "./pages/AuthPage"; // nova página de login
import coloniaService from "./services/coloniaService";

function GamePage({
  estadoAtual,
  setEstadoAtual,
  filaConstrucoes,
  setFilaConstrucoes,
  showSnackbar,
}) {
  const handleParametrosChange = async (parametrosSelecionados) => {
    const resultado = runSimulationTurn(
      estadoAtual,
      parametrosSelecionados,
      scenarioList[0],
      parametrosSelecionados.filaConstrucoes,
      buildings
    );

    setEstadoAtual(resultado.novoEstado);
    setFilaConstrucoes(resultado.novaFila);

    console.log(JSON.stringify(resultado));

    // Envia para o backend (supondo que você tenha o id da colônia salvo em `coloniaId`)
    try {
      await coloniaService.atualizarColonia(
        estadoAtual._id,
        resultado.novoEstado
      );
    } catch (err) {
      console.error("Erro ao atualizar colônia no backend:", err);
    }
  };

  const handleConstruir = async (tipo) => {
    const construcao = buildings[tipo];
    if (!construcao) return;

    console.log("filaConstrucoes --- " + filaConstrucoes);
    const { custo, tempo, nome } = construcao;

    const quantidadeNaFila = filaConstrucoes.filter(
      (fc) => fc.id === tipo
    ).length;
    const quantidadeConstruida = estadoAtual.construcoes?.[tipo] || 0;

    const multiplicador = 2 ** (quantidadeConstruida + quantidadeNaFila);

    console.log("multiplicador");
    console.log(multiplicador);

    // Verifica se há recursos suficientes, limitando a água em 100
    const temRecursos = Object.entries(custo).every(([recurso, valor]) => {
      const total = valor * multiplicador;
      const valorFinal = recurso === "agua" ? Math.min(total, 100) : total;
      return estadoAtual[recurso] >= valorFinal;
    });

    if (!temRecursos) {
      showSnackbar("❌ Recursos insuficientes para construção.", "error");
      return;
    }

    // Atualiza o estado com o desconto dos recursos, limitando a água
    const novoEstado = { ...estadoAtual };
    Object.entries(custo).forEach(([recurso, valor]) => {
      const total = valor * multiplicador;
      const valorFinal = recurso === "agua" ? Math.min(total, 100) : total;
      novoEstado[recurso] -= valorFinal;
    });

    const novaFila = [
      ...filaConstrucoes,
      { id: tipo, nome, tempoRestante: tempo },
    ];

    novoEstado.filaConstrucoes = novaFila;

    setEstadoAtual(novoEstado);
    setFilaConstrucoes(novaFila);

    showSnackbar(`✅ Construção de ${nome} iniciada!`, "success");

    console.log(JSON.stringify(novoEstado));

    // 👉 Força re-render nos filhos
    setRefresh((prev) => prev + 1);

    // Envia para o backend
    try {
      await coloniaService.atualizarColonia(estadoAtual._id, novoEstado);
    } catch (err) {
      console.error("Erro ao atualizar colônia no backend:", err);
    }
  };

  const handleGastarCiencia = async (quantidade, novaConexao = null) => {
    if (estadoAtual.ciencia < quantidade) {
      showSnackbar("❌ Ciência insuficiente!", "error");
      return false;
    }

    const novoEstado = {
      ...estadoAtual,
      ciencia: estadoAtual.ciencia - quantidade,
    };

    // Se tiver conexão nova, já adiciona
    if (novaConexao) {
      novoEstado.pesquisa = [...(estadoAtual.pesquisa || []), novaConexao];
    }

    setEstadoAtual(novoEstado);
    showSnackbar(`✅ Você gastou ${quantidade} de ciência!`, "success");

    try {
      await coloniaService.atualizarColonia(estadoAtual._id, novoEstado);
    } catch (err) {
      console.error("Erro ao atualizar colônia no backend:", err);
    }

    return true;
  };

  return (
    <>
      <h1 className="text-3xl font-bold text-center mb-6">Colônia Gênesis</h1>

      <section
        id="status"
        className="bg-slate-800 rounded-lg p-4 flex flex-wrap justify-around mb-6 shadow-lg"
      >
        <StatusPanel estado={estadoAtual} />
      </section>

      <section id="distribuicao">
        <ParameterPanel
          onChange={handleParametrosChange}
          populacao={estadoAtual.populacao}
          estadoAtual={estadoAtual}
          onConstruir={handleConstruir}
          filaConstrucoes={estadoAtual.filaConstrucoes}
          onGastarCiencia={handleGastarCiencia}
        />
      </section>
    </>
  );
}

function App() {
  const [estadoAtual, setEstadoAtual] = useState(null); // começa sem colônia
  const [filaConstrucoes, setFilaConstrucoes] = useState([]);
  const [snackbarQueue, setSnackbarQueue] = useState([]);

  const showSnackbar = (mensagem, tipo = "info") => {
    const id = Date.now();
    setSnackbarQueue((prev) => [...prev, { id, mensagem, tipo }]);
    setTimeout(() => {
      setSnackbarQueue((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  };

  return (
    <Router>
      <div className="flex h-screen bg-slate-900 text-white overflow-auto">
        <main className="flex-1 p-6">
          <Routes>
            <Route
              path="/"
              element={<AuthPage setEstadoAtual={setEstadoAtual} />}
            />
            <Route
              path="/jogo"
              element={
                estadoAtual ? (
                  <GamePage
                    estadoAtual={estadoAtual}
                    setEstadoAtual={setEstadoAtual}
                    filaConstrucoes={estadoAtual.filaConstrucoes}
                    setFilaConstrucoes={setFilaConstrucoes}
                    showSnackbar={showSnackbar}
                  />
                ) : (
                  <div className="text-center text-lg">
                    Carregando colônia...
                  </div>
                )
              }
            />
          </Routes>
        </main>

        <Box
          sx={{
            position: "fixed",
            bottom: 16,
            left: 16,
            zIndex: 1400,
            display: "flex",
            flexDirection: "column-reverse",
            gap: 1,
          }}
        >
          {snackbarQueue.map((snack) => (
            <Slide key={snack.id} direction="up" in={true}>
              <Snackbar
                open={true}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
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
    </Router>
  );
}

export default App;
