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
    data: { label: "🌱 Início" },
    position: { x: 100, y: 100 },
  },
  {
    id: "2",
    type: "custom",
    data: { label: "💪 Força +1", cienciaNecessaria: 5 },
    position: { x: 300, y: 50 },
  },
  {
    id: "3",
    type: "custom",
    data: { label: "🧠 Inteligência +1", cienciaNecessaria: 10 },
    position: { x: 300, y: 150 },
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

  // 👇 Estado local para controlar a ciência disponível
  const [cienciaAtual, setCienciaAtual] = useState(estadoAtual.ciencia);

  // 🔄 Atualiza caso o `estadoAtual.ciencia` mude externamente
  useEffect(() => {
    setCienciaAtual(estadoAtual.ciencia);
  }, [estadoAtual.ciencia]);

  const onConnect = useCallback(
    (params) => {
      const targetNode = nodes.find((n) => n.id === params.target);
      const cienciaRequerida = targetNode?.data?.cienciaNecessaria || 0;

      if (cienciaAtual < cienciaRequerida) {
        alert(
          `Você precisa de ${cienciaRequerida} de ciência para desbloquear este ponto.`
        );
        return;
      }

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

      // ✅ Chama o callback para gastar ciência
      const sucesso = onGastarCiencia(cienciaRequerida);
      if (!sucesso) return;

      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        type: "custom",
        sourceHandle: params.sourceHandle ?? "output",
        targetHandle: params.targetHandle ?? "input",
      };

      setEdges((eds) => [...eds, newEdge]);
    },
    [nodes, edges, estadoAtual.ciencia, onGastarCiencia]
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

  return (
    <div className="w-full h-[500px] bg-gray-900 rounded-lg shadow p-2">
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
          🧠 Inteligência: {cienciaAtual}
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
