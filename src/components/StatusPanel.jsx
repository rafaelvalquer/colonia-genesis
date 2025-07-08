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
  const statusList = [
    { label: "Turno", value: estado.turno, icon: <FaClock /> },
    {
      label: "Integridade",
      value: `${estado.integridadeEstrutural}%`,
      icon: <FaShieldAlt />,
    },
    { label: "População", value: estado.populacao, icon: <FaUsers /> },
    { label: "Energia", value: estado.energia, icon: <FaBolt /> },
    { label: "Água", value: estado.agua, icon: <FaTint /> },
    { label: "Comida", value: estado.comida, icon: <FaDrumstickBite /> },
    { label: "Minerais", value: estado.minerais, icon: <FaHammer /> },
    {
      label: "Sustentabilidade",
      value: `${estado.sustentabilidade}%`,
      icon: <FaLeaf />,
    },
    { label: "Saúde", value: estado.saude, icon: <FaRegHeart /> },
    { label: "Ciência", value: estado.ciencia, icon: <FaFlask /> },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-3 bg-slate-800 p-3 rounded-lg shadow-inner">
      {statusList.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-md shadow-sm text-sm hover:bg-slate-600 transition-all"
        >
          <span className="text-blue-300">{item.icon}</span>
          <span className="font-medium">{item.value}</span>
          <span className="text-gray-400 text-xs">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default StatusPanel;
