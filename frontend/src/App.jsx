//src/App.jsx
import { useState, useEffect } from "react";
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
import IntroFlow from "./pages/IntroFlow"; // << ADICIONE
import coloniaService from "./services/coloniaService";
import useWaterTicker from "./hooks/useWaterTicker";
import MiniGamePage from "./pages/TowerDefensePage.jsx"; // novo
import { useNavigate } from "react-router-dom";

function GamePage({
  estadoAtual,
  setEstadoAtual,
  filaConstrucoes,
  setFilaConstrucoes,
  showSnackbar,
}) {
  useEffect(() => {
    const buscarColoniaAtualizada = async () => {
      try {
        const nomeSalvo = localStorage.getItem("nomeColonia"); // ou outro identificador
        if (nomeSalvo) {
          const novaColonia = await coloniaService.buscarColonia(nomeSalvo);
          setEstadoAtual(novaColonia);
          setFilaConstrucoes(novaColonia.filaConstrucoes || []);
        }
      } catch (err) {
        console.error("Erro ao buscar colônia:", err);
        showSnackbar("❌ Erro ao carregar dados da colônia.", "error");
      }
    };

    buscarColoniaAtualizada();
  }, []);

  // revalidação no tick do servidor
  const refetchEstado = async () => {
    try {
      if (!estadoAtual?._id) return;
      const d = await coloniaService.getEstado(estadoAtual._id);
      setEstadoAtual(d);
      setFilaConstrucoes(d.filaConstrucoes || []);
    } catch (e) {
      console.error(e);
    }
  };
  useWaterTicker({
    nextAt: estadoAtual?.water?.nextAt ?? null,
    rateMs: estadoAtual?.water?.rateMs ?? 60000,
    onTick: refetchEstado,
  });

  // App.jsx (dentro de GamePage)
  const handleParametrosChange = async (parametrosSelecionados) => {
    try {
      const consumo = Number(parametrosSelecionados.agua) || 1;
      const custoAgua =
        Number(parametrosSelecionados.custoAgua) ??
        (consumo === 0.5 ? 5 : consumo === 1.5 ? 20 : 10);

      // valida e debita água
      if (custoAgua > 0) {
        if ((estadoAtual.agua ?? 0) < custoAgua) {
          showSnackbar(
            "❌ Água insuficiente para aplicar os parâmetros.",
            "error"
          );
          // lança no formato esperado pelo catch do ParameterPanel
          throw { response: { status: 409 }, message: "agua_insuficiente" };
        }
      }

      const estadoComDebito = {
        ...estadoAtual,
        agua: Math.max(0, (estadoAtual.agua ?? 0) - (custoAgua || 0)),
      };

      const { novoEstado, novaFila, turnReport } = runSimulationTurn(
        estadoComDebito, // <<< usa estado já debitado
        parametrosSelecionados,
        scenarioList?.[0],
        parametrosSelecionados.filaConstrucoes ?? estadoAtual.filaConstrucoes,
        buildings
      );

      setEstadoAtual(novoEstado);
      setFilaConstrucoes(novaFila);

      await coloniaService.atualizarColonia(
        novoEstado._id ?? estadoAtual._id,
        novoEstado
      );
      return turnReport;
    } catch (err) {
      // propaga para o ParameterPanel abrir o modal de água se for 409
      throw err;
    }
  };

  const generateNextExplorerId = (exploradores = []) => {
    const maxNum = exploradores.reduce((acc, e) => {
      const m = /^exp_(\d+)$/.exec(e?.id || "");
      return Math.max(acc, m ? parseInt(m[1], 10) : 0);
    }, 0);
    const next = maxNum + 1;
    return `exp_${String(next).padStart(3, "0")}`;
  };

  const createExplorer = (idStr, ordinalNumber = 1) => {
    const baseName = `explorador${ordinalNumber}`;
    const now = Date.now();
    return {
      id: idStr,
      name: baseName,
      nickname: baseName,
      level: 1,
      xp: 0,
      xpNext: 10,
      hp: { current: 10, max: 10 },
      stamina: { current: 10, max: 10 },
      skills: {
        combate: 0,
        ciencia: 0,
        furtividade: 0,
        forca: 0,
        arqueologia: 0,
        sobrevivencia: 0,
      },
      traits: [],
      equipment: { arma: null, armadura: null, gadget: null },
      status: "disponivel",
      missionId: null,
      portrait: null,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleCriarTropa = async (item) => {
    const { id, nome, custo } = item;

    console.log(id);

    // 1) Verifica recursos
    const temRecursos = Object.entries(custo).every(([recurso, valor]) => {
      const valorFinal = recurso === "agua" ? Math.min(valor, 100) : valor;
      return estadoAtual[recurso] >= valorFinal;
    });

    if (!temRecursos) {
      showSnackbar("❌ Recursos insuficientes para criar tropa.", "error");
      return;
    }

    // 2) Clona estado e desconta recursos
    const novoEstado = {
      ...estadoAtual,
      exploradores: [...(estadoAtual.exploradores || [])], // garante array
      populacao: { ...estadoAtual.populacao },
    };

    // debita água no servidor primeiro
    const aguaCost = Math.min(custo.agua || 0, 100);
    if (aguaCost > 0) {
      try {
        const d = await coloniaService.gastarAgua(estadoAtual._id, aguaCost);
        setEstadoAtual(d);
        // sincroniza base para descontos locais
        novoEstado.agua = d.agua;
      } catch (e) {
        if (e?.response?.status === 409) {
          showSnackbar("❌ Água insuficiente para criar.", "error");
          return;
        }
        throw e;
      }
    }
    // desconta demais recursos localmente
    Object.entries(custo).forEach(([recurso, valor]) => {
      if (recurso === "agua") return;
      novoEstado[recurso] -= valor;
    });

    // 3) Ramo normal (colonos, marines etc.)
    if (id !== "exploradores") {
      novoEstado.populacao[id] = (novoEstado.populacao[id] || 0) + 1;
    } else {
      // 3b) Criar EXPLORADOR completo + incrementar populacao.exploradores
      const nextId = generateNextExplorerId(novoEstado.exploradores);
      // usa o número gerado para montar "exploradorN"
      const ordinal = parseInt(nextId.split("_")[1], 10); // ex: "exp_007" -> 7
      const novoExplorador = createExplorer(nextId, ordinal);

      novoEstado.exploradores.push(novoExplorador);
      novoEstado.populacao.exploradores =
        (novoEstado.populacao.exploradores || 0) + 1;
    }

    console.log(novoEstado);

    // 4) Atualiza UI
    setEstadoAtual(novoEstado);
    showSnackbar(`✅ ${nome} criado com sucesso!`, "success");

    // 5) Sincroniza com backend
    try {
      await coloniaService.atualizarColonia(estadoAtual._id, novoEstado);
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
    // debita água no servidor primeiro
    const totalAgua = Math.min((custo.agua || 0) * multiplicador, 100);
    if (totalAgua > 0) {
      try {
        const d = await coloniaService.gastarAgua(estadoAtual._id, totalAgua);
        setEstadoAtual(d);
        novoEstado.agua = d.agua;
      } catch (e) {
        if (e?.response?.status === 409) {
          showSnackbar("❌ Água insuficiente para construir.", "error");
          return;
        }
        throw e;
      }
    }
    // desconta demais recursos localmente
    Object.entries(custo).forEach(([recurso, valor]) => {
      if (recurso === "agua") return;
      const total = valor * multiplicador;
      novoEstado[recurso] -= total;
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
      <h1 className="text-3xl font-bold text-center mb-6">
        Colônia {estadoAtual.nome}
      </h1>

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
          onCriarTropa={handleCriarTropa}
          onEstadoChange={setEstadoAtual}
        />
      </section>
    </>
  );
}

function App() {
  const [estadoAtual, setEstadoAtual] = useState(null); // começa sem colônia
  const [filaConstrucoes, setFilaConstrucoes] = useState([]);
  const [snackbarQueue, setSnackbarQueue] = useState([]);
  const [turnReport, setTurnReport] = useState(null);

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
            {/* Intro/Tutorial mostrado após criar conta */}
            <Route path="/intro" element={<IntroFlow />} />
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
            <Route path="/minigame" element={<MiniGamePage />} />{" "}
            {/* Adicionado */}
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
