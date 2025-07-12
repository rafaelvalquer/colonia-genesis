// EvolutionTree.jsx
import React, { useCallback, useEffect, memo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

// ✅ Nó personalizado com Tailwind
const CustomNode = memo(({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-3 w-40 text-center border-2 border-blue-500 hover:scale-105 transition-transform duration-200">
      <div className="text-blue-600 font-bold text-sm">{data.label}</div>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#3b82f6" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#3b82f6" }}
      />
    </div>
  );
});

// ✅ Registrar o tipo do nó
const nodeTypes = {
  custom: CustomNode,
};

// ✅ Nós e arestas
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
    position: { x: 300, y: 200 },
  },
  {
    id: "3",
    type: "custom",
    data: { label: "🧠 Inteligência +1" },
    position: { x: 600, y: 200 },
  },
];

const initialEdges = [
  { id: "e1-2", source: "1", target: "2", label: "" },
  { id: "e1-3", source: "1", target: "3", label: "" },
];

export default function EvolutionTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Define o zoom fixo
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
