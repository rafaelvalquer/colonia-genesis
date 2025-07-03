import React from "react";

function StatusPanel({ estado }) {
    const statusList = [
    { label: "Turno", value: estado.turno },
    { label: "Integridade", value: `${estado.integridadeEstrutural}%` },
    { label: "População", value: estado.populacao },
    { label: "Energia", value: estado.energia },
    { label: "Água", value: estado.agua },
    { label: "Comida", value: estado.comida },
    { label: "Minerais", value: estado.minerais },
    { label: "Saúde", value: estado.saude },
    { label: "Sustentabilidade", value: `${estado.sustentabilidade}%` },
  ];
 return (
    <div className="flex flex-wrap justify-center gap-4">
      {statusList.map((item, index) => (
        <div
          key={index}
          className="bg-slate-600 text-white rounded-lg shadow p-4 w-36 text-center"
        >
          <div className="text-sm font-semibold uppercase tracking-wide mb-1">
            {item.label}
          </div>
          <div className="text-xl font-bold">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export default StatusPanel;
