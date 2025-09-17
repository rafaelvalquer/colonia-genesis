//ParameterPanel.jsx

import { useMemo, useState, useEffect } from "react";
import {
  Switch,
  FormControlLabel,
  Slider,
  ButtonGroup,
  Button,
  Tooltip,
  Tabs,
  Tab,
  Box,
  Drawer,
  IconButton,
  Typography,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  MobileStepper,
  Button as MuiButton,
  Badge,
} from "@mui/material";

import List from "@mui/icons-material/List";
import CloseIcon from "@mui/icons-material/Close";
import { motion, AnimatePresence } from "framer-motion";
import buildings from "../data/buildings.json";
import WaterLottie from "./WaterLottie"; // ajuste o caminho se necessário
import FireLottie from "./FireLottie"; // ajuste o caminho se necessário
import PopulationLottie from "./PopulationLottie"; // ajuste o caminho se necessário
import WaterAlertLottie from "./WaterAlertLottie"; // ajuste o caminho conforme sua estrutura
import EvolutionTree from "./reactFlow/EvolutionTree"; // ajuste o caminho conforme a estrutura do seu projeto
import { useNavigate } from "react-router-dom";
import IconVisaoGeral from "./icons/IconVisaoGeral";
import IconParametros from "./icons/IconParametros";
import IconDesenvolvimento from "./icons/IconDesenvolvimento";
import IconPopulacao from "./icons/IconPopulacao";
import IconMissoes from "./icons/IconMissoes";
import MissoesExploracao from "../pages/MissoesExploracao.jsx"; // novo
import MissoesExploradores from "../pages/MissoesExploradores.jsx"; // novo
import coloniaService from "../services/coloniaService.js";

const MAX_PONTOS = 3;
const setoresOrdem = [
  "fazenda",
  "minas",
  "laboratorio",
  "construcao",
  "saude",
  "energia",
];

// === Helpers p/ normalizar skills (UI <-> DB) ===
const to01 = (v) => (v ? 1 : 0);
const normalizeDistrib = (d = {}) => ({
  agricultura: to01(d.agricultura),
  mineracao: to01(d.mineracao ?? d.minas ?? d["mineração"]),
  laboratorio: to01(d.laboratorio ?? d["laboratório"]),
  construcao: to01(d.construcao ?? d["construção"]),
  saude: to01(d.saude ?? d["saúde"]),
  energia: to01(d.energia),
});
const dbToUi = (src = {}) => normalizeDistrib(src);
const uiToDb = (ui = {}) => normalizeDistrib(ui);

//const minhasConexoes = estadoAtual.pesquisa;

const abas = [
  {
    grupo: "Visão Geral",
    icone: <IconVisaoGeral />,
    itens: [{ id: "central", label: "Central de Comando" }],
  },
  {
    grupo: "Parâmetros",
    icone: <IconParametros />,
    itens: [{ id: "parametros", label: "Parâmetros" }],
  },
  {
    grupo: "Desenvolvimento",
    icone: <IconDesenvolvimento />,
    itens: [
      { id: "construcoes", label: "Construções" },
      { id: "pesquisas", label: "Pesquisas" },
    ],
  },
  {
    grupo: "População & Tropas",
    icone: <IconPopulacao />,
    itens: [
      { id: "criacaoPopulacao", label: "População" },
      { id: "criacaoTropas", label: "Treinar Tropas" },
    ],
  },
  {
    grupo: "Missões",
    icone: <IconMissoes />,
    itens: [
      { id: "exploradores", label: "Exploradores" }, // preparar e enviar expedicionário
      { id: "exploracao", label: "Exploração" }, // preparar e enviar expedicionário
      { id: "expedicoes", label: "Em Andamento" }, // fila + status/tempo de retorno
      { id: "relatorios", label: "Relatórios" }, // histórico de missões concluídas
    ],
  },
];

