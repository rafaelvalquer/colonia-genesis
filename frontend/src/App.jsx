//src/App.jsx
import { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
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
import MiniGamePage from "./pages/TowerDefensePage.jsx";
import ExplorerPage from "./pages/ExplorerPage.jsx";
import useMainTour from "./hooks/useMainTour";
import {
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { useNavigate } from "react-router-dom";

function GamePage({
  estadoAtual,
  setEstadoAtual,
  filaConstrucoes,
  setFilaConstrucoes,
  showSnackbar,
}) {
  const { run } = useMainTour();
  const { state } = useLocation(); // opcional
  const [isCreating, setIsCreating] = useState(false); // 👈 adicione

  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleConfirmLogout = () => {
    try {
      localStorage.removeItem("nomeColonia");
      localStorage.removeItem("shouldStartMainTour"); // opcional
    } catch {}
    setEstadoAtual(null);
    navigate("/");
  };

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

  // Inicia o tour principal após o IntroFlow (quando os elementos estiverem prontos)
  useEffect(() => {
    if (!estadoAtual) return;

    const seenKey = `mainTour::${estadoAtual._id || "anon"}::v1`;
    const should = localStorage.getItem("shouldStartMainTour") === "1";
    const already = localStorage.getItem(seenKey) === "1";
    if (!should || already) return;

    const ready = () =>
      document.querySelector('[data-tour="status"]') &&
      document.querySelector('[data-tour="apply"]');

    let tries = 0;
    const maxTries = 80; // ~9.6s a 120ms
    const id = setInterval(() => {
      if (ready() || tries++ > maxTries) {
        run();
        localStorage.setItem("shouldStartMainTour", "0");
        localStorage.setItem(seenKey, "1");
        clearInterval(id);
      }
    }, 120);

    return () => clearInterval(id);
  }, [estadoAtual, run]);

  // App.jsx (dentro de GamePage)
  const handleParametrosChange = async (parametrosSelecionados) => {
    try {
      const consumo = Number(parametrosSelecionados.agua) || 1;
      const custoAgua =
        Number(parametrosSelecionados.custoAgua) ??
        (consumo === 0.5 ? 5 : consumo === 1.5 ? 20 : 10);

      let base = estadoAtual;
      if (custoAgua > 0) {
        if ((estadoAtual.agua ?? 0) < custoAgua) {
          showSnackbar(
            "❌ Água insuficiente para aplicar os parâmetros.",
            "error"
          );
          throw { response: { status: 409 } };
        }
        // ✅ debita e atualiza waterLastTs no servidor
        base = await coloniaService.gastarAgua(estadoAtual._id, custoAgua);
      }

      const { novoEstado, novaFila, turnReport } = runSimulationTurn(
        base, // <<< usa a BASE vinda do servidor
        parametrosSelecionados,
        scenarioList?.[0],
        parametrosSelecionados.filaConstrucoes ?? base.filaConstrucoes,
        buildings
      );

      setEstadoAtual(novoEstado);
      setFilaConstrucoes(novaFila);
      await coloniaService.atualizarColonia(
        novoEstado._id ?? base._id,
        novoEstado
      );
      return turnReport;
    } catch (err) {
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
        visao: 0,
        agilidade: 0,
        folego: 0,
        furtividade: 0,
        resiliencia: 0,
      },
      equipment: { arma: null, armadura: null, gadget: null },
      status: "disponivel",
      missionId: null,
      portrait: null,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleCriarTropa = async (item) => {
    if (isCreating) return; // evita reentrar
    setIsCreating(true);
    try {
      const { id, nome, custo } = item;

      // 1) valida recursos com snapshot atual
      const temRecursos = Object.entries(custo).every(([recurso, valor]) => {
        const val = recurso === "agua" ? Math.min(valor || 0, 100) : valor || 0;
        return (estadoAtual?.[recurso] ?? 0) >= val;
      });
      if (!temRecursos) {
        showSnackbar("❌ Recursos insuficientes para criar tropa.", "error");
        return;
      }

      // 2) debita ÁGUA primeiro e usa a resposta como BASE
      let base = estadoAtual;
      const aguaCost = Math.min(custo.agua || 0, 100);
      if (aguaCost > 0) {
        try {
          const d = await coloniaService.gastarAgua(estadoAtual._id, aguaCost);
          base = d; // <- água já atualizada (ex.: 99 -> 98, etc.)
        } catch (e) {
          if (e?.response?.status === 409) {
            showSnackbar("❌ Água insuficiente para criar.", "error");
            return;
          }
          throw e;
        }
      }

      // 3) monta novoEstado a partir da BASE (não do snapshot antigo)
      const novoEstado = {
        ...base,
        exploradores: [...(base.exploradores || [])],
        populacao: { ...(base.populacao || {}) },
      };

      // 4) desconta os demais recursos localmente a partir da BASE
      Object.entries(custo).forEach(([recurso, valor]) => {
        if (recurso === "agua") return;
        novoEstado[recurso] = Math.max(0, (base[recurso] || 0) - (valor || 0));
      });

      // 5) aplica criação
      if (id !== "exploradores") {
        novoEstado.populacao[id] = (novoEstado.populacao[id] || 0) + 1;
      } else {
        const nextId = generateNextExplorerId(novoEstado.exploradores);
        const ordinal = parseInt(nextId.split("_")[1], 10);
        const novoExplorador = createExplorer(nextId, ordinal);
        novoEstado.exploradores.push(novoExplorador);
        novoEstado.populacao.exploradores =
          (novoEstado.populacao.exploradores || 0) + 1;
      }

      // 6) atualiza UI uma única vez e sincroniza
      setEstadoAtual(novoEstado);
      showSnackbar(`✅ ${nome} criado com sucesso!`, "success");
      try {
        await coloniaService.atualizarColonia(
          novoEstado._id ?? estadoAtual._id,
          novoEstado
        );
      } catch (err) {
        console.error("Erro ao atualizar colônia no backend:", err);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleConstruir = async (tipo) => {
    const c = buildings[tipo];
    if (!c) return;

    const { custo, tempo, nome } = c;

    const naFila = filaConstrucoes.filter((fc) => fc.id === tipo).length;
    const construidas = estadoAtual.construcoes?.[tipo] || 0;
    const mult = 2 ** (construidas + naFila);

    const temRecursos = Object.entries(custo).every(([recurso, val]) => {
      const total = recurso === "agua" ? Math.min(val * mult, 100) : val * mult;
      return (estadoAtual[recurso] ?? 0) >= total;
    });
    if (!temRecursos) {
      showSnackbar("❌ Recursos insuficientes para construção.", "error");
      return;
    }

    // ✅ base vem do servidor após debitar a água (mantém d.water)
    let base = estadoAtual;
    const aguaTotal = Math.min((custo.agua || 0) * mult, 100);
    if (aguaTotal > 0) {
      try {
        const d = await coloniaService.gastarAgua(estadoAtual._id, aguaTotal);
        base = d;
      } catch (e) {
        if (e?.response?.status === 409) {
          showSnackbar("❌ Água insuficiente para construir.", "error");
          return;
        }
        throw e;
      }
    }

    const novoEstado = {
      ...base,
      filaConstrucoes: [
        ...(base.filaConstrucoes || []),
        { id: tipo, nome, tempoRestante: tempo },
      ],
    };

    // desconta os demais recursos a partir da BASE
    Object.entries(custo).forEach(([recurso, val]) => {
      if (recurso === "agua") return;
      const total = val * mult;
      novoEstado[recurso] = Math.max(0, (base[recurso] || 0) - total);
    });

    setEstadoAtual(novoEstado);
    setFilaConstrucoes(novoEstado.filaConstrucoes);
    showSnackbar(`✅ Construção de ${nome} iniciada!`, "success");
    try {
      await coloniaService.atualizarColonia(
        novoEstado._id ?? estadoAtual._id,
        novoEstado
      );
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
      <div className="relative mb-6">
        <h1 className="text-3xl font-bold text-center">
          Colônia {estadoAtual.nome}
        </h1>

        <IconButton
          aria-label="Sair"
          onClick={() => setLogoutOpen(true)}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            bgcolor: "rgba(239,68,68,0.12)", // vermelho translúcido
            "&:hover": { bgcolor: "rgba(239,68,68,0.2)" },
          }}
          color="error"
          size="small"
        >
          <PowerSettingsNewIcon fontSize="small" />
        </IconButton>

        <Dialog
          open={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Deseja sair?</DialogTitle>
          <DialogContent>
            Tem certeza de que deseja deslogar da sua colônia?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setLogoutOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirmLogout}
              color="error"
              variant="contained"
            >
              Confirma
            </Button>
          </DialogActions>
        </Dialog>
      </div>

      <section
        id="status"
        data-tour="status"
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
          isCreating={isCreating}
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
            <Route path="/explorador" element={<ExplorerPage />} />{" "}
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
