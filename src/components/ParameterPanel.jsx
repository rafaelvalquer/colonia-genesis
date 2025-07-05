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
} from "@mui/material";

import List from "@mui/icons-material/List";
import ListIcon from "@mui/icons-material/List";
import CloseIcon from "@mui/icons-material/Close";
import { motion, AnimatePresence } from "framer-motion";
import buildings from "../data/buildings.json";

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
  const [aguaIndex, setAguaIndex] = useState(1);

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
    onChange({
      distribuicao,
      agua: consumoAguaOpcoes[aguaIndex].value,
      alocacaoColonos,
      filaConstrucoes,
    });
  };

const handleConstruir = (id) => {
  onConstruir(id); // <- apenas isso
};

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
                      <li>🌾 Comida: {estadoAtual.comida}</li>
                      <li>💧 Água: {estadoAtual.agua}</li>
                      <li>⚡ Energia: {estadoAtual.energia}</li>
                      <li>⛏️ Minerais: {estadoAtual.minerais}</li>
                      <li>👥 População: {estadoAtual.populacao}</li>
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
          <>
            <h2 className="text-xl font-semibold mb-2">
              Distribuição de Pontos (Máx: {MAX_PONTOS})
            </h2>
            <p className="mb-4 text-sm text-gray-400">
              Total usado: {totalUsado} / {MAX_PONTOS}
            </p>
            {Object.keys(distribuicao).map((campo) => (
              <div key={campo} className="mb-2">
                <Tooltip title={tooltips[campo]} arrow placement="right">
                  <FormControlLabel
                    control={
                      <Switch
                        checked={distribuicao[campo] === 1}
                        onChange={() => handleSwitchToggle(campo)}
                        disabled={
                          distribuicao[campo] === 0 && totalUsado >= MAX_PONTOS
                        }
                      />
                    }
                    label={campo.charAt(0).toUpperCase() + campo.slice(1)}
                  />
                </Tooltip>
              </div>
            ))}
          </>
        )}

        {abaSelecionada === "agua" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Consumo de Água</h2>
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
            <div className="mt-2 text-sm text-gray-400">
              Consumo atual:{" "}
              {(consumoAguaOpcoes[aguaIndex].value * 100).toFixed(0)}%
            </div>
          </>
        )}

        {abaSelecionada === "colonos" && (
          <>
            <h2 className="text-xl font-semibold mb-4">
              Alocação de Colonos (100%)
            </h2>
            <div className="flex flex-col gap-6">
              {setoresOrdem.map((campo, index) => (
                <div key={campo}>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                    <div className="md:w-48 capitalize font-medium">
                      {campo}
                    </div>
                    <Slider
                      value={tempAlocacao[campo]}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(_, value) => handleSliderChange(campo, value)}
                      onChangeCommitted={(_, value) =>
                        handleSliderChangeCommitted(campo, value)
                      }
                    />
                    <div className="md:w-32 text-right font-semibold">
                      {tempAlocacao[campo]}% —{" "}
                      {Math.round((tempAlocacao[campo] / 100) * populacao)}{" "}
                      colonos
                    </div>
                  </div>
                  {index < setoresOrdem.length - 1 && (
                    <hr className="border-t border-gray-600 mt-2" />
                  )}
                </div>
              ))}
            </div>
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
                {abaConstrucao === "fazenda" && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold">
                        Construções - Setor Agrícola
                      </h3>

                      <button
                        onClick={() => setDrawerAberto(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        <List fontSize="small" />
                        Ver Fila
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(buildings)
                        .filter(([_, item]) => item.categoria === "fazenda")
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
                                  <img
                                    src={item.imagem}
                                    alt={`Imagem de ${item.nome}`}
                                    className="w-full h-40 object-cover rounded"
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

                {abaConstrucao === "defesa" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Defesa</h3>
                    <p className="text-gray-700 mb-4">
                      Protege sua colônia contra ataques externos.
                    </p>
                    <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                      Construir Defesa
                    </button>
                  </>
                )}

                {abaConstrucao === "minas" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Minas</h3>
                    <p className="text-gray-700 mb-4">
                      Extraem recursos minerais essenciais para construção.
                    </p>
                    <button className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition">
                      Construir Mina
                    </button>
                  </>
                )}

                {abaConstrucao === "laboratorio" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Laboratório</h3>
                    <p className="text-gray-700 mb-4">
                      Permite realizar pesquisas para evoluir a colônia.
                    </p>
                    <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
                      Construir Laboratório
                    </button>
                  </>
                )}

                {abaConstrucao === "saude" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Centro de Saúde</h3>
                    <p className="text-gray-700 mb-4">
                      Mantém a saúde dos colonos, reduzindo doenças.
                    </p>
                    <button className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 transition">
                      Construir Centro de Saúde
                    </button>
                  </>
                )}

                {abaConstrucao === "energia" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">
                      Gerador de Energia
                    </h3>
                    <p className="text-gray-700 mb-4">
                      Gera energia para alimentar suas estruturas.
                    </p>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                      Construir Gerador
                    </button>
                  </>
                )}

                {abaConstrucao === "agua" && (
                  <>
                    <h3 className="text-xl font-bold mb-2">Estação de Água</h3>
                    <p className="text-gray-700 mb-4">
                      Fornece água potável para sua população.
                    </p>
                    <button className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 transition">
                      Construir Estação de Água
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
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

        <button
          onClick={handleSubmit}
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

            {filaConstrucoes.length === 0 ? (
              <p className="text-gray-500">Nenhuma construção em andamento.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filaConstrucoes.map((item, index) => (
                  <li
                    key={index}
                    className="border p-2 rounded shadow flex justify-between items-center"
                  >
                    <div>
                      <p className="font-semibold">{item.nome}</p>
                      <p className="text-sm text-gray-600">
                        ⏱️ {item.tempoRestante} turno(s) restante(s)
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Drawer>
      </div>
    </div>
  );
}

export default ParameterPanel;
