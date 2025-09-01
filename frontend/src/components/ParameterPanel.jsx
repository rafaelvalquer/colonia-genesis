//ParameterPanel.jsx

import { useMemo, useState } from "react";
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
    itens: [
      { id: "distribuicao", label: "Skill Points" },
      { id: "agua", label: "Consumo de Água" },
      { id: "colonos", label: "Alocação de Colonos" },
    ],
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
    //defesa: 0,
    minas: 0,
    laboratorio: 0,
    construcao: 0,
    saude: 0,
    energia: 0,
    exploracao: 0,
  });

  const populacoes = [
    {
      id: "colonos",
      nome: "Colono",
      descricao: "Trabalhador comum que pode ser alocado em funções básicas.",
      imagem: "/images/colono.png",
      custo: {
        comida: 20,
        agua: 15,
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
      id: "marines",
      nome: "Marine",
      descricao: "Soldado básico para defesa da colônia.",
      imagem: "/images/marine.png",
      custo: {
        comida: 30,
        agua: 20,
      },
    },
    {
      id: "sniper",
      nome: "Sniper",
      descricao: "Unidade de ataque à distância.",
      imagem: "/images/sniper.png",
      custo: {
        comida: 25,
        agua: 15,
        madeira: 20,
      },
    },
    {
      id: "escudeiro",
      nome: "Escudeiro",
      descricao: "Unidade defensiva com alta resistência.",
      imagem: "/images/escudeiro.png",
      custo: {
        comida: 35,
        agua: 25,
        ferro: 25,
      },
    },
  ];

  console.log("filaConstrucoes ====", filaConstrucoes); // debugger

  const tooltips = {
    agricultura: "Aumenta a produção de alimentos para sua população",
    defesa: "Fortalecer suas defesas contra ataques inimigos",
    minas: "Extrair mais recursos minerais para construção",
    laboratorio: "Pesquisa tecnológica para avanços científicos",
    construcao: "Acelera a construção de novas estruturas",
    saude: "Melhora a qualidade de vida e produtividade dos cidadãos",
    energia: "Gera mais energia para alimentar suas estruturas",
    exploracao: "Desbloqueia novas áreas e recursos para exploração",
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

    if (estadoAtual.agua < aguaNecessaria) {
      setAguaNecessaria(aguaNecessaria);
      setModalAguaAberto(true);
      return;
    }

    // aplica custo de água localmente
    estadoAtual.agua -= aguaNecessaria;

    setLoading(true);
    try {
      // 👇 agora esperamos o report
      const report = await onChange({
        distribuicao,
        agua: consumo,
        alocacaoColonos,
        filaConstrucoes: estadoAtual.filaConstrucoes,
        filaMissoes: estadoAtual.filaMissoes,
      });

      setTurnReport(report); // <- guarda o relatório do turno
      setModalAberto(true); // abre o modal já com dados reais
    } finally {
      setLoading(false);
    }
  };

  const handleConstruir = (id) => {
    onConstruir(id); // <- apenas isso
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
      <>
        <h3 className="text-lg font-bold mb-2">🌌 Eventos & Missões</h3>

        <div className="mb-3">
          <p className="font-semibold mb-1">Eventos:</p>
          {eventos.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhum evento ocorrido.</p>
          ) : (
            <ul className="list-disc pl-5 text-sm">
              {eventos.map((ev, i) => (
                <li key={i}>{ev}</li>
              ))}
            </ul>
          )}
        </div>

        <div>
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
      </>,
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
            <ul className="flex flex-col gap-2 border-l border-gray-600 pl-3">
              {grupo.itens.map((aba) => (
                <li key={aba.id}>
                  <button
                    onClick={() => setAbaSelecionada(aba.id)}
                    className={`text-left w-full px-2 py-1 border-l-4 flex items-center gap-2 ${
                      abaSelecionada === aba.id
                        ? "border-blue-400 text-white font-semibold"
                        : "border-transparent text-gray-400 hover:text-white"
                    } transition-colors`}
                  >
                    {aba.label}
                  </button>
                </li>
              ))}
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
                    <ul className="space-y-2">
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
                                <span className="w-6 text-center">⚔️</span>
                                <span>Marines:</span>
                              </div>
                              <span>{estadoAtual.populacao.marines}</span>
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
                      <li>⚡ Energia: {estadoAtual.energia}</li>
                      <li>
                        💧 Água: {estadoAtual.agua}/{estadoAtual.maxAgua}
                      </li>
                      <li>🌾 Comida: {estadoAtual.comida}</li>
                      <li>⛏️ Minerais: {estadoAtual.minerais}</li>
                      <li>🧪 Ciência: {estadoAtual.ciencia}</li>
                      <li>🏥 Saúde: {estadoAtual.saude}%</li>
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

        {abaSelecionada === "distribuicao" && (
          <motion.div
            key="distribuicao"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
          >
            {/* Linha superior - Animação e título */}
            <div className="flex items-center mb-4">
              <div className="mr-4 mb-4">
                <FireLottie speed={totalUsado} />
              </div>
              <h2 className="text-xl font-semibold">
                Skill Points (Máx: {MAX_PONTOS})
              </h2>
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
                  <Tooltip title={tooltips[campo]} arrow placement="right">
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
                      label={campo.charAt(0).toUpperCase() + campo.slice(1)}
                    />
                  </Tooltip>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {abaSelecionada === "agua" && (
          <motion.div
            key="agua"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
          >
            {/* Linha superior - Animação e título */}
            <div className="flex items-center mb-4">
              <div className="mr-4">
                <WaterLottie speed={consumoAguaOpcoes[aguaIndex].value} />
              </div>
              <h2 className="text-xl font-semibold">Consumo de Água</h2>
            </div>

            <ButtonGroup variant="outlined" aria-label="Consumo de Água">
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
          </motion.div>
        )}

        {abaSelecionada === "colonos" && (
          <motion.div
            key="colonos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
          >
            {/* Linha superior - Animação e título */}
            <div className="flex items-center mb-4">
              <div className="mr-1 mb-4">
                <PopulationLottie />
              </div>
              <h2 className="text-xl font-bold mb-2 text-slate-800">
                Alocação de Colonos (100%)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {setoresOrdem.map((campo) => (
                <div
                  key={campo}
                  className="bg-slate-100 p-4 rounded-lg shadow-inner border border-slate-200"
                >
                  <h4 className="text-md font-semibold mb-2 capitalize text-slate-700">
                    {campo}
                  </h4>

                  <Slider
                    value={tempAlocacao[campo]}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(_, value) => handleSliderChange(campo, value)}
                    onChangeCommitted={(_, value) =>
                      handleSliderChangeCommitted(campo, value)
                    }
                    sx={{
                      color: "#3b82f6", // Tailwind blue-500
                    }}
                  />

                  <div className="text-sm text-slate-600 mt-1 flex justify-between">
                    <span>{tempAlocacao[campo]}%</span>
                    <span className="font-medium text-blue-600">
                      {Math.round(
                        (tempAlocacao[campo] / 100) * populacao.colonos
                      )}{" "}
                      colonos
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
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
          onClick={() => {
            handleSubmit(); // mantém a função original
            //setModalAberto(true); // abre o modal com stepper
          }}
          className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
        >
          Aplicar Parâmetros
        </button>
        <Drawer
          anchor="right"
          open={drawerAberto}
          onClose={() => setDrawerAberto(false)}
        >
          <div className="w-80 p-4 bg-white h-full flex flex-col">
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
          onClose={() => setModalAberto(false)}
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
                      setModalAberto(false); // fecha o modal no fim
                      setStepAtual(0); // reseta para o próximo uso
                      navigate("/minigame", { state: { estadoAtual } }); // redireciona para o jogo
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
