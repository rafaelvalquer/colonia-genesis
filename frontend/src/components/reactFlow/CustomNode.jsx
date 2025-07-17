// src/components/reactFlow/CustomNode.jsx
import React, { memo, useState } from "react";
import { Handle, Position, getBezierPath, NodeToolbar } from "@xyflow/react";

export const CustomNode = memo(({ id, data }) => {
  const isInicio = id === "1";
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={`relative transition-opacity duration-300 ${
        data.inactive ? "opacity-40" : "opacity-100"
      }`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* === TOOLTIP (somente se não for nó inicial) === */}
      {!isInicio && (
        <NodeToolbar isVisible={showTooltip} position={Position.Top}>
          {typeof data.cienciaNecessaria === "number" ? (
            <div className="bg-white text-black text-sm px-3 py-1 rounded shadow border border-blue-500">
              🔬 Ciência necessária: {data.cienciaNecessaria}
            </div>
          ) : (
            <div className="bg-white text-black text-sm px-3 py-1 rounded shadow border border-gray-400">
              Nenhuma ciência necessária
            </div>
          )}
        </NodeToolbar>
      )}

      {/* === ESTILO DO NÓ === */}
      {isInicio ? (
        <div className="rounded-lg border-2 border-blue-400 bg-gradient-to-r from-blue-700 to-blue-900 w-44 text-white shadow-md">
          <div className="text-center text-sm py-4 px-2 font-bold uppercase tracking-wide">
            {data.label}
          </div>
          <Handle
            type="source"
            id="output"
            position={Position.Right}
            style={{
              background: "#60a5fa",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
            }}
          />
        </div>
      ) : (
        <div className="rounded-lg border-2 border-blue-700 bg-blue-950 w-44 text-white shadow-md">
          {/* Cabeçalho com ciência */}
          <div className="bg-blue-800 text-xs font-semibold px-2 py-1 rounded-t-lg text-left">
            🔬 Ciência: {data.cienciaNecessaria ?? 0}
          </div>

          {/* Label central */}
          <div className="text-center text-sm py-3 px-2 font-medium">
            {data.label}
          </div>

          {/* Handle de entrada */}
          <Handle
            type="target"
            id="input" // ✅ obrigatório para múltiplas conexões
            position={Position.Left}
            style={{
              background: "#3b82f6",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
            }}
          />

          {/* Handle de saída: sempre presente */}
          <Handle
            type="source"
            id="output" // ✅ obrigatório para múltiplas conexões
            position={Position.Right}
            style={{
              background: "#3b82f6",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
            }}
          />
        </div>
      )}
    </div>
  );
});

// === ARESTA PERSONALIZADA COM GRADIENTE E ANIMAÇÃO ===
export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const gradientId = `edge-gradient-${id}`;
  const maskId = `dash-mask-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2a8af6" />
          <stop offset="50%" stopColor="#a853ba" />
          <stop offset="100%" stopColor="#e92a67" />
        </linearGradient>

        <mask id={maskId}>
          <path
            d={edgePath}
            stroke="#fff"
            strokeWidth={2}
            strokeDasharray="6 4"
            strokeDashoffset="0"
            fill="none"
          >
            <animate
              attributeName="stroke-dashoffset"
              values="0;-10"
              dur="1.2s"
              repeatCount="indefinite"
            />
          </path>
        </mask>
      </defs>

      <path
        id={id}
        d={edgePath}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        fill="none"
        mask={`url(#${maskId})`}
        markerEnd={markerEnd}
      />
    </>
  );
};
