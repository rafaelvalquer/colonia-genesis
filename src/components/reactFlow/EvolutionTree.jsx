// EvolutionTree.jsx
import React, { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
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
    data: { label: "💪 Força +1" },
    position: { x: 300, y: 50 },
  },
  {
    id: "3",
    type: "custom",
    data: { label: "🧠 Inteligência +1" },
    position: { x: 300, y: 150 },
  },
];

const initialEdges = []; // sem conexões iniciais

export default function EvolutionTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Apenas adiciona uma nova aresta ao conectar, sem criar nó
const onConnect = useCallback(
  (params) => {
    setEdges((eds) => {
      const hasInput = eds.some((e) => e.target === params.target);
      const hasOutput = eds.some((e) => e.source === params.source);

      // Impede múltiplas entradas ou saídas
      if (hasInput) {
        alert("Esse nó já tem uma entrada.");
        return eds;
      }
      if (hasOutput) {
        alert("Esse nó já tem uma saída.");
        return eds;
      }

      const newEdge = {
        ...params,
        id: `e${params.source}-${params.target}-${Date.now()}`,
        type: "custom",
        sourceHandle: params.sourceHandle ?? "output",
        targetHandle: params.targetHandle ?? "input",
      };

      return [...eds, newEdge];
    });
  },
  [setEdges]
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
        <MiniMap
          style={{ background: "#1f2937" }}
          nodeColor={() => "#3b82f6"}
          edgeColor="#3b82f6"
        />
      </ReactFlow>
    </div>
  );
}