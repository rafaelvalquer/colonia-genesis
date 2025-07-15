// src/components/reactFlow/CustomNode.jsx
import React, { memo } from "react";
import { Handle, Position, getBezierPath } from "@xyflow/react";

// === NÓ PERSONALIZADO ===
export const CustomNode = memo(({ id, data }) => {
  const isInicio = id === "1";

  return (
    <div className="bg-white rounded-lg shadow-lg p-3 w-40 text-center border-2 border-blue-500 hover:scale-105 transition-transform duration-200 relative">
      <div className="text-blue-600 font-bold text-sm">{data.label}</div>

      {/* ✅ Informação da ciência necessária (se existir) */}
      {typeof data.cienciaNecessaria === "number" && (
        <div className="text-gray-600 text-xs mt-1">
          🔬 Ciência necessária: {data.cienciaNecessaria}
        </div>
      )}

      {/* Handle de entrada (exceto para o nó inicial) */}
      {!isInicio && (
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
      )}

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
