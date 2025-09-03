import React from "react";
import {
  FaRegHeart,
  FaBolt,
  FaTint,
  FaDrumstickBite,
  FaHammer,
  FaUsers,
  FaLeaf,
  FaCoins,
  FaClock,
  FaShieldAlt,
  FaFlask,
} from "react-icons/fa";

function StatusPanel({ estado }) {
  console.log(estado);
  const somaPopulacao = Object.values(estado.populacao).reduce(
    (acc, valor) => acc + valor,
    0
  );

  // --- HOSPITAL: números para o tooltip ---
  const posto = estado?.construcoes?.postoMedico ?? 0;
  const hosp = estado?.construcoes?.hospitalCentral ?? 0;

  // mesma regra do engine: cada posto = 3, cada hospital = 8
  const capacidadeHospital = posto * 3 + hosp * 8;

  const internadosArr = estado?.hospital?.internados ?? [];
  const internados = internadosArr.length;

  const slotsOcupados = internadosArr.length;

  const filaHospital = estado?.hospital?.fila?.length ?? 0;

  const statusList = [
    { label: "Turno", value: estado.turno, icon: <FaClock /> },
    {
      label: "Integridade",
      value: `${estado.integridadeEstrutural}%`,
      icon: <FaShieldAlt />,
    },
    {
      label: "Água",
      value: `${estado.agua}/${estado.maxAgua}`,
      icon: <FaTint />,
    },
    {
      label: "População",
      value: somaPopulacao,
      icon: <FaUsers />,
      tooltip: (
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🏠</span>
              <span>Colonos:</span>
            </div>
            <span>{estado.populacao.colonos}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🔍</span>
              <span>Exploradores:</span>
            </div>
            <span>{estado.populacao.exploradores}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">⚔️</span>
              <span>Marines:</span>
            </div>
            <span>{estado.populacao.marines}</span>
          </div>
          <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
            <span>Total:</span>
            <span>{somaPopulacao}</span>
          </div>
        </div>
      ),
    },
    {
      label: "Energia",
      value: estado.energia,
      icon: <FaBolt />,
      tooltip: (
        <div
          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
opacity-0 invisible group-hover:opacity-100 group-hover:visible 
transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
border border-gray-700 text-white"
        >
          {(() => {
            const sol = estado.construcoes?.geradorSolar || 0;
            const geo = estado.construcoes?.reatorGeotermico || 0;

            // Energia por construção
            const energiaSolar = sol * 12; // +12 por gerador
            const energiaGeo = geo * 30; // +30 por reator

            // Sustentabilidade por construção
            const sustSolar = Math.floor(sol / 2); // +1 a cada 2 geradores
            const sustGeo = -geo; // -1 por reator
            const sustTotal = sustSolar + sustGeo;

            return (
              <div className="text-sm space-y-2">
                <div className="font-semibold text-slate-200">Produção</div>

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
                    <span>Solar (+1 a cada 2):</span>
                  </div>
                  <span>+{sustSolar}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🌋</span>
                    <span>Geotérmico (−1 por reator):</span>
                  </div>
                  <span>{sustGeo}</span>
                </div>

                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                  <span>Total/turno:</span>
                  <span
                    className={
                      sustTotal >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {sustTotal >= 0 ? "+" : ""}
                    {sustTotal}
                  </span>
                </div>

                <div className="text-xs text-slate-400 pt-1">
                  Reator: custo de manutenção −2 ⛏️ por reator/turno.
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },
    {
      label: "Comida",
      value: estado.comida,
      icon: <FaDrumstickBite />,
      tooltip: (
        <div
          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
    transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
    border border-gray-700 text-white"
        >
          {(() => {
            // --- cálculos para exibir no tooltip ---
            const colonos = estado.populacao?.colonos || 0;
            const exploradores = estado.populacao?.exploradores || 0;
            const marines = estado.populacao?.marines || 0;

            const consumoColonos = colonos * 1;
            const consumoExploradores = exploradores * 2;
            const consumoMarines = marines * 2;
            const consumoTotal =
              consumoColonos + consumoExploradores + consumoMarines;

            const fazendas = estado.construcoes?.fazenda || 0;
            const irrigadores = estado.construcoes?.sistemaDeIrrigacao || 0;

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

                <div className="font-semibold text-slate-200">Consumo</div>

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
                    <span>Marines:</span>
                  </div>
                  <span>-{consumoMarines}</span>
                </div>

                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                  <span>Total (consumo):</span>
                  <span>-{consumoTotal}</span>
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },

    { label: "Minerais", value: estado.minerais, icon: <FaHammer /> },
    { label: "Ciência", value: estado.ciencia, icon: <FaFlask /> },
    {
      label: "Saúde",
      value: `${estado.saude}%`,
      icon: <FaRegHeart />,
      tooltip: (
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

          {/* Opcional: detalhar prédios que compõem a capacidade */}
          <div className="border-t border-gray-600 mt-1 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Postos Médicos:</span>
              <span>{posto}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Hospitais Centrais:</span>
              <span>{hosp}</span>
            </div>
          </div>
        </div>
      ),
    },

    {
      label: "Sustentabilidade",
      value: `${estado.sustentabilidade}%`,
      icon: <FaLeaf />,
    },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3 bg-slate-800 p-3 rounded-lg shadow-inner">
      {statusList.map((item, index) => (
        <div
          key={index}
          className="relative flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-md shadow-sm text-sm hover:bg-slate-600 transition-all group"
        >
          <span className="text-blue-300">{item.icon}</span>
          <span className="font-medium">{item.value}</span>
          <span className="text-gray-400 text-xs">{item.label}</span>
          {item.tooltip && (
            <div
              className="absolute z-20 left-1/2 transform -translate-x-1/2 top-full mt-1 w-56 p-3 bg-gray-800 rounded-lg shadow-xl 
                           opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                           transition-all duration-300 transform translate-y-0 group-hover:translate-y-1
                           border border-gray-700 text-white"
            >
              {item.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default StatusPanel;
