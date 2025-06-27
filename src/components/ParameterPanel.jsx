import React, { useState } from "react";
import {
  Switch,
  FormControlLabel,
  Slider,
  ButtonGroup,
  Button,
} from "@mui/material";

const MAX_PONTOS = 3;

// Lista fixa para manter ordem estável
const setoresOrdem = [
  "fazenda",
  "defesa",
  "minas",
  "laboratorio",
  "construcao",
  "saude",
  "energia",
];

function ParameterPanel({ onChange, populacao = 100 }) {
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

  const totalUsado = Object.values(distribuicao).reduce(
    (acc, val) => acc + val,
    0
  );

  // Agora o consumo de água será um dos três valores: 0.5, 1, 1.5 (representando % 50, 100, 150)
  // Para facilitar, guardamos o índice 0, 1 ou 2 para escolher o botão ativo
  // Mas para onChange enviamos o valor real de consumo (0.5, 1 ou 1.5)
  const consumoAguaOpcoes = [
    { label: "Reduzido", value: 0.5, color: "success" }, // verde
    { label: "Normal", value: 1, color: "primary" }, // azul
    { label: "Exagerado", value: 1.5, color: "error" }, // vermelho
  ];

  const [aguaIndex, setAguaIndex] = useState(1); // começa com "Normal" (index 1)

  // Estado alocação colonos
  const [alocacaoColonos, setAlocacaoColonos] = useState({
    fazenda: 15,
    defesa: 15,
    minas: 15,
    laboratorio: 15,
    construcao: 15,
    saude: 15,
    energia: 10,
  });

  const handleSwitchToggle = (campo) => {
    const ativo = distribuicao[campo] === 1;

    if (ativo) {
      setDistribuicao({ ...distribuicao, [campo]: 0 });
    } else {
      if (totalUsado < MAX_PONTOS) {
        setDistribuicao({ ...distribuicao, [campo]: 1 });
      }
    }
  };

  // Guarda o valor temporário do slider para evitar atualização brusca
  const [tempAlocacao, setTempAlocacao] = useState(alocacaoColonos);

  const handleSliderChange = (campo, novoValor) => {
    setTempAlocacao((old) => ({ ...old, [campo]: novoValor }));
  };

  // Só ao "soltar" o slider aplica a redistribuição
  const handleSliderChangeCommitted = (campo, novoValor) => {
    const restante = 100 - novoValor;
    const outros = setoresOrdem.filter((k) => k !== campo);
    const somaAtual = outros.reduce((acc, k) => acc + alocacaoColonos[k], 0);

    const novaDistribuicao = {};
    outros.forEach((k) => {
      // Evita divisão por zero
      novaDistribuicao[k] =
        somaAtual === 0
          ? Math.floor(restante / outros.length)
          : Math.round((alocacaoColonos[k] / somaAtual) * restante);
    });

    // Corrige erro de arredondamento
    const somaDistribuida = Object.values(novaDistribuicao).reduce(
      (a, b) => a + b,
      0
    );
    const ajuste = 100 - (somaDistribuida + novoValor);
    if (ajuste !== 0 && outros.length > 0) {
      novaDistribuicao[outros[0]] += ajuste;
    }

    setAlocacaoColonos({
      ...novaDistribuicao,
      [campo]: novoValor,
    });
    setTempAlocacao({
      ...novaDistribuicao,
      [campo]: novoValor,
    });
  };

  const handleSubmit = () => {
    onChange({
      distribuicao,
      agua: consumoAguaOpcoes[aguaIndex].value, // envia valor real do consumo
      alocacaoColonos,
    });
  };

  return (
    <div className="parameter-panel max-w-3xl mx-auto p-4">
      <h2 className="text-lg font-semibold mb-2">
        Distribuição de Pontos (Máx: {MAX_PONTOS})
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Total usado: {totalUsado} / {MAX_PONTOS}
      </p>

      {Object.keys(distribuicao).map((campo) => (
        <div key={campo} className="mb-2">
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
        </div>
      ))}

      <fieldset className="mt-6">
        <legend className="font-semibold mb-1">Consumo de Água</legend>
        <ButtonGroup
          color="primary"
          variant="outlined"
          aria-label="consumo de água"
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
        <div className="mt-2 text-sm text-gray-600">
          Consumo atual: {(consumoAguaOpcoes[aguaIndex].value * 100).toFixed(0)}
          %
        </div>
      </fieldset>

      <hr className="my-6" />

      <fieldset className="mt-6">
        <legend className="font-semibold mb-4 text-lg">
          Alocação de Colonos (100%)
        </legend>
        <div className="flex flex-col gap-6">
          {setoresOrdem.map((campo) => (
            <div
              key={campo}
              className="flex flex-col md:flex-row md:items-center md:gap-6"
            >
              <div className="md:w-48 capitalize font-medium">{campo}</div>
              <Slider
                className="flex-grow"
                value={tempAlocacao[campo]}
                min={0}
                max={100}
                step={1}
                onChange={(_, value) => handleSliderChange(campo, value)}
                onChangeCommitted={(_, value) =>
                  handleSliderChangeCommitted(campo, value)
                }
                aria-labelledby={`${campo}-slider`}
              />
              <div className="md:w-32 text-right font-semibold">
                {tempAlocacao[campo]}% —{" "}
                {Math.round((tempAlocacao[campo] / 100) * populacao)} colonos
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <button
        onClick={handleSubmit}
        className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors duration-200"
      >
        Aplicar Parâmetros
      </button>
    </div>
  );
}

export default ParameterPanel;
