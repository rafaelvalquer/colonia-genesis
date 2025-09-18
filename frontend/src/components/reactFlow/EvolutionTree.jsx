// src/components/reactFlow/EvolutionTree.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import { CustomNode, CustomEdge } from "./CustomNode";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const edgeIdOf = (src, tgt) => `e-${src}::${tgt}`;

const GROUPS = [
  { id: "agricultura", label: "AGRICULTURA" },
  { id: "defesa", label: "DEFESA" },
  { id: "mineracao", label: "MINERAÇÃO" },
  { id: "laboratorio", label: "LABORATÓRIO" },
  { id: "saude", label: "SAÚDE" },
  { id: "energia", label: "ENERGIA" },
  { id: "agua", label: "ÁGUA" },
];

const groupColors = {
  agricultura: "#22c55e",
  defesa: "#f59e0b",
  mineracao: "#eab308",
  laboratorio: "#7c3aed",
  saude: "#ef4444",
  energia: "#f97316",
  agua: "#38bdf8",
};

const initialNodes = [
  // AGRICULTURA
  {
    id: "agr-1",
    type: "custom",
    data: {
      label: "🌾Agricultura",
      grupo: "agricultura",
      nivel: 1,
      isRoot: true,
    },
    position: { x: -110, y: 0 },
  },
  {
    id: "agr-2a",
    type: "custom",
    data: {
      label: "Fazenda • Sementes Adaptativas I",
      efeito: "Bônus da Fazenda: +5 → +6 por unidade.",
      cienciaNecessaria: 5,
      grupo: "agricultura",
      nivel: 2,
    },
    position: { x: -330, y: 200 },
  },
  {
    id: "agr-2b",
    type: "custom",
    data: {
      label: "Fazenda • Rotação Agrícola I",
      efeito: "+5% na produção total das Fazendas.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 2,
    },
    position: { x: -110, y: 200 },
  },
  {
    id: "agr-2c",
    type: "custom",
    data: {
      label: "Irrigação • Eficiência I",
      efeito: "−10% ⚡ consumo do Sistema de Irrigação.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 2,
    },
    position: { x: 110, y: 200 },
  },

  {
    id: "agr-3a",
    type: "custom",
    data: {
      label: "Corpo Agrícola • Mecanização I",
      efeito: "Cada colono concede +0,5 comida/turno à colônia.",
      cienciaNecessaria: 5,
      grupo: "agricultura",
      nivel: 3,
    },
    position: { x: -440, y: 400 },
  },
  {
    id: "agr-3b",
    type: "custom",
    data: {
      label: "Fazenda • Sementes Adaptativas II",
      efeito: "Bônus da Fazenda: +6 → +7 por unidade.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 3,
    },
    position: { x: -220, y: 400 },
  },

  {
    id: "agr-3c",
    type: "custom",
    data: {
      label: "Fazenda • Rotação Agrícola II",
      efeito: "+10% na produção total das Fazendas.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 3,
    },
    position: { x: 0, y: 400 },
  },

  {
    id: "agr-3d",
    type: "custom",
    data: {
      label: "Irrigação • Eficiência II",
      efeito: "−15% ⚡ consumo do Sistema de Irrigação.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 3,
    },
    position: { x: 220, y: 400 },
  },

  {
    id: "agr-4a",
    type: "custom",
    data: {
      label: "Corpo Agrícola • Mecanização II",
      efeito: "Cada colono concede +1 comida/turno à colônia.",
      cienciaNecessaria: 5,
      grupo: "agricultura",
      nivel: 4,
    },
    position: { x: -440, y: 600 },
  },
  {
    id: "agr-4b",
    type: "custom",
    data: {
      label: "Fazenda • Sementes Adaptativas III",
      efeito: "Bônus da Fazenda: +7 → +8 por unidade.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 4,
    },
    position: { x: -220, y: 600 },
  },

  {
    id: "agr-4c",
    type: "custom",
    data: {
      label: "Irrigação • Precisão",
      efeito: "Bônus do Sistema de Irrigação: +15 → +17 por unidade.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 4,
    },
    position: { x: 0, y: 600 },
  },
  {
    id: "agr-4d",
    type: "custom",
    data: {
      label: "Logística • Rações Compactas",
      efeito: "Exploradores e Marines passam a consumir 1 comida/turno.",
      cienciaNecessaria: 8,
      grupo: "agricultura",
      nivel: 4,
    },
    position: { x: 220, y: 600 },
  },

  // DEFESA
  {
    id: "def-1",
    type: "custom",
    data: { label: "🛡️Defesa", grupo: "defesa", nivel: 1, isRoot: true },
    position: { x: 770, y: 0 },
  },
  {
    id: "def-2a",
    type: "custom",
    data: {
      label: "Colonos • Resistência I",
      efeito: "+2 HP para Colonos.",
      cienciaNecessaria: 6,
      grupo: "defesa",
      nivel: 2,
    },
    position: { x: 550, y: 200 },
  },
  {
    id: "def-2b",
    type: "custom",
    data: {
      label: "Marines • Treinamento I",
      efeito: "+1 HP e −10% cooldown para Marines.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 2,
    },
    position: { x: 770, y: 200 },
  },
  {
    id: "def-2c",
    type: "custom",
    data: {
      label: "Sniper • Doutrina de Precisão I",
      efeito: "Snipers: +1 alcance, +1 dano.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 2,
    },
    position: { x: 990, y: 200 },
  },

  {
    id: "def-3a",
    type: "custom",
    data: {
      label: "Muralha Reforçada • Robustez I",
      efeito: "+20% HP da Muralha Reforçada.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 3,
    },
    position: { x: 440, y: 400 },
  },
  {
    id: "def-3b",
    type: "custom",
    data: {
      label: "Matriz de Gravidade • Intensidade I",
      efeito: "+10% de lentidão sobre o valor base da Matriz.",
      cienciaNecessaria: 6,
      grupo: "defesa",
      nivel: 3,
    },
    position: { x: 660, y: 400 },
  },
  {
    id: "def-3c",
    type: "custom",
    data: {
      label: "Muralha • Contrafortes I",
      efeito: "+1 Integridade/turno (passivo).",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 3,
    },
    position: { x: 880, y: 400 },
  },
  {
    id: "def-3d",
    type: "custom",
    data: {
      label: "Tropas • Logística Hídrica I",
      efeito: "−50% 💧 custo de água das tropas.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 3,
    },
    position: { x: 1100, y: 400 },
  },

  {
    id: "def-4a",
    type: "custom",
    data: {
      label: "Colonos • Resistência II",
      efeito: "+3 HP para Colonos.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 4,
    },
    position: { x: 440, y: 600 },
  },
  {
    id: "def-4b",
    type: "custom",
    data: {
      label: "Marines • Treinamento II",
      efeito: "+2 HP e −15% cooldown para Marines.",
      cienciaNecessaria: 6,
      grupo: "defesa",
      nivel: 4,
    },
    position: { x: 660, y: 600 },
  },
  {
    id: "def-4c",
    type: "custom",
    data: {
      label: "Sniper • Doutrina de Precisão II",
      efeito: "Snipers: +1 alcance, +1 dano.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 4,
    },
    position: { x: 880, y: 600 },
  },
  {
    id: "def-4d",
    type: "custom",
    data: {
      label: "Muralha Reforçada • Robustez II",
      efeito: "+30% HP da Muralha Reforçada.",
      cienciaNecessaria: 10,
      grupo: "defesa",
      nivel: 4,
    },
    position: { x: 1100, y: 600 },
  },

  // MINERAÇÃO
  {
    id: "min-1",
    type: "custom",
    data: { label: "⛏️Mineração", grupo: "mineracao", nivel: 1, isRoot: true },
    position: { x: 1660, y: 0 },
  },
  {
    id: "min-2a",
    type: "custom",
    data: {
      label: "Mina de Carvão • Eficiência I",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 6,
      grupo: "mineracao",
      nivel: 2,
    },
    position: { x: 1440, y: 200 },
  },
  {
    id: "min-2b",
    type: "custom",
    data: {
      label: "Mina Profunda • Perfuração I",
      efeito: "+8 🪨 minerais/turno por unidade de Mina Profunda.",
      cienciaNecessaria: 12,
      grupo: "mineracao",
      nivel: 2,
    },
    position: { x: 1660, y: 200 },
  },
  {
    id: "min-2c",
    type: "custom",
    data: {
      label: "Corpo Minerador • Treinamento I",
      efeito: "Cada colono concede +1 🪨 minerais/turno à colônia.",
      cienciaNecessaria: 12,
      grupo: "mineracao",
      nivel: 2,
    },
    position: { x: 1880, y: 200 },
  },

  {
    id: "min-3a",
    type: "custom",
    data: {
      label: "Geo Solar • Perfuração I",
      efeito:
        "+6 🪨 minerais/turno, +2 ⚡ energia/turno por unidade de Geo Solar.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 3,
    },
    position: { x: 1320, y: 400 },
  },
  {
    id: "min-3b",
    type: "custom",
    data: {
      label: "Mina de Carvão • Eficiência II",
      efeito: "+6 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 6,
      grupo: "mineracao",
      nivel: 3,
    },
    position: { x: 1540, y: 400 },
  },
  {
    id: "min-3c",
    type: "custom",
    data: {
      label: "Mina Profunda • Perfuração II",
      efeito: "+16 🪨 minerais/turno por unidade de Mina Profunda.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 3,
    },
    position: { x: 1760, y: 400 },
  },
  {
    id: "min-3d",
    type: "custom",
    data: {
      label: "Corpo Minerador • Treinamento II",
      efeito: "Cada colono concede +2 🪨 minerais/turno à colônia.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 3,
    },
    position: { x: 1980, y: 400 },
  },

  {
    id: "min-4a",
    type: "custom",
    data: {
      label: "Geo Solar • Perfuração II",
      efeito:
        "+6 🪨 minerais/turno, +2 ⚡ energia/turno por unidade de Geo Solar.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 4,
    },
    position: { x: 1320, y: 600 },
  },
  {
    id: "min-4b",
    type: "custom",
    data: {
      label: "Mina de Carvão • Eficiência III",
      efeito: "+12 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 6,
      grupo: "mineracao",
      nivel: 4,
    },
    position: { x: 1540, y: 600 },
  },
  {
    id: "min-4c",
    type: "custom",
    data: {
      label: "Mina Profunda • Perfuração III",
      efeito: "+32 🪨 minerais/turno por unidade de Mina Profunda.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 4,
    },
    position: { x: 1760, y: 600 },
  },
  {
    id: "min-4d",
    type: "custom",
    data: {
      label: "Corpo Minerador • Treinamento III",
      efeito: "Cada colono concede +3 🪨 minerais/turno à colônia.",
      cienciaNecessaria: 10,
      grupo: "mineracao",
      nivel: 4,
    },
    position: { x: 1980, y: 600 },
  },

  // LABORATÓRIO
  {
    id: "lab-1",
    type: "custom",
    data: {
      label: "🧪Laboratório",
      grupo: "laboratorio",
      nivel: 1,
      isRoot: true,
    },
    position: { x: 5000, y: 0 },
  },
  {
    id: "lab-2a",
    type: "custom",
    data: {
      label: "Método Experimental +1",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 8,
      grupo: "laboratorio",
      nivel: 2,
    },
    position: { x: 5000, y: 200 },
  },
  {
    id: "lab-2b",
    type: "custom",
    data: {
      label: "Análise de Dados +1",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 12,
      grupo: "laboratorio",
      nivel: 2,
    },
    position: { x: 5300, y: 200 },
  },

  // SAÚDE
  {
    id: "sau-1",
    type: "custom",
    data: { label: "🏥Saúde", grupo: "saude", nivel: 1, isRoot: true },
    position: { x: 2540, y: 0 },
  },
  {
    id: "sau-2a",
    type: "custom",
    data: {
      label: "Triagem Rápida +1",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 6,
      grupo: "saude",
      nivel: 2,
    },
    position: { x: 2320, y: 200 },
  },
  {
    id: "sau-2b",
    type: "custom",
    data: {
      label: "Medicinas Sintéticas +1",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 10,
      grupo: "saude",
      nivel: 2,
    },
    position: { x: 2540, y: 200 },
  },
  {
    id: "sau-2c",
    type: "custom",
    data: {
      label: "Medicinas Sintéticas +1",
      efeito: "+3 🪨 minerais/turno por unidade de Mina de Carvão.",
      cienciaNecessaria: 10,
      grupo: "saude",
      nivel: 2,
    },
    position: { x: 2760, y: 200 },
  },

  // ENERGIA
  {
    id: "ene-1",
    type: "custom",
    data: { label: "⚡Energia", grupo: "energia", nivel: 1, isRoot: true },
    position: { x: 3300, y: 0 },
  },
  {
    id: "ene-2a",
    type: "custom",
    data: {
      label: "Captação Solar +1",
      cienciaNecessaria: 6,
      grupo: "energia",
      nivel: 2,
    },
    position: { x: 3080, y: 200 },
  },
  {
    id: "ene-2b",
    type: "custom",
    data: {
      label: "Turbinas Eficientes +1",
      cienciaNecessaria: 12,
      grupo: "energia",
      nivel: 2,
    },
    position: { x: 3300, y: 200 },
  },

  // ÁGUA
  {
    id: "agu-1",
    type: "custom",
    data: { label: "💧Água", grupo: "agua", nivel: 1, isRoot: true },
    position: { x: 3960, y: 0 },
  },
  {
    id: "agu-2a",
    type: "custom",
    data: {
      label: "Tratamento Básico +1",
      cienciaNecessaria: 6,
      grupo: "agua",
      nivel: 2,
    },
    position: { x: 3740, y: 200 },
  },
  {
    id: "agu-2b",
    type: "custom",
    data: {
      label: "Coleta Atmosférica +1",
      cienciaNecessaria: 12,
      grupo: "agua",
      nivel: 2,
    },
    position: { x: 3960, y: 200 },
  },
];

