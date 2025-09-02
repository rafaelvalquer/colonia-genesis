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

  // slots ocupados (grave = 2, leve = 1)
  const slotsOcupados = internadosArr.reduce(
    (acc, p) => acc + (p?.severidade === "grave" ? 2 : 1),
    0
  );

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
    { label: "Energia", value: estado.energia, icon: <FaBolt /> },

    { label: "Comida", value: estado.comida, icon: <FaDrumstickBite /> },
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
