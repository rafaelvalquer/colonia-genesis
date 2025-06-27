import React from "react";

function StatusPanel({ estado }) {
  return (
    <div className="status-panel">
      <h2>Status da Colônia</h2>
      <ul>
        <li>
          <strong>Turno:</strong> {estado.turno}
        </li>
        <li>
          <strong>Integridade Estrutural:</strong>{" "}
          {estado.integridadeEstrutural}%
        </li>
        <li>
          <strong>População:</strong> {estado.populacao}
        </li>
        <li>
          <strong>Energia:</strong> {estado.energia}
        </li>
        <li>
          <strong>Água:</strong> {estado.agua}
        </li>
        <li>
          <strong>Comida:</strong> {estado.comida}
        </li>
        <li>
          <strong>Minerais:</strong> {estado.minerais}
        </li>
        <li>
          <strong>Saúde:</strong> {estado.saude}
        </li>
        <li>
          <strong>Sustentabilidade:</strong> {estado.sustentabilidade}%
        </li>
      </ul>
    </div>
  );
}

export default StatusPanel;