// fora do componente (NÃO use hooks aqui)
const initialNodeInfo = (() => {
  const byId = new Map();
  const rootIds = [];
  for (const n of initialNodes) {
    const grupo = n.data?.grupo || null;
    const isRoot = !!n.data?.isRoot;
    byId.set(n.id, { grupo, isRoot });
    if (isRoot) rootIds.push(n.id);
  }
  return { byId, rootIds };
})();

export default function EvolutionTree({
  initialEdges = [],
  estadoAtual,
  onGastarCiencia,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [conexaoPendente, setConexaoPendente] = useState(null);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null); // null = TODOS
  const [rfInstance, setRfInstance] = useState(null); // para fitView programático

  // 👇 Ciência mostrada no painel
  const [cienciaAtual, setCienciaAtual] = useState(estadoAtual.ciencia);
  useEffect(() => setCienciaAtual(estadoAtual.ciencia), [estadoAtual.ciencia]);

  // Mapa rápido id->node
  const nodesMap = useMemo(() => {
    const m = new Map();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  // Hidrata edges do backend e ignora conexões inválidas (entre grupos diferentes ou nós inexistentes)
  useEffect(() => {
    const saved = Array.isArray(estadoAtual.pesquisa)
      ? estadoAtual.pesquisa
      : [];
    const seen = new Set();
    const sane = saved
      .map((e) => {
        const s = initialNodeInfo.byId.get(e.source);
        const t = initialNodeInfo.byId.get(e.target);
        if (!s || !t) return null;
        if (s.grupo !== t.grupo) return null;
        const id = edgeIdOf(e.source, e.target);
        if (seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          source: e.source,
          target: e.target,
          type: "custom",
          sourceHandle: e.sourceHandle || "output",
          targetHandle: e.targetHandle || "input",
        };
      })
      .filter(Boolean);

    setEdges((prev) => {
      // compara por id para evitar re-render desnecessário
      const a = [...prev].map((e) => e.id).sort();
      const b = [...sane].map((e) => e.id).sort();
      const same = a.length === b.length && a.every((id, i) => id === b[i]);
      return same ? prev : sane;
    });
  }, [estadoAtual.pesquisa, setEdges]);

  // Filtro de nodes/edges por grupo selecionado
  const visibleNodes = useMemo(() => {
    if (!activeGroup) return nodes;
    return nodes.filter((n) => n.data?.grupo === activeGroup);
  }, [nodes, activeGroup]);

  const visibleEdges = useMemo(() => {
    if (!activeGroup) return edges;
    const setIds = new Set(visibleNodes.map((n) => n.id));
    return edges.filter((e) => setIds.has(e.source) && setIds.has(e.target));
  }, [edges, activeGroup, visibleNodes]);

  // Para lógica de alcançáveis, usa as arestas “visíveis” (respeita filtro)
  const rootIdsAll = initialNodeInfo.rootIds;
  const rootIdsVisible = useMemo(() => {
    if (!activeGroup) return rootIdsAll;
    return visibleNodes.filter((n) => n.data?.isRoot).map((n) => n.id);
  }, [activeGroup, visibleNodes, rootIdsAll]);

  const reachable = useMemo(() => {
    const adj = {};
    (activeGroup ? visibleEdges : edges).forEach((e) => {
      (adj[e.source] = adj[e.source] || []).push(e.target);
    });

    const vis = new Set(rootIdsVisible);
    const q = [...rootIdsVisible];
    while (q.length) {
      const u = q.shift();
      (adj[u] || []).forEach((v) => {
        if (!vis.has(v)) {
          vis.add(v);
          q.push(v);
        }
      });
    }
    return vis;
  }, [edges, visibleEdges, rootIdsVisible, activeGroup]);

  // sinaliza inativos (não alcançáveis a partir do seu início de grupo)
  useEffect(() => {
    let changed = false;
    setNodes((nds) => {
      const visibleIdSet = new Set(visibleNodes.map((n) => n.id));
      const next = nds.map((n) => {
        // se filtrado, só marcamos inatividade entre os visíveis
        const inScope = !activeGroup || visibleIdSet.has(n.id);
        const shouldBeInactive =
          inScope && !n.data?.isRoot ? !reachable.has(n.id) : n.data?.inactive;
        if (inScope && n.data?.inactive !== shouldBeInactive) {
          changed = true;
          return { ...n, data: { ...n.data, inactive: shouldBeInactive } };
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [reachable, setNodes, visibleNodes, activeGroup]);

  // Utilitário local — evita fechar sobre “edges” antigo
  const listHasEdge = useCallback(
    (list, src, tgt) => list.some((e) => e.id === edgeIdOf(src, tgt)),
    []
  );

  const onConnect = useCallback(
    async (params) => {
      const sourceNode = nodesMap.get(params.source);
      const targetNode = nodesMap.get(params.target);
      if (!sourceNode || !targetNode) return;

      const g1 = sourceNode.data?.grupo;
      const g2 = targetNode.data?.grupo;
      const nivelSource = sourceNode.data?.nivel || 0;
      const nivelTarget = targetNode.data?.nivel || 0;
      const cienciaRequerida = targetNode.data?.cienciaNecessaria || 0;

      // 🔒 grupos diferentes: proibido
      if (g1 !== g2) {
        alert("Você não pode conectar árvores de grupos diferentes.");
        return;
      }
      // 🔒 não conectar para um nó de início
      if (targetNode.data?.isRoot) {
        alert("Você não pode conectar para o nó inicial do grupo.");
        return;
      }
      // 🔒 regra de nível: só próximo nível
      if (nivelTarget !== nivelSource + 1) {
        alert("Você só pode conectar com o próximo nível daquele grupo.");
        return;
      }
      // 🔒 origem precisa estar desbloqueada
      const origemDesbloqueada =
        sourceNode.data?.isRoot || reachable.has(sourceNode.id);
      if (!origemDesbloqueada) {
        alert("Esse nó de origem ainda não está desbloqueado.");
        return;
      }
      // 🔒 1 entrada no target, 1 saída no source
      const hasInput = edges.some((e) => e.target === targetNode.id);
      const hasOutput = edges.some((e) => e.source === sourceNode.id);
      if (hasInput) {
        alert("Esse nó já tem uma entrada.");
        return;
      }
      if (hasOutput) {
        alert("Esse nó já tem uma saída.");
        return;
      }

      // 🔒 duplicado (checa já no estado atual)
      if (edges.some((e) => e.id === edgeIdOf(sourceNode.id, targetNode.id))) {
        return;
      }

      // 💡 ciência
      if (cienciaAtual < cienciaRequerida) {
        alert(`Você precisa de ${cienciaRequerida} de ciência.`);
        return;
      }

      const newEdge = {
        ...params,
        id: edgeIdOf(params.source, params.target),
        type: "custom",
        sourceHandle: params.sourceHandle ?? "output",
        targetHandle: params.targetHandle ?? "input",
      };

      setConexaoPendente({
        edge: newEdge,
        ciencia: cienciaRequerida,
        grupo: g1,
      });
      setMostrarConfirmacao(true);
    },
    [edges, nodesMap, reachable, cienciaAtual]
  );

  // fitView quando trocar o filtro
  useEffect(() => {
    if (!rfInstance) return;
    const nodesToFit = activeGroup ? visibleNodes : nodes;
    if (!nodesToFit.length) return;
    // dica: se sua versão suportar fitView({ nodes }), ótimo; senão, remover a chave
    rfInstance.fitView({
      nodes: nodesToFit,
      padding: 0.5, // mais “folga” = menos zoom
      maxZoom: 0.9, // não deixa aproximar demais
      duration: 300, // animação suave (opcional)
    });
  }, [activeGroup, visibleNodes, nodes, rfInstance]);

  return (
    <div className="w-full h-[800px] bg-gray-900 rounded-lg shadow p-2">
      {mostrarConfirmacao && conexaoPendente && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50">
          <p>
            Gastar {conexaoPendente.ciencia} de ciência para desbloquear este
            upgrade do grupo <b>{conexaoPendente.grupo}</b>?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded"
              onClick={async () => {
                const e = conexaoPendente.edge;
                const sucesso = await onGastarCiencia(conexaoPendente.ciencia, {
                  id: e.id, // já canônico
                  source: e.source,
                  target: e.target,
                  label: `${e.source}->${e.target}`,
                  type: "custom",
                });
                if (sucesso)
                  setEdges((eds) =>
                    listHasEdge(eds, e.source, e.target) ? eds : [...eds, e]
                  );
                setMostrarConfirmacao(false);
                setConexaoPendente(null);
              }}
            >
              Confirmar
            </button>
            <button
              className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
              onClick={() => {
                setMostrarConfirmacao(false);
                setConexaoPendente(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={visibleNodes}
        edges={activeGroup ? visibleEdges : edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={setRfInstance}
        fitView
        fitViewOptions={{ padding: 0.5, maxZoom: 0.9 }}
        /* 🔎 Zoom */
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.5}
        maxZoom={2}
        /* 🖐️ Pan */
        panOnDrag
        panOnScroll
        panOnScrollMode="free"
        /* 🎯 Interação */
        nodesDraggable={false}
        selectionOnDrag={false}
      >
        <Background color="#444" gap={16} />
        <Controls />

        {/* Painel ciência */}
        <Panel
          position="top-left"
          className="text-white text-sm bg-gray-800 p-2 rounded shadow"
        >
          🧪 Ciência: {cienciaAtual}
        </Panel>

        {/* Painel filtro por grupo */}
        <Panel
          position="top-right"
          className="bg-gray-800/90 p-2 rounded-lg shadow space-y-2"
        >
          <div className="text-white text-xs font-semibold tracking-wide opacity-80">
            FILTRAR GRUPO
          </div>
          <div className="flex flex-wrap gap-2 max-w-[420px]">
            <button
              onClick={() => setActiveGroup(null)}
              className={`px-3 py-1 rounded text-sm font-medium border ${
                activeGroup === null
                  ? "bg-white text-black"
                  : "bg-gray-900 text-white border-gray-700 hover:bg-gray-700"
              }`}
            >
              TODOS
            </button>
            {GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`px-3 py-1 rounded text-sm font-medium border`}
                style={{
                  background: activeGroup === g.id ? "#ffffff" : "#0b1220",
                  color: activeGroup === g.id ? "#000000" : "#ffffff",
                  borderColor: groupColors[g.id] || "#3b82f6",
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </Panel>

        <MiniMap
          style={{ background: "#1f2937" }}
          nodeColor={(n) => {
            const c = groupColors[n.data?.grupo] || "#3b82f6";
            return c;
          }}
          edgeColor="#3b82f6"
        />
      </ReactFlow>
    </div>
  );
}
