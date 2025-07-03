import { useState } from "react";
import {
  Switch,
  FormControlLabel,
  Slider,
  ButtonGroup,
  Button,
  Tooltip,
} from "@mui/material";

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
  { grupo: "Parâmetros", itens: [
  { id: "distribuicao", label: "Distribuição de Pontos" },
  { id: "agua", label: "Consumo de Água" },
  { id: "colonos", label: "Alocação de Colonos" },
  ]},
  { grupo: "Desenvolvimento", itens: [
    { id: "construcoes", label: "Construções" },
    { id: "pesquisas", label: "Pesquisas" },
  ]}
];

function ParameterPanel({ onChange, populacao = 100 }) {
  const [abaSelecionada, setAbaSelecionada] = useState("distribuicao");

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
    exploracao: "Desbloqueia novas áreas e recursos para exploração"
  };

  const totalUsado = Object.values(distribuicao).reduce((acc, val) => acc + val, 0);

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

    const somaDistribuida = Object.values(novaDistribuicao).reduce((a, b) => a + b, 0);
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
    });
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
                    className={`text-left w-full px-2 py-1 border-l-4 ${
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
                        disabled={distribuicao[campo] === 0 && totalUsado >= MAX_PONTOS}
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
              Consumo atual: {(consumoAguaOpcoes[aguaIndex].value * 100).toFixed(0)}%
            </div>
          </>
        )}

        {abaSelecionada === "colonos" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Alocação de Colonos (100%)</h2>
            <div className="flex flex-col gap-6">
              {setoresOrdem.map((campo, index) => (
                <div key={campo}>
                  <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                    <div className="md:w-48 capitalize font-medium">{campo}</div>
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
                      {Math.round((tempAlocacao[campo] / 100) * populacao)} colonos
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
            <p className="text-gray-400">Aqui entrarão suas estruturas futuras.</p>
          </>
        )}

        {abaSelecionada === "pesquisas" && (
          <>
            <h2 className="text-xl font-semibold mb-4">Pesquisas</h2>
            <p className="text-gray-400">Tecnologias para evoluir sua colônia.</p>
          </>
        )}

        <button
          onClick={handleSubmit}
          className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
        >
          Aplicar Parâmetros
        </button>
      </div>
    </div>
  );
}

export default ParameterPanel;
