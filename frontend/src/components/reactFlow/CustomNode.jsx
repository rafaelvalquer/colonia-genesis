// src/components/reactFlow/CustomNode.jsx
import React, { memo, useState } from "react";
import { Handle, Position, getBezierPath, NodeToolbar } from "@xyflow/react";

const groupColors = {
  agricultura: "#22c55e",
  defesa: "#f59e0b",
  mineracao: "#eab308",
  laboratorio: "#7c3aed",
  saude: "#ef4444",
  energia: "#f97316",
  agua: "#38bdf8",
  default: "#3b82f6",
};

export const CustomNode = memo(({ id, data }) => {
  const isInicio = data?.isRoot === true;
  const [showTooltip, setShowTooltip] = useState(false);
  const color = groupColors[data?.grupo] || groupColors.default;

  return (
    <div
      className={`relative transition-opacity duration-300 ${
        data?.inactive ? "opacity-40" : "opacity-100"
      }`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* === TOOLTIP (somente se não for nó inicial) === */}
      {!isInicio && (
        <NodeToolbar
          isVisible={showTooltip}
          position={Position.Top}
          className="z-[1000]"
        >
          <div
            className="relative max-w-[340px] rounded-lg shadow-xl border overflow-hidden"
            style={{ borderColor: color, background: "#ffffff" }}
          >
            {/* Cabeçalho colorido */}
            <div
              className="px-3 py-2 text-white text-xs font-bold tracking-wide uppercase"
              style={{ backgroundColor: color }}
            >
              {data.grupo?.toUpperCase() || "UPGRADE"}
            </div>

            {/* Conteúdo */}
            <div className="p-3 space-y-2 text-black">
              {/* Custo de ciência */}
              {typeof data.cienciaNecessaria === "number" ? (
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-sm"
                    style={{
                      color,
                      borderColor: color,
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    🔬 Ciência: <b>{data.cienciaNecessaria}</b>
                  </span>
                </div>
              ) : (
                <div className="text-sm px-2 py-1 rounded border border-gray-300 bg-gray-50 text-gray-700">
                  Sem custo de ciência
                </div>
              )}

              {/* Efeito */}
              {data.efeito ? (
                <div className="text-sm">
                  <div className="font-semibold mb-1 flex items-center gap-2">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    Efeito
                  </div>
                  <div className="leading-snug text-gray-800">
                    {data.efeito}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Sem efeito descrito
                </div>
              )}
            </div>

            {/* “Setinha” do tooltip */}
            <div
              className="absolute left-1/2 -bottom-2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white"
              style={{
                borderRight: `1px solid ${color}`,
                borderBottom: `1px solid ${color}`,
              }}
            />
          </div>
        </NodeToolbar>
      )}

      {/* === ESTILO DO NÓ === */}
      {isInicio ? (
        <div
          className="rounded-lg border-2 w-48 text-white shadow-md"
          style={{
            borderColor: color,
            background:
              "linear-gradient(90deg, rgba(0,0,0,.2), rgba(0,0,0,.4))",
          }}
        >
          <div className="text-center text-sm py-4 px-2 font-bold uppercase tracking-wide">
            {data.label}
          </div>
          <Handle
            type="source"
            id="output"
            position={Position.Bottom}
            style={{
              background: color,
              width: 10,
              height: 10,
              borderRadius: 9999,
            }}
          />
        </div>
      ) : (
        <div
          className="rounded-lg border-2 w-48 text-white shadow-md"
          style={{ borderColor: color, backgroundColor: "#0b1220" }}
        >
          <div
            className="text-xs font-semibold px-2 py-1 rounded-t-lg text-left"
            style={{ backgroundColor: color }}
          >
            {data.grupo?.toUpperCase() || "UPGRADE"} • 🔬{" "}
            {data.cienciaNecessaria ?? 0}
          </div>

          {/* Label central */}
          <div className="text-center text-sm py-3 px-2 font-medium">
            {data.label}
          </div>

          <Handle
            type="target"
            id="input"
            position={Position.Top}
            style={{
              background: color,
              width: 10,
              height: 10,
              borderRadius: 9999,
            }}
          />

          {/* SOURCE: Bottom */}
          <Handle
            type="source"
            id="output"
            position={Position.Bottom}
            style={{
              background: color,
              width: 10,
              height: 10,
              borderRadius: 9999,
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
