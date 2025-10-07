// src/pages/ExplorerPage.jsx
import { useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import ExplorerCanvas from "../explorador/GameCanvas";

const ExplorerPage = () => {
  const { state } = useLocation();

  // vindo do navigate(...)
  const {
    estadoAtual: estadoInicial,
    explorer: explorerFromNav,
    explorerId: explorerIdFromNav,
    mission: missionFromNav,
    missionId: missionIdFromNav,
    filaItem: filaItemFromNav,
  } = state || {};

  const [estadoAtual, setEstadoAtual] = useState(estadoInicial);

  // resolve missionId e explorerId com fallback
  const missionId = useMemo(
    () => missionIdFromNav ?? filaItemFromNav?.id ?? null,
    [missionIdFromNav, filaItemFromNav]
  );

  const explorerId = useMemo(
    () =>
      explorerIdFromNav ??
      explorerFromNav?.id ??
      filaItemFromNav?.explorerId ??
      null,
    [explorerIdFromNav, explorerFromNav, filaItemFromNav]
  );

  // resolve explorer a partir do estadoAtual se não veio pronto
  const explorer = useMemo(() => {
    if (explorerFromNav) return explorerFromNav;
    if (!estadoAtual || !explorerId) return null;
    return (
      (estadoAtual.exploradores || []).find((e) => e.id === explorerId) || null
    );
  }, [explorerFromNav, estadoAtual, explorerId]);

  if (!estadoAtual) {
    return <div className="p-4 text-red-300">Erro: Estado não fornecido.</div>;
  }

  if (!explorer) {
    return (
      <div className="p-4 text-yellow-300">
        Aviso: Explorador não encontrado para esta missão.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 h-screen text-white p-4">
      <ExplorerCanvas
        estadoAtual={estadoAtual}
        onEstadoChange={setEstadoAtual}
        explorer={explorer}
        explorerId={explorerId}
        mission={missionFromNav || null}
        missionId={missionId}
        filaItem={filaItemFromNav || null}
      />
    </div>
  );
};

export default ExplorerPage;