function ParameterPanel({
  onChange,
  populacao = 100,
  estadoAtual,
  onConstruir,
  filaConstrucoes,
  onGastarCiencia,
  onCriarTropa,
  onEstadoChange,
}) {
  const [abaSelecionada, setAbaSelecionada] = useState("central");
  const [abaConstrucao, setAbaConstrucao] = useState("fazenda");
  const [abaParametros, setAbaParametros] = useState("skill");
  const [abaInternaCentral, setAbaInternaCentral] = useState("recursos");
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aguaIndex, setAguaIndex] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [stepAtual, setStepAtual] = useState(0);
  const [mensagemErro, setMensagemErro] = useState("");
  const [modalErroAgua, setModalErroAgua] = useState(false);
  const [modalAguaAberto, setModalAguaAberto] = useState(false);
  const [aguaNecessaria, setAguaNecessaria] = useState(0);
  const [colonos, setColonos] = useState(10);
  const [turnReport, setTurnReport] = useState(null);
  const [distribuicao, setDistribuicao] = useState({
    agricultura: 0,
    mineracao: 0,
    laboratorio: 0,
    construcao: 0,
    saude: 0,
    energia: 0,
  });

  const populacoes = [
    {
      id: "colonos",
      nome: "Colono",
      descricao: "Trabalhador comum que pode ser alocado em funções básicas.",
      imagem: "/images/colono.png",
      custo: {
        comida: 20,
      },
    },
    {
      id: "exploradores",
      nome: "Explorador",
      descricao:
        "Aventureiro treinado para desbravar novos territórios, coletar recursos e mapear áreas desconhecidas.",
      imagem: "/images/explorador.png", // caminho para a imagem que geramos
      custo: {
        comida: 35,
        agua: 25,
      },
    },
  ];

  const tropas = [
    {
      id: "guardas",
      nome: "Guarda",
      descricao:
        "Infantaria leve da colônia. Usa pistola de pulso e armadura leve.",
      imagem: "/images/guarda.png",
      custo: {
        comida: 20,
        energia: 10,
        agua: 1,
      },
    },
    {
      id: "marines",
      nome: "Marine",
      descricao:
        "Assalto pesado da colônia. Blindado. Porta metralhadora rotativa. Sustenta fogo contínuo e segura enxames",
      imagem: "/images/marine.png",
      custo: {
        comida: 30,
        energia: 10,
        agua: 1,
      },
    },
    {
      id: "snipers",
      nome: "Sniper",
      descricao:
        "Atirador de elite da colônia. Rifle de precisão de pulso. Elimina alvos-chave à longa distância. Vulnerável a curta distância.",
      imagem: "/images/sniper.png",
      custo: {
        comida: 20,
        energia: 20,
        agua: 2,
      },
    },
    {
      id: "rangers",
      nome: "Ranger",
      descricao:
        "Atiradora de linha da colônia. Dispara laser perfurante que acerta todos os inimigos na mesma trajetória. Leve e móvel, frágil a curta distância.",
      imagem: "/images/ranger.png",
      custo: {
        comida: 20,
        energia: 40,
        agua: 2,
      },
    },
  ];

  useEffect(() => {
    // prioridade: o que veio salvo no estado -> snapshot de parâmetros -> params antigos
    const fromDb = estadoAtual?.skillsDistribuicao;
    const fromSnap = estadoAtual?.parametrosSnapshot?.distribuicao;
    const fromParams = estadoAtual?.parametros?.distribuicao;
    const hydrated = dbToUi(fromDb || fromSnap || fromParams || {});
    setDistribuicao(hydrated);
  }, [estadoAtual]);

  console.log("filaConstrucoes ====", filaConstrucoes); // debugger

  const tooltips = {
    agricultura: "Aumenta a produção de alimentos para sua população",
    mineracao: "Extrair mais recursos minerais para construção",
    laboratorio: "Pesquisa tecnológica para avanços científicos",
    construcao: "Acelera a construção de novas estruturas",
    saude: "Melhora a qualidade de vida e produtividade dos cidadãos",
    energia: "Gera mais energia para alimentar suas estruturas",
  };

  const totalUsado = Object.values(distribuicao).reduce(
    (acc, val) => acc + val,
    0
  );

  const consumoAguaOpcoes = [
    { label: "Reduzido", value: 0.5, color: "success" },
    { label: "Normal", value: 1, color: "primary" },
    { label: "Exagerado", value: 1.5, color: "error" },
  ];

  const [alocacaoColonos, setAlocacaoColonos] = useState({
    fazenda: 20,
    minas: 20,
    laboratorio: 15,
    construcao: 15,
    saude: 15,
    energia: 15,
  });

  const [tempAlocacao, setTempAlocacao] = useState(alocacaoColonos);

  // --- HOSPITAL: números para o tooltip ---
  const posto = estadoAtual?.construcoes?.postoMedico ?? 0;
  const hosp = estadoAtual?.construcoes?.hospitalCentral ?? 0;

  // mesma regra do engine: cada posto = 3, cada hospital = 8
  const capacidadeHospital = posto * 3 + hosp * 8;

  const internadosArr = estadoAtual?.hospital?.internados ?? [];
  const internados = internadosArr.length;

  const slotsOcupados = internadosArr.length;

  const filaHospital = estadoAtual?.hospital?.fila?.length ?? 0;

  const steps = ["Recursos", "Eventos", "Resultado Final"];

  const handleSliderChange = (campo, novoValor) => {
    setTempAlocacao((old) => ({ ...old, [campo]: novoValor }));
  };

  const handleCriarTropa = (item) => {
    onCriarTropa(item); // <- apenas isso
  };

  const handleSliderChangeCommitted = (campo, novoValor) => {
    const restante = 100 - novoValor;
    const outros = setoresOrdem.filter((k) => k !== campo);
    const somaAtual = outros.reduce((acc, k) => acc + alocacaoColonos[k], 0);

    const novaDistribuicao = {};
    outros.forEach((k) => {
      novaDistribuicao[k] =
        somaAtual === 0
          ? Math.floor(restante / outros.length)
          : Math.round((alocacaoColonos[k] / somaAtual) * restante);
    });

    const somaDistribuida = Object.values(novaDistribuicao).reduce(
      (a, b) => a + b,
      0
    );
    const ajuste = 100 - (somaDistribuida + novoValor);
    if (ajuste !== 0 && outros.length > 0) {
      novaDistribuicao[setoresOrdem.find((k) => k !== campo)] += ajuste;
    }

    setAlocacaoColonos({ ...novaDistribuicao, [campo]: novoValor });
    setTempAlocacao({ ...novaDistribuicao, [campo]: novoValor });
  };

  const handleSwitchToggle = (campo) => {
    const ativo = distribuicao[campo] === 1;
    if (ativo) {
      setDistribuicao({ ...distribuicao, [campo]: 0 });
    } else if (totalUsado < MAX_PONTOS) {
      setDistribuicao({ ...distribuicao, [campo]: 1 });
    }
  };

  // formata + ou - com emoji
  const fmt = (n, emoji) =>
    n === 0 ? "0" : `${n > 0 ? `+${n}` : n} ${emoji || ""}`;

  const handleSubmit = async () => {
    const consumo = consumoAguaOpcoes[aguaIndex].value;
    const aguaNecessaria =
      consumo === 0.5 ? 5 : consumo === 1 ? 10 : consumo === 1.5 ? 20 : 0;
    setLoading(true);
    try {
      const skillsDistribuicao = uiToDb(distribuicao);
      try {
        await coloniaService.atualizarColonia(estadoAtual._id, {
          skillsDistribuicao,
        });
        onEstadoChange?.({ ...estadoAtual, skillsDistribuicao });
      } catch (e) {
        console.error("Falha ao salvar skillsDistribuicao:", e);
      }

      // pede ao pai para debitar água no backend antes de simular
      const report = await onChange({
        distribuicao: skillsDistribuicao,
        agua: consumo,
        alocacaoColonos,
        filaConstrucoes: estadoAtual.filaConstrucoes,
        filaMissoes: estadoAtual.filaMissoes,
        custoAgua: aguaNecessaria,
      });
      setTurnReport(report);
      setModalAberto(true);
    } catch (e) {
      // opcional: feedback se água foi insuficiente
      if (e?.response?.status === 409) {
        setAguaNecessaria(aguaNecessaria);
        setModalAguaAberto(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConstruir = (id) => {
    onConstruir(id); // <- apenas isso
  };

  // coloque perto do handleSubmit (mesmo escopo do componente)
  const handleApplyClick = () => {
    if (totalUsado < MAX_PONTOS) {
      const usar = window.confirm(
        `Você ainda tem ${
          MAX_PONTOS - totalUsado
        } ponto(s) de skill disponível(is). Deseja usá-lo(s) agora?`
      );
      if (usar) {
        setAbaSelecionada("parametros");
        setAbaParametros("skill");
        return; // não aplica enquanto o jogador distribui os pontos
      }
    }
    handleSubmit(); // prossegue normalmente
  };

  function LinearProgressWithLabel({ value }) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flexGrow: 1 }}>
          <LinearProgress variant="determinate" value={value} />
        </Box>
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", minWidth: 30 }}
        >
          {`${Math.round(value)}%`}
        </Typography>
      </Box>
    );
  }

  const startMinigame = () => {
    setModalAberto(false);
    setStepAtual(0);
    navigate("/minigame", { state: { estadoAtual } });
  };

  // monta os steps dinamicamente
  const conteudoStep = useMemo(() => {
    if (!turnReport) {
      return [
        <>
          <h3 className="text-lg font-bold mb-2">
            🔄 Coleta e Consumo de Recursos
          </h3>
          <p>- 💧 Água: aguardando simulação</p>
          <p>- 🌾 Comida: aguardando simulação</p>
          <p>- ⚡ Energia: aguardando simulação</p>
        </>,
        <>
          <h3 className="text-lg font-bold mb-2">🌌 Eventos & Missões</h3>
          <p>Sem dados (ainda).</p>
        </>,
        <>
          <h3 className="text-lg font-bold mb-2">📊 Resumo Final</h3>
          <p>Execute a simulação para ver o resumo.</p>
        </>,
      ];
    }

    const p = turnReport.producao || {};
    const d = turnReport.deltas || {};
    const eventos = turnReport.eventos || [];
    const missoes = turnReport.missoesConcluidas || [];
    const hosp = turnReport.hospital || {};

    const builds = turnReport?.construcoesFinalizadas ?? [];
    const buildsGrouped = Object.values(
      builds.reduce((acc, c) => {
        const key = c.id;
        if (!acc[key]) acc[key] = { nome: c.nome || key, count: 0 };
        acc[key].count += 1;
        return acc;
      }, {})
    );

    return [
      <>
        <h3 className="text-lg font-bold mb-2">
          🔄 Coleta e Consumo de Recursos
        </h3>
        <p>- 🌾 Comida líquida: {fmt(p.comidaLiquida, "🌾")}</p>
        <p>- ⚡ Energia gerada: {fmt(p.energiaGerada, "⚡")}</p>
        <p>- ⛏️ Minerais produzidos: {fmt(p.mineraisProduzidos, "⛏️")}</p>
        <p>- 🧪 Ciência gerada: {fmt(p.cienciaProduzida, "🧪")}</p>
        <p>- 🛠️ Reparo aplicado: {fmt(p.reparoAplicado, "🛠️")}</p>
        <p>- 🏥 Saúde (ganho): {fmt(p.ganhoSaude, "🏥")}</p>
        <p>
          - 🌿 Sustentabilidade (ganho): {fmt(p.ganhoSustentabilidade, "🌿")}
        </p>
      </>,

      // STEP 2

      <>
        <h3 className="text-lg font-bold mb-2">🌌 Eventos & Missões</h3>

        <div className="mb-3">
          <p className="font-semibold mb-1">Eventos:</p>
          {eventos.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhum evento neste turno.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {eventos.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-3">
          <p className="font-semibold mb-1">Missões concluídas:</p>
          {missoes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhuma missão concluída neste turno.
            </p>
          ) : (
            <ul className="space-y-2">
              {missoes.map((m, i) => (
                <li key={i} className="bg-slate-100 rounded p-2">
                  <div className="font-medium">
                    🧭 {m.titulo}{" "}
                    {m.explorerNome ? (
                      <span className="text-slate-500">— {m.explorerNome}</span>
                    ) : null}
                  </div>
                  {Array.isArray(m.recompensasRaw) &&
                    m.recompensasRaw.length > 0 && (
                      <ul className="text-sm text-slate-700 mt-1 list-disc pl-5">
                        {m.recompensasRaw.map((r, idx) => (
                          <li key={idx}>{r.label || JSON.stringify(r)}</li>
                        ))}
                      </ul>
                    )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="font-semibold mb-1">Hospital:</p>
          <ul className="text-sm">
            <li>🏥 Capacidade: {hosp.capacidade ?? 0}</li>
            <li>
              🧑‍⚕️ Internados: {hosp.internados ?? 0} | 🕒 Fila: {hosp.fila ?? 0}
            </li>
            <li>
              ✅ Altas: {hosp.altas ?? 0} | ☠️ Óbitos: {hosp.obitos ?? 0} | ➕
              Novos: {hosp.novosPacientes ?? 0}
            </li>
          </ul>
        </div>
      </>,

      // STEP 3
      <>
        <h3 className="text-lg font-bold mb-2">📊 Resumo Final</h3>
        <ul className="text-sm">
          <li>🌾 Comida: {fmt(d.comida)}</li>
          <li>⚡ Energia: {fmt(d.energia)}</li>
          <li>⛏️ Minerais: {fmt(d.minerais)}</li>
          <li>🧪 Ciência: {fmt(d.ciencia)}</li>
          <li>💧 Água: {estadoAtual.agua}</li>
          <li>🏥 Saúde: {fmt(d.saude)}</li>
          <li>🌿 Sustentabilidade: {fmt(d.sustentabilidade)}</li>
          <li>🏗️ Integridade Estrutural: {fmt(d.integridadeEstrutural)}</li>
        </ul>

        <div className="mt-3">
          <p className="font-semibold mb-1">🏗️ Construções finalizadas:</p>
          {builds.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhuma construção concluída neste turno.
            </p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {buildsGrouped.map((b, i) => (
                <li key={i}>
                  {b.nome} <span className="text-slate-500">×{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>,
    ];
  }, [turnReport]);

  const navigate = useNavigate();

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <aside className="w-full md:w-60 bg-slate-800 rounded-lg p-4 shadow-lg overflow-y-auto max-h-[600px]">
        {abas.map((grupo) => (
          <div key={grupo.grupo} className="mb-6">
            <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest flex items-center">
              {grupo.icone}
              {grupo.grupo}
            </h3>
            <ul className="flex flex-col gap-2 pl-3">
              {/* remova a borda fixa para não “forçar” a barra em todas */}
              {grupo.itens.map((aba) => {
                const ativo = abaSelecionada === aba.id;
                return (
                  <li key={aba.id}>
                    <button
                      onClick={() => setAbaSelecionada(aba.id)}
                      data-tab={aba.id}
                      data-tour={
                        aba.id === "parametros" ? "aba-parametros" : undefined
                      }
                      className={`text-left w-full px-2 py-1 border-l-4 flex items-center gap-2 transition-colors
            ${
              ativo
                ? "border-blue-400 text-white font-semibold"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
                    >
                      {aba.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>

      {/* Conteúdo dinâmico */}
      <div className="flex-1 bg-slate-800 rounded-lg p-6 shadow-lg overflow-y-auto max-h-[600px]">
        {abaSelecionada === "central" && (
          <>
            <h2 className="text-2xl font-bold mb-4">Central de Comando</h2>

            <Tabs
              value={abaInternaCentral}
              onChange={(_, novaAba) => setAbaInternaCentral(novaAba)}
              variant="scrollable"
              scrollButtons
              allowScrollButtonsMobile
              aria-label="tabs de construção"
              className="mb-4"
              sx={{
                "& .MuiTabs-indicator": {
                  backgroundColor: "#38bdf8",
                  height: 4,
                },
                "& .MuiTab-root": {
                  color: "#cbd5e1",
                  fontWeight: "bold",
                  transition: "color 0.2s ease",
                },
                "& .Mui-selected": {
                  color: "#38bdf8",
                },
              }}
            >
              {["recursos", "construcoes", "pesquisas"].map((item) => (
                <Tab
                  key={item}
                  value={item}
                  label={item.charAt(0).toUpperCase() + item.slice(1)}
                />
              ))}
            </Tabs>

            <AnimatePresence mode="wait">
              <motion.div
                key={abaInternaCentral}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-6 p-6 bg-white text-gray-900 rounded-xl shadow-lg transition-all duration-300"
              >
                {abaInternaCentral === "recursos" && (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Recursos</h3>
                    <ul className="space-y-2" data-tour="central-comandos">
                      <li className="group relative inline-block">
                        <div className="flex items-center cursor-pointer hover:text-blue-200 transition-colors duration-200">
                          <span className="mr-1">👥</span>
                          População:{" "}
                          {Object.values(estadoAtual.populacao).reduce(
                            (acc, valor) => acc + valor,
                            0
                          )}
                        </div>

                        {/* Tooltip melhorado */}
                        <div
                          className="absolute z-20 left-0 mt-2 w-56 p-3 bg-gray-800 rounded-lg shadow-xl 
                       opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                       transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
                       border border-gray-700 text-white"
                        >
                          <div className="text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🏠</span>
                                <span>Colonos:</span>
                              </div>
                              <span>{estadoAtual.populacao.colonos}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🔍</span>
                                <span>Exploradores:</span>
                              </div>
                              <span>{estadoAtual.populacao.exploradores}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🪖</span>
                                <span>Guardas:</span>
                              </div>
                              <span>{estadoAtual.populacao.guardas}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">💥</span>
                                <span>Marines:</span>
                              </div>
                              <span>{estadoAtual.populacao.marines}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🎯</span>
                                <span>Snipers:</span>
                              </div>
                              <span>{estadoAtual.populacao.snipers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">⚡</span>
                                <span>Rangers:</span>
                              </div>
                              <span>{estadoAtual.populacao.rangers}</span>
                            </div>
                            <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                              <span>Total:</span>
                              <span>
                                {Object.values(estadoAtual.populacao).reduce(
                                  (acc, valor) => acc + valor,
                                  0
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </li>

                      <li className="group relative block w-full">
                        <div className="flex items-center cursor-pointer hover:text-blue-200 transition-colors duration-200">
                          <span className="mr-1">⚡</span>
                          Energia: {estadoAtual.energia}
                        </div>

                        {/* Tooltip Energia (igual ao que você já tem) */}
                        <div
                          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
  opacity-0 invisible group-hover:opacity-100 group-hover:visible 
  transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
  border border-gray-700 text-white"
                        >
                          {(() => {
                            const sol =
                              estadoAtual.construcoes?.geradorSolar || 0;
                            const geo =
                              estadoAtual.construcoes?.reatorGeotermico || 0;
                            const energiaSolar = sol * 12;
                            const energiaGeo = geo * 30;
                            const energiaTotalConstrucoes =
                              energiaSolar + energiaGeo;
                            const sustSolar = Math.floor(sol / 2);
                            const sustGeo = -geo;
                            const sustTotal = sustSolar + sustGeo;
                            const manutMinerais = geo * 2;

                            return (
                              <div className="text-sm space-y-2">
                                <div className="font-semibold text-slate-200">
                                  Produção (construções)
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">☀️</span>
                                    <span>Geradores Solares (x{sol}):</span>
                                  </div>
                                  <span>+{energiaSolar}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🌋</span>
                                    <span>Reatores Geotérmicos (x{geo}):</span>
                                  </div>
                                  <span>+{energiaGeo}</span>
                                </div>

                                <div className="border-t border-gray-600 pt-2 mt-1" />

                                <div className="font-semibold text-slate-200">
                                  Sustentabilidade
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">☀️</span>
                                    <span>Solar (+1 / 2 unid.):</span>
                                  </div>
                                  <span>+{sustSolar}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🌋</span>
                                    <span>Geotérmico (−1 / unid.):</span>
                                  </div>
                                  <span>{sustGeo}</span>
                                </div>

                                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                                  <span>Total Sustentabilidade/turno:</span>
                                  <span
                                    className={
                                      sustTotal >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {sustTotal >= 0 ? "+" : ""}
                                    {sustTotal}
                                  </span>
                                </div>

                                <div className="border-t border-gray-600 pt-2 mt-1" />

                                <div className="flex items-center justify-between text-slate-300">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">⛏️</span>
                                    <span>Manutenção (reatores):</span>
                                  </div>
                                  <span>-{manutMinerais} minerais</span>
                                </div>

                                <div className="text-xs text-slate-400">
                                  * Reatores podem causar microvazamentos
                                  térmicos raros (−3% integridade).
                                </div>

                                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between text-slate-200">
                                  <span>Energia total (construções):</span>
                                  <span>+{energiaTotalConstrucoes}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </li>

                      <li>
                        💧 Água: {estadoAtual.agua}/{estadoAtual.maxAgua}
                      </li>
                      <li className="group relative inline-block">
                        <div className="flex items-center cursor-pointer hover:text-blue-200 transition-colors duration-200">
                          <span className="mr-1">🌾</span>
                          Comida: {estadoAtual.comida}
                        </div>

                        {/* Tooltip Comida */}
                        <div
                          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
    transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
    border border-gray-700 text-white"
                        >
                          {(() => {
                            // --- cálculos para exibir no tooltip ---
                            const colonos = estadoAtual.populacao?.colonos || 0;
                            const exploradores =
                              estadoAtual.populacao?.exploradores || 0;
                            const guardas = estadoAtual.populacao?.guardas || 0;
                            const marines = estadoAtual.populacao?.marines || 0;
                            const snipers = estadoAtual.populacao?.snipers || 0;
                            const rangers = estadoAtual.populacao?.rangers || 0;

                            const consumoColonos = Math.floor(
                              (colonos || 0) * 0.5
                            ); // 0.5 por colono, arredonda p/ baixo
                            const consumoExploradores = exploradores * 2;
                            const consumoGuardas = guardas * 2;
                            const consumoMarines = marines * 2;
                            const consumoSnipers = snipers * 2;
                            const consumoRangers = rangers * 2;
                            const consumoTotal =
                              consumoColonos +
                              consumoExploradores +
                              consumoGuardas +
                              consumoMarines +
                              consumoSnipers +
                              consumoRangers;

                            const fazendas =
                              estadoAtual.construcoes?.fazenda || 0;
                            const irrigadores =
                              estadoAtual.construcoes?.sistemaDeIrrigacao || 0;

                            const prodFazendas = fazendas * 5; // +5 por fazenda
                            const prodIrrigacao = irrigadores * 15; // +15 por irrigador
                            const energiaIrrigacao = irrigadores * 30; // -30 de energia

                            return (
                              <div className="text-sm space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🏭</span>
                                    <span>Produção (fazendas):</span>
                                  </div>
                                  <span>+{prodFazendas}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-300">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">💧</span>
                                    <span>Produção irrigação:</span>
                                  </div>
                                  <span>+{prodIrrigacao}</span>
                                </div>

                                <div className="flex items-center justify-between text-slate-400">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">⚡</span>
                                    <span>Consumo de energia:</span>
                                  </div>
                                  <span>-{energiaIrrigacao}</span>
                                </div>

                                <div className="border-t border-gray-600 pt-2 mt-1" />

                                <div className="font-semibold text-slate-200">
                                  Consumo
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🏠</span>
                                    <span>Colonos:</span>
                                  </div>
                                  <span>-{consumoColonos}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🔍</span>
                                    <span>Exploradores:</span>
                                  </div>
                                  <span>-{consumoExploradores}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">⚔️</span>
                                    <span>Guardas:</span>
                                  </div>
                                  <span>-{consumoGuardas}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">⚔️</span>
                                    <span>Marines:</span>
                                  </div>
                                  <span>-{consumoMarines}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🎯</span>
                                    <span>Snipers:</span>
                                  </div>
                                  <span>-{consumoSnipers}</span>
                                </div>

                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="w-6 text-center">🎯</span>
                                    <span>Rangers:</span>
                                  </div>
                                  <span>-{consumoRangers}</span>
                                </div>

                                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                                  <span>Total (consumo):</span>
                                  <span>-{consumoTotal}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </li>

                      <li>⛏️ Minerais: {estadoAtual.minerais}</li>
                      <li>🧪 Ciência: {estadoAtual.ciencia}</li>
                      <li className="group relative inline-block">
                        <div className="flex items-center cursor-pointer hover:text-blue-200 transition-colors duration-200">
                          <span className="mr-1">🏥</span>
                          Saúde: {estadoAtual.saude}%
                        </div>

                        {/* Tooltip Hospital */}
                        <div
                          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl
               opacity-0 invisible group-hover:opacity-100 group-hover:visible
               transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
               border border-gray-700 text-white"
                        >
                          <div className="text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🏨</span>
                                <span>Capacidade (slots):</span>
                              </div>
                              <span>
                                {slotsOcupados}/{capacidadeHospital}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">🧑‍⚕️</span>
                                <span>Internados:</span>
                              </div>
                              <span>{internados}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="w-6 text-center">⏳</span>
                                <span>Fila:</span>
                              </div>
                              <span>{filaHospital}</span>
                            </div>

                            {/* (Opcional) mostrar prédios que compõem a capacidade */}
                            <div className="border-t border-gray-600 pt-2 mt-1 text-xs text-slate-300">
                              <div className="flex items-center justify-between">
                                <span>Postos Médicos:</span>
                                <span>{posto}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Hospitais Centrais:</span>
                                <span>{hosp}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>

                      <li>
                        🌿 Sustentabilidade: {estadoAtual.sustentabilidade}%
                      </li>
                    </ul>
                  </>
                )}

                {abaInternaCentral === "construcoes" && (
                  <>
                    <h3 className="text-2xl font-semibold mb-4">Construções</h3>

                    {Object.entries(
                      Object.groupBy(
                        Object.entries(estadoAtual.construcoes)
                          .filter(([, qtd]) => qtd >= 1)
                          .map(([key, qtd]) => ({
                            key,
                            qtd,
                            ...buildings[key],
                          })),
                        (item) => item.categoria
                      )
                    ).map(([categoria, construcoes]) => (
                      <div
                        key={categoria}
                        className="bg-slate-100 p-5 rounded-xl shadow-lg mb-6 max-w-4xl mx-auto"
                      >
                        <h4 className="text-xl font-bold mb-4 capitalize text-slate-800 border-b pb-1 border-slate-300">
                          {categoria}
                        </h4>

                        <div className="space-y-3">
                          {construcoes.map((item, idx) => (
                            <motion.div
                              key={item.key}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1, duration: 0.4 }}
                              className="bg-white rounded-lg shadow p-3 flex items-center gap-4 hover:shadow-md hover:scale-[1.01] transition-transform duration-300"
                            >
                              <img
                                src={item.imagem}
                                alt={item.nome}
                                className="w-12 h-12 object-contain rounded"
                              />

                              <div className="flex-1">
                                <h5 className="text-base font-bold text-slate-800">
                                  {item.nome}
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {item.descricao}
                                </p>
                              </div>

                              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap">
                                {item.qtd} construída{item.qtd > 1 && "s"}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {abaInternaCentral === "pesquisas" && (
                  <>
                    <h3 className="text-xl font-semibold mb-2">Pesquisas</h3>
                    <p>
                      🔬 (Em breve) Exibição de tecnologias em andamento ou já
                      desbloqueadas.
                    </p>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {abaSelecionada === "parametros" && (
          <>
            <h2
              className="text-xl font-semibold mb-4"
              data-tour="aba-parametros"
            >
              Parâmetros
            </h2>

            <Tabs
              value={abaParametros}
              onChange={(_, v) => setAbaParametros(v)}
              variant="scrollable"
              scrollButtons
              allowScrollButtonsMobile
              aria-label="tabs de parâmetros"
              className="mb-4"
              sx={{
                "& .MuiTabs-indicator": {
                  backgroundColor: "#38bdf8",
                  height: 4,
                },
                "& .MuiTab-root": {
                  color: "#cbd5e1",
                  fontWeight: "bold",
                  transition: "color 0.2s ease",
                },
                "& .Mui-selected": { color: "#38bdf8" },
              }}
            >
              {[
                { id: "skill", label: "Skill Points" },
                { id: "agua", label: "Consumo de Água" },
                { id: "alocacao", label: "Alocação de Colonos" },
              ].map((t) => (
                <Tab
                  key={t.id}
                  value={t.id}
                  label={t.label}
                  data-tour={
                    t.id === "skill"
                      ? "skill"
                      : t.id === "agua"
                      ? "agua"
                      : t.id === "alocacao"
                      ? "alocacao"
                      : undefined
                  }
                  onClick={() => setAbaParametros(t.id)} // ⬅️ garante seleção
                />
              ))}
            </Tabs>

            <AnimatePresence mode="wait">
              <motion.div
                key={abaParametros}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
              >
                {/* === Skill Points === */}
                {abaParametros === "skill" && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        Parâmetros — Skill Points
                      </h3>
                    </div>

                    <div className="flex items-center mb-4">
                      <div className="mr-4 mb-4">
                        <FireLottie speed={totalUsado} />
                      </div>
                      <h4 className="text-lg font-semibold">
                        Skill Points (Máx: {MAX_PONTOS})
                      </h4>
                    </div>

                    <p className="mb-4 text-sm text-gray-500">
                      Total usado: {totalUsado} / {MAX_PONTOS}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.keys(distribuicao).map((campo) => (
                        <div
                          key={campo}
                          className="bg-slate-100 rounded-md p-3 shadow-sm"
                        >
                          <Tooltip
                            title={tooltips[campo]}
                            arrow
                            placement="right"
                          >
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={distribuicao[campo] === 1}
                                  onChange={() => handleSwitchToggle(campo)}
                                  disabled={
                                    distribuicao[campo] === 0 &&
                                    totalUsado >= MAX_PONTOS
                                  }
                                />
                              }
                              label={
                                campo.charAt(0).toUpperCase() + campo.slice(1)
                              }
                            />
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* === Consumo de Água === */}
                {abaParametros === "agua" && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        Parâmetros — Consumo de Água
                      </h3>
                    </div>

                    <div className="flex items-center mb-4">
                      <div className="mr-4">
                        <WaterLottie
                          speed={consumoAguaOpcoes[aguaIndex].value}
                        />
                      </div>
                      <h4 className="text-lg font-semibold">Consumo de Água</h4>
                    </div>

                    <ButtonGroup
                      variant="outlined"
                      aria-label="Consumo de Água"
                    >
                      {consumoAguaOpcoes.map((opcao, idx) => (
                        <Button
                          key={opcao.label}
                          color={aguaIndex === idx ? opcao.color : undefined}
                          variant={aguaIndex === idx ? "contained" : "outlined"}
                          onClick={() => setAguaIndex(idx)}
                        >
                          {opcao.label}
                        </Button>
                      ))}
                    </ButtonGroup>

                    <div className="mt-4 text-sm text-gray-600 font-medium">
                      💧 Consumo atual:{" "}
                      <span className="text-blue-600 font-bold">
                        {(consumoAguaOpcoes[aguaIndex].value * 100).toFixed(0)}%
                      </span>
                    </div>
                  </>
                )}

                {/* === Alocação de Colonos === */}
                {abaParametros === "alocacao" &&
                  (() => {
                    const consumoAgua = consumoAguaOpcoes[aguaIndex].value; // usa o selecionado
                    const totalColonos = estadoAtual?.populacao?.colonos || 0; // pega do estado real

                    const format = (v) =>
                      Math.abs(v) < 1 && v !== 0
                        ? v.toFixed(2)
                        : Number.isInteger(v)
                        ? v
                        : v.toFixed(1);
                    const alloc = (campo) =>
                      Math.round(
                        ((tempAlocacao[campo] || 0) / 100) * totalColonos
                      );

                    const previewBySetor = (setor, n) => {
                      switch (setor) {
                        case "fazenda": {
                          const out = n * 2 * consumoAgua;
                          return {
                            valor: out,
                            unidade: "comida/turno",
                            detalhe: `${n}×2×água(${consumoAgua})`,
                          };
                        }
                        case "minas": {
                          const out = n * 1 * consumoAgua;
                          return {
                            valor: out,
                            unidade: "minerais/turno",
                            detalhe: `${n}×1×água(${consumoAgua})`,
                          };
                        }
                        case "laboratorio": {
                          const out = n * 0.5;
                          return {
                            valor: out,
                            unidade: "ciência/turno",
                            detalhe: `${n}×0.5`,
                          };
                        }
                        case "construcao": {
                          const reparoPct = Math.floor(n / 10);
                          return {
                            valor: reparoPct,
                            unidade: "% de reparo/turno",
                            detalhe: `${n}↦${reparoPct}%`,
                          };
                        }
                        case "saude": {
                          const out = (n / 100) * consumoAgua;
                          return {
                            valor: out,
                            unidade: "saúde/turno",
                            detalhe: `${n}/100×água(${consumoAgua})`,
                          };
                        }
                        case "energia": {
                          const out = n * 5;
                          return {
                            valor: out,
                            unidade: "energia/turno",
                            detalhe: `${n}×5`,
                          };
                        }
                        default:
                          return { valor: 0, unidade: "", detalhe: "" };
                      }
                    };

                    const nFaz = alloc("fazenda");
                    const nMin = alloc("minas");
                    const nLab = alloc("laboratorio");
                    const nCon = alloc("construcao");
                    const nSau = alloc("saude");
                    const nEne = alloc("energia");

                    const totalComida = nFaz * 2 * consumoAgua;
                    const totalMinerais = nMin * 1 * consumoAgua;
                    const totalCiencia = nLab * 0.5;
                    const totalReparoPct = Math.floor(nCon / 10);
                    const totalSaude = (nSau / 100) * consumoAgua;
                    const totalEnergia = nEne * 5;

                    return (
                      <>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-bold">
                            Parâmetros — Alocação de Colonos
                          </h3>
                        </div>

                        <div className="flex items-center mb-4">
                          <div className="mr-1 mb-4">
                            <PopulationLottie />
                          </div>
                          <h4 className="text-lg font-semibold">
                            Alocação de Colonos (100%)
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {setoresOrdem.map((campo) => {
                            const nColonos = alloc(campo);
                            const prev = previewBySetor(campo, nColonos);

                            return (
                              <div
                                key={campo}
                                className="bg-slate-100 p-4 rounded-lg shadow-inner border border-slate-200"
                              >
                                <h5 className="text-md font-semibold mb-2 capitalize text-slate-700">
                                  {campo}
                                </h5>

                                <Slider
                                  value={tempAlocacao[campo]}
                                  min={0}
                                  max={100}
                                  step={1}
                                  onChange={(_, value) =>
                                    handleSliderChange(campo, value)
                                  }
                                  onChangeCommitted={(_, value) =>
                                    handleSliderChangeCommitted(campo, value)
                                  }
                                  sx={{ color: "#3b82f6" }}
                                />

                                <div className="text-sm text-slate-600 mt-1 flex justify-between">
                                  <span>{tempAlocacao[campo]}%</span>
                                  <span className="font-medium text-blue-600">
                                    {nColonos} colonos
                                  </span>
                                </div>

                                <div className="mt-2 text-xs text-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-slate-500">
                                      Produção (colonos):
                                    </span>
                                    <span className="font-semibold">
                                      +{format(prev.valor)} {prev.unidade}
                                    </span>
                                  </div>
                                  {prev.detalhe && (
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {prev.detalhe}
                                      {["fazenda", "minas", "saude"].includes(
                                        campo
                                      ) && (
                                        <span className="ml-1 opacity-70">
                                          • depende de água
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-400 mt-1">
                                    *Não inclui bônus de
                                    construções/tecnologias.
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="font-semibold text-slate-700 mb-2">
                            📦 Resumo (somente colonos)
                          </div>
                          <ul className="grid grid-cols-2 md:grid-cols-3 gap-y-1 text-sm text-slate-700">
                            <li>
                              🌾 Comida:{" "}
                              <span className="font-semibold">
                                +{format(totalComida)}
                              </span>
                            </li>
                            <li>
                              ⛏️ Minerais:{" "}
                              <span className="font-semibold">
                                +{format(totalMinerais)}
                              </span>
                            </li>
                            <li>
                              🧪 Ciência:{" "}
                              <span className="font-semibold">
                                +{format(totalCiencia)}
                              </span>
                            </li>
                            <li>
                              🛠️ Reparo:{" "}
                              <span className="font-semibold">
                                +{totalReparoPct}%
                              </span>
                            </li>
                            <li>
                              🏥 Saúde:{" "}
                              <span className="font-semibold">
                                +{format(totalSaude)}
                              </span>
                            </li>
                            <li>
                              ⚡ Energia:{" "}
                              <span className="font-semibold">
                                +{format(totalEnergia)}
                              </span>
                            </li>
                          </ul>
                          <div className="text-[11px] text-slate-500 mt-1">
                            *Prévia dos colonos; não inclui bônus de
                            construções/tecnologias. Itens com 💧 dependem da
                            água (atual: {consumoAgua}).
                          </div>
                        </div>
                      </>
                    );
                  })()}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {abaSelecionada === "construcoes" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Construções</h2>

            {/* Menu de abas horizontal */}
            <Tabs
              value={abaConstrucao}
              onChange={(_, newValue) => setAbaConstrucao(newValue)}
              variant="scrollable"
              scrollButtons
              allowScrollButtonsMobile
              aria-label="tabs de construção"
              className="mb-4"
              sx={{
                "& .MuiTabs-indicator": {
                  backgroundColor: "#38bdf8", // cyan-400 (Tailwind)
                  height: 4,
                },
                "& .MuiTab-root": {
                  color: "#cbd5e1", // slate-300
                  fontWeight: "bold",
                  transition: "color 0.2s ease",
                },
                "& .Mui-selected": {
                  color: "#38bdf8", // cyan-400
                },
              }}
            >
              {[
                "fazenda",
                "defesa",
                "minas",
                "laboratorio",
                "saude",
                "energia",
                "agua",
              ].map((item) => (
                <Tab
                  key={item}
                  value={item}
                  label={item.charAt(0).toUpperCase() + item.slice(1)}
                />
              ))}
            </Tabs>

            {/* Card com conteúdo animado da aba */}
            <AnimatePresence mode="wait">
              <motion.div
                key={abaConstrucao}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
              >
                {[
                  "fazenda",
                  "defesa",
                  "minas",
                  "laboratorio",
                  "saude",
                  "energia",
                  "agua",
                ].includes(abaConstrucao) && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        Construções - Setor{" "}
                        {abaConstrucao.charAt(0).toUpperCase() +
                          abaConstrucao.slice(1)}
                      </h3>

                      <Badge
                        badgeContent={filaConstrucoes.length}
                        color="error"
                        showZero
                      >
                        {/* Botão Drawer (canto superior direito) */}
                        <div className="absolute right-0 top-0">
                          <Badge
                            badgeContent={filaConstrucoes.length}
                            color="error"
                            showZero
                          >
                            <IconButton
                              size="small"
                              data-tour="btn-fila"
                              onClick={() => setDrawerAberto(true)}
                              sx={{
                                color: "#334155",
                                bgcolor: "rgba(148,163,184,.15)",
                              }}
                            >
                              <List fontSize="small" />
                            </IconButton>
                          </Badge>
                        </div>
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(buildings)
                        .filter(([_, item]) => item.categoria === abaConstrucao)
                        .map(([key, item]) => {
                          const temRecursos = Object.entries(item.custo).every(
                            ([recurso, valor]) => estadoAtual[recurso] >= valor
                          );

                          return (
                            <div
                              key={key}
                              className="bg-white text-slate-900 rounded-lg shadow-lg p-4 flex flex-col justify-between transition hover:scale-[1.02]"
                            >
                              {item.imagem && (
                                <div className="relative mb-3">
                                  <motion.img
                                    src={item.imagem}
                                    alt={`Imagem de ${item.nome}`}
                                    className="w-full h-40 object-cover rounded"
                                    whileHover={{
                                      scale: 1.1,
                                      height: "180px",
                                    }}
                                    transition={{ duration: 0.3 }}
                                  />
                                  <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                                    x{estadoAtual.construcoes?.[key] || 0}
                                  </div>
                                </div>
                              )}

                              <h4 className="text-lg font-bold mb-1">
                                {item.nome}
                              </h4>
                              <p className="text-sm text-gray-700 mb-2">
                                {item.descricao}
                              </p>

                              <ul className="text-sm text-gray-600 mb-2">
                                {Object.entries(item.custo).map(
                                  ([recurso, val]) => {
                                    const construidas =
                                      estadoAtual.construcoes?.[key] || 0;
                                    // Conta apenas as construções na fila que são do mesmo tipo (key)
                                    const naFila = filaConstrucoes.filter(
                                      (fc) => fc.id === key
                                    ).length;
                                    const multiplicador = construidas + naFila;
                                    const total = val * 2 ** multiplicador;
                                    const valorFinal =
                                      recurso === "agua"
                                        ? Math.min(total, 100)
                                        : total;

                                    return (
                                      <li key={recurso}>
                                        💰 <strong>{recurso}</strong>:{" "}
                                        {valorFinal}
                                      </li>
                                    );
                                  }
                                )}
                              </ul>

                              <p className="text-sm text-gray-700 mb-2">
                                ⏱️ Tempo de construção: {item.tempo} turno(s)
                              </p>

                              {item.efeitos?.bonusComida && (
                                <p className="text-sm text-green-700 mb-4">
                                  🍽️ Bônus: +{item.efeitos.bonusComida} comida
                                </p>
                              )}

                              <button
                                onClick={() => handleConstruir(key)}
                                disabled={!temRecursos}
                                className={`mt-auto px-4 py-2 rounded font-semibold ${
                                  temRecursos
                                    ? "bg-green-600 text-white hover:bg-green-700"
                                    : "bg-gray-400 text-gray-700 cursor-not-allowed"
                                } transition`}
                              >
                                Construir
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
            <></>
          </>
        )}

        {abaSelecionada === "pesquisas" && (
          <div className="mt-4">
            <h3 className="text-xl font-semibold mb-4">
              🌱 Árvore de Evolução
            </h3>
            <EvolutionTree
              initialEdges={estadoAtual.pesquisa}
              estadoAtual={estadoAtual}
              onGastarCiencia={onGastarCiencia}
            />
          </div>
        )}

        {abaSelecionada === "criacaoPopulacao" && (
          <motion.div
            key="criacaoPopulacao"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold">Criação de População</h3>
              <p className="text-sm text-gray-600">
                Recrute colonos e tropas imediatamente para fortalecer sua
                colônia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {populacoes.map((item, index) => {
                const temRecursos = Object.entries(item.custo).every(
                  ([recurso, valor]) => estadoAtual[recurso] >= valor
                );

                return (
                  <div
                    key={index}
                    className="bg-white text-slate-900 rounded-lg shadow-lg p-4 flex flex-col justify-between transition hover:scale-[1.02]"
                  >
                    {item.imagem && (
                      <div className="relative mb-3">
                        <motion.img
                          src={item.imagem}
                          alt={`Imagem de ${item.nome}`}
                          className="w-full h-40 object-cover rounded"
                          whileHover={{
                            scale: 1.1,
                            height: "180px",
                          }}
                          transition={{ duration: 0.3 }}
                        />
                        <div className="absolute top-2 right-2 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                          x{estadoAtual.populacao[item.id] || 0}
                        </div>
                      </div>
                    )}

                    <h4 className="text-lg font-bold mb-1">{item.nome}</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      {item.descricao}
                    </p>

                    <ul className="text-sm text-gray-600 mb-2">
                      {Object.entries(item.custo).map(([recurso, valor]) => (
                        <li key={recurso}>
                          💰 <strong>{recurso}</strong>: {valor}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleCriarTropa(item)}
                      disabled={!temRecursos}
                      className={`mt-auto px-4 py-2 rounded font-semibold ${
                        temRecursos
                          ? "bg-purple-600 text-white hover:bg-purple-700"
                          : "bg-gray-400 text-gray-700 cursor-not-allowed"
                      } transition`}
                    >
                      Criar
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {abaSelecionada === "criacaoTropas" && (
          <motion.div
            key="criacaoTropas"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
          >
            <div className="mb-4">
              <h3 className="text-xl font-bold">Criação de Tropas</h3>
              <p className="text-sm text-gray-600">
                Recrute guerreiros para proteger e expandir sua colônia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tropas.map((item, index) => {
                const temRecursos = Object.entries(item.custo).every(
                  ([recurso, valor]) => estadoAtual[recurso] >= valor
                );

                return (
                  <div
                    key={index}
                    className="bg-white text-slate-900 rounded-lg shadow-lg p-4 flex flex-col justify-between transition hover:scale-[1.02]"
                  >
                    {item.imagem && (
                      <div className="relative mb-3">
                        <motion.img
                          src={item.imagem}
                          alt={`Imagem de ${item.nome}`}
                          className="w-full h-40 object-cover rounded"
                          whileHover={{ scale: 1.1, height: "180px" }}
                          transition={{ duration: 0.3 }}
                        />
                        <div className="absolute top-2 right-2 bg-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                          x{estadoAtual.populacao[item.id] || 0}
                        </div>
                      </div>
                    )}

                    <h4 className="text-lg font-bold mb-1">{item.nome}</h4>
                    <p className="text-sm text-gray-700 mb-2">
                      {item.descricao}
                    </p>

                    <ul className="text-sm text-gray-600 mb-2">
                      {Object.entries(item.custo).map(([recurso, valor]) => (
                        <li key={recurso}>
                          💰 <strong>{recurso}</strong>: {valor}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleCriarTropa(item)}
                      disabled={!temRecursos}
                      className={`mt-auto px-4 py-2 rounded font-semibold ${
                        temRecursos
                          ? "bg-yellow-600 text-white hover:bg-yellow-700"
                          : "bg-gray-400 text-gray-700 cursor-not-allowed"
                      } transition`}
                    >
                      Criar
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {abaSelecionada === "exploradores" && (
          <MissoesExploradores
            estadoAtual={estadoAtual}
            onSalvar={async (delta) => {
              const novoEstado = { ...estadoAtual, ...delta }; // delta = { exploradores: [...] }
              onEstadoChange?.(novoEstado); // atualiza o estado do pai → re-render com nome novo
              await coloniaService.atualizarColonia(
                estadoAtual._id,
                novoEstado
              ); // persiste no backend
            }}
          />
        )}

        {abaSelecionada === "exploracao" && (
          <MissoesExploracao
            estadoAtual={estadoAtual}
            onEstadoChange={onEstadoChange}
          />
        )}

        {loading && (
          <div className="flex items-center gap-3 mt-6 text-white">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            <span>Simulando turno...</span>
          </div>
        )}

        <button
          onClick={handleApplyClick}
          data-tour="apply"
          className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
        >
          Aplicar Parâmetros
        </button>
        <Drawer
          anchor="right"
          open={drawerAberto}
          onClose={() => setDrawerAberto(false)}
        >
          <div
            className="w-80 p-4 bg-white h-full flex flex-col"
            data-tour="fila"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Fila de Construção</h2>
              <IconButton onClick={() => setDrawerAberto(false)}>
                <CloseIcon />
              </IconButton>
            </div>

            <ul className="flex flex-col gap-3">
              {filaConstrucoes.map((item, index) => {
                const tempoTotal = buildings[item.id]?.tempo || 1;
                const progresso =
                  ((tempoTotal - item.tempoRestante) / tempoTotal) * 100;

                return (
                  <li
                    key={index}
                    className="border p-2 rounded shadow bg-white"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-gray-800">
                          {item.nome}
                        </p>
                        <p className="text-sm text-gray-600">
                          ⏱️ {item.tempoRestante} turno(s) restante(s)
                        </p>
                      </div>

                      <LinearProgressWithLabel value={progresso} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Drawer>
        <Dialog
          open={modalAberto}
          onClose={(_, reason) => {
            if (reason === "backdropClick" || reason === "escapeKeyDown") {
              startMinigame();
            }
          }}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle className="text-xl font-bold">
            Simulação do Turno
          </DialogTitle>
          <DialogContent>
            <Stepper activeStep={stepAtual} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <div className="mt-6">{conteudoStep[stepAtual]}</div>

            <MobileStepper
              variant="dots"
              steps={steps.length}
              position="static"
              activeStep={stepAtual}
              nextButton={
                <MuiButton
                  size="small"
                  onClick={() => {
                    if (stepAtual === steps.length - 1) {
                      startMinigame(); // fecha e navega
                    } else {
                      setStepAtual((prev) => prev + 1);
                    }
                  }}
                >
                  {stepAtual === steps.length - 1 ? "Fechar" : "Próximo"}
                </MuiButton>
              }
              backButton={
                <MuiButton
                  size="small"
                  onClick={() => setStepAtual((prev) => prev - 1)}
                  disabled={stepAtual === 0}
                >
                  Voltar
                </MuiButton>
              }
              className="mt-6"
            />
          </DialogContent>
        </Dialog>
        <WaterAlertLottie
          open={modalAguaAberto}
          onClose={() => setModalAguaAberto(false)}
          aguaNecessaria={aguaNecessaria}
        />
      </div>
    </div>
  );
}

export default ParameterPanel;
