import React, { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import { CustomNode, CustomEdge } from "./CustomNode";

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

const initialNodes = [
  {
    id: "1",
    type: "custom",
    data: { label: "🌱 Início", nivel: 1 },
    position: { x: -100, y: 100 },
  },
  {
    id: "2",
    type: "custom",
    data: { label: "💪 Força +1", cienciaNecessaria: 5, nivel: 2 },
    position: { x: 300, y: 0 },
  },
  {
    id: "3",
    type: "custom",
    data: { label: "🧠 Inteligência +1", cienciaNecessaria: 10, nivel: 2 },
    position: { x: 300, y: 200 },
  },
  {
    id: "4",
    type: "custom",
    data: { label: "🧠 Agua +1", cienciaNecessaria: 15, nivel: 3 },
    position: { x: 700, y: 100 },
  },
];

//const initialEdges = []; // sem conexões iniciais

export default function EvolutionTree({
  initialEdges = [],
  estadoAtual,
  onGastarCiencia,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [conexaoPendente, setConexaoPendente] = useState(null);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  // 👇 Estado local para controlar a ciência disponível
  const [cienciaAtual, setCienciaAtual] = useState(estadoAtual.ciencia);

  // 🔄 Atualiza caso o `estadoAtual.ciencia` mude externamente
  useEffect(() => {
    setCienciaAtual(estadoAtual.ciencia);
  }, [estadoAtual.ciencia]);

  const onConnect = useCallback(
    async (params) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);

      const nivelSource = sourceNode?.data?.nivel || 0;
      const nivelTarget = targetNode?.data?.nivel || 0;

      const cienciaRequerida = targetNode?.data?.cienciaNecessaria || 0;

      // Bloqueia conexões entre o mesmo nível
      if (nivelSource === nivelTarget) {
        alert("Você não pode conectar dois pontos do mesmo nível.");
        return;
      }

      // Bloqueia conexões que pulam níveis
      if (nivelTarget !== nivelSource + 1) {
        alert("Você só pode conectar com o próximo nível.");
        return;
      }

      // Verifica se o sourceNode já foi desbloqueado (tem uma entrada)
      const sourceHasEntrada =
        nivelSource === 1 || // se for o primeiro nível, é permitido
        edges.some((e) => e.target === sourceNode.id);

      if (!sourceHasEntrada) {
        alert(
          "Você não pode usar esse nó como origem porque ele ainda não foi desbloqueado."
        );
        return;
      }

      // Verifica se o target já tem uma conexão de entrada
      const hasInput = edges.some((e) => e.target === params.target);
      const hasOutput = edges.some((e) => e.source === params.source);

      // Impede múltiplas entradas ou saídas
      if (hasInput) {
        alert("Esse nó já tem uma entrada.");
        return;
      }

      if (hasOutput) {
        alert("Esse nó já tem uma saída.");
        return;
      }

      // Verifica se tem ciência suficiente
      if (cienciaAtual < cienciaRequerida) {
        alert(
          `Você precisa de ${cienciaRequerida} de ciência para desbloquear este ponto.`
        );
        return;
      }

      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        type: "custom",
        sourceHandle: params.sourceHandle ?? "output",
        targetHandle: params.targetHandle ?? "input",
      };

      setConexaoPendente({ edge: newEdge, ciencia: cienciaRequerida });
      setMostrarConfirmacao(true);
    },
    [nodes, edges, cienciaAtual, onGastarCiencia]
  );

  useEffect(() => {
    const zoomLevel = 1;
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        position: {
          x: node.position.x * zoomLevel,
          y: node.position.y * zoomLevel,
        },
      }))
    );
  }, [setNodes]);

  useEffect(() => {
    setNodes((nds) => {
      const connectedNodeIds = new Set();
      edges.forEach((edge) => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });

      return nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          inactive: !connectedNodeIds.has(node.id) && node.id !== "1", // não aplica no início
        },
      }));
    });
  }, [edges, setNodes]);

  return (
    <div className="w-full h-[500px] bg-gray-900 rounded-lg shadow p-2">
      {mostrarConfirmacao && conexaoPendente && (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white p-4 rounded-lg shadow-lg z-50">
          <p>
            Deseja desbloquear este nó gastando {conexaoPendente.ciencia} de
            ciência?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded"
              onClick={async () => {
                const sucesso = await onGastarCiencia(
                  conexaoPendente.ciencia,
                  conexaoPendente.edge
                );
                if (sucesso) {
                  setEdges((eds) => [...eds, conexaoPendente.edge]);
                }
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
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnDrag={false}
        panOnScroll={false}
        minZoom={1}
        maxZoom={1}
      >
        <Background color="#444" gap={16} />
        <Controls />
        {/* ✅ Mostra a inteligência no canto superior esquerdo */}
        <Panel
          position="top-left"
          className="text-white text-sm bg-gray-800 p-2 rounded shadow"
        >
          🧠 Ciência: {cienciaAtual}
        </Panel>
        <MiniMap
          style={{ background: "#1f2937" }}
          nodeColor={() => "#3b82f6"}
          edgeColor="#3b82f6"
        />
      </ReactFlow>
    </div>
  );
}
