import { useState } from "react";
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
} from "@mui/material";

import List from "@mui/icons-material/List";
import CloseIcon from "@mui/icons-material/Close";
import { motion, AnimatePresence } from "framer-motion";
import buildings from "../data/buildings.json";
import { Badge } from "@mui/material";
import WaterLottie from "./WaterLottie"; // ajuste o caminho se necessário

const MAX_PONTOS = 3;
const setoresOrdem = [
  "fazenda",
  "defesa",
  "minas",
  "laboratorio",
  "construcao",
  "saude",
  "energia",
];

const abas = [
  {
    grupo: "Visão Geral",
    itens: [{ id: "central", label: "Central de Comando" }],
  },
  {
    grupo: "Parâmetros",
    itens: [
      { id: "distribuicao", label: "Distribuição de Pontos" },
      { id: "agua", label: "Consumo de Água" },
      { id: "colonos", label: "Alocação de Colonos" },
    ],
  },
  {
    grupo: "Desenvolvimento",
    itens: [
      { id: "construcoes", label: "Construções" },
      { id: "pesquisas", label: "Pesquisas" },
    ],
  },
];

function ParameterPanel({
  onChange,
  populacao = 100,
  estadoAtual,
  onConstruir,
  filaConstrucoes,
}) {
  const [abaSelecionada, setAbaSelecionada] = useState("central");
  const [abaConstrucao, setAbaConstrucao] = useState("fazenda");
  const [abaInternaCentral, setAbaInternaCentral] = useState("recursos");
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aguaIndex, setAguaIndex] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [stepAtual, setStepAtual] = useState(0);

  console.log("filaConstrucoes = " + JSON.stringify(filaConstrucoes));

  const [distribuicao, setDistribuicao] = useState({
    agricultura: 0,
    defesa: 0,
    minas: 0,
    laboratorio: 0,
    construcao: 0,
    saude: 0,
    energia: 0,
    exploracao: 0,
  });

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
    fazenda: 15,
    defesa: 15,
    minas: 15,
    laboratorio: 15,
    construcao: 15,
    saude: 15,
    energia: 10,
  });

  const [tempAlocacao, setTempAlocacao] = useState(alocacaoColonos);

  const steps = ["Recursos", "Eventos", "Resultado Final"];

  const handleSliderChange = (campo, novoValor) => {
    setTempAlocacao((old) => ({ ...old, [campo]: novoValor }));
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

  const handleSubmit = () => {
    setLoading(true); // inicia carregamento

    setTimeout(() => {
      onChange({
        distribuicao,
        agua: consumoAguaOpcoes[aguaIndex].value,
        alocacaoColonos,
        filaConstrucoes,
      });

      setLoading(false); // encerra após aplicar
    }, 500); // simula carregamento por 0.5s
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

  const conteudoStep = [
    <>
      <h3 className="text-lg font-bold mb-2">
        🔄 Coleta e Consumo de Recursos
      </h3>
      <p>- 💧 Água coletada: +20</p>
      <p>- 🌾 Comida consumida: -35</p>
      <p>- ⚡ Energia produzida: +50</p>
    </>,
    <>
      <h3 className="text-lg font-bold mb-2">🌌 Eventos Prováveis</h3>
      <p>⚠️ Tempestade solar: -10% energia</p>
      <p>✅ Descoberta de minerais raros: +30 minerais</p>
    </>,
    <>
      <h3 className="text-lg font-bold mb-2">📊 Resumo Final</h3>
      <p>✅ Turno concluído com sucesso!</p>
      <p>🎯 População satisfeita e produtiva</p>
    </>,
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Sidebar */}
      <aside className="w-full md:w-60 bg-slate-800 rounded-lg p-4 shadow-lg overflow-y-auto max-h-[600px]">
        {abas.map((grupo) => (
          <div key={grupo.grupo} className="mb-6">
            <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-widest">
              {grupo.grupo}
            </h3>
            <ul className="flex flex-col gap-2 border-l border-gray-600 pl-3">
              {grupo.itens.map((aba) => (
                <li key={aba.id}>
                  <button
                    onClick={() => setAbaSelecionada(aba.id)}
                    className={`text-left w-full px-2 py-1 border-l-4 ${abaSelecionada === aba.id
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
                      <li>👥 População: {estadoAtual.populacao}</li>
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
                    <h3 className="text-xl font-semibold mb-2">Construções</h3>
                    <ul className="space-y-2">
                      {Object.entries(estadoAtual.construcoes).map(
                        ([nome, qtd]) => (
                          <li key={nome}>
                            🏗️ {nome.charAt(0).toUpperCase() + nome.slice(1)}:{" "}
                            {qtd}
                          </li>
                        )
                      )}
                    </ul>
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
            <h2 className="text-xl font-semibold mb-2">
              Distribuição de Pontos (Máx: {MAX_PONTOS})
            </h2>
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
            <h2 className="text-xl font-bold mb-6 text-slate-800">
              Alocação de Colonos (100%)
            </h2>

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
                      {Math.round((tempAlocacao[campo] / 100) * populacao)}{" "}
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
                          <button
                            onClick={() => setDrawerAberto(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <List fontSize="small" />
                            Ver Fila
                          </button>
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
                                    ([recurso, val]) => (
                                      <li key={recurso}>
                                        💰 <strong>{recurso}</strong>: {val}
                                      </li>
                                    )
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
                                  className={`mt-auto px-4 py-2 rounded font-semibold ${temRecursos
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
          <>
            <h2 className="text-xl font-semibold mb-4">Pesquisas</h2>
            <p className="text-gray-400">
              Tecnologias para evoluir sua colônia.
            </p>
          </>
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
            setModalAberto(true); // abre o modal com stepper
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
      </div>
    </div>
  );
}

export default ParameterPanel;
