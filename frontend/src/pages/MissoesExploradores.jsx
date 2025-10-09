import React, { useEffect, useMemo, useState } from "react";
import coloniaService from "../services/coloniaService"; // ajuste o caminho se necessário

const COLOR_HEX = {
  "text-red-400": "#f87171",
  "text-yellow-400": "#fbbf24",
  "text-green-400": "#34d399",
  "text-blue-400": "#60a5fa",
  "text-purple-400": "#a78bfa",
  "text-amber-400": "#f59e0b",
  "text-emerald-400": "#34d399",
  "text-lime-400": "#a3e635",
};

/** Utils (sem hooks aqui) */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pct = (cur, max) =>
  max > 0 ? clamp(Math.round((cur / max) * 100), 0, 100) : 0;

const STATUS_META = {
  disponivel: {
    dot: "bg-green-500",
    text: "text-green-400",
    label: "Disponível",
  },
  emMissao: {
    dot: "bg-orange-500",
    text: "text-orange-400",
    label: "Em Missão",
    pulse: true,
  },
  ferido: { dot: "bg-red-500", text: "text-red-400", label: "Ferido" },
  descansando: {
    dot: "bg-blue-500",
    text: "text-blue-400",
    label: "Descansando",
  },
};

const SKILL_ORDER = [
  ["visao", "text-red-400", "bg-red-900"],
  ["agilidade", "text-blue-400", "bg-blue-900"],
  ["folego", "text-purple-400", "bg-purple-900"],
  ["furtividade", "text-amber-400", "bg-amber-900"],
  ["resiliencia", "text-emerald-400", "bg-emerald-900"],
];

/** Subcomponentes sem hooks */
function StatBar({ label, color, current, max }) {
  const percent = pct(current, max);
  const hex = COLOR_HEX[color] || "#22c55e"; // fallback verde
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm" style={{ color: hex }}>
          {label}
        </span>
        <span className="text-sm">
          {current}/{max}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: hex,
            transition: "width .4s ease",
          }}
        />
      </div>
    </div>
  );
}

function XPBar({ xp, xpNext }) {
  const percent = pct(xp, xpNext || 1); // garante divisor > 0
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-green-400">XP</span>
        <span className="text-sm">{percent}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: "#22c55e",
            transition: "width .4s ease",
          }}
        />
      </div>
    </div>
  );
}

function EquipmentSlot({ label, value }) {
  return (
    <div className="equipment-slot bg-gray-700 border-2 border-dashed border-gray-600 rounded-md w-20 h-20 flex items-center justify-center relative hover:border-blue-500 hover:bg-blue-500/10 transition">
      {value ? (
        <span className="text-xs text-gray-200 text-center px-1">{value}</span>
      ) : (
        <span className="text-gray-500 text-xs">{label}</span>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.disponivel;
  return (
    <div className="flex items-center gap-2 mt-1">
      <span
        className={`w-2 h-2 rounded-full ${meta.dot} ${
          meta.pulse ? "animate-pulse" : ""
        }`}
      />
      <span className={`text-sm ${meta.text}`}>{meta.label}</span>
    </div>
  );
}

/** Componente principal — TODOS OS HOOKS FICAM AQUI DENTRO */
export default function MissoesExploradores({ estadoAtual, onSalvar }) {
  const initialExplorers = useMemo(
    () => (estadoAtual?.exploradores || []).map((e) => ({ ...e })),
    [estadoAtual?.exploradores]
  );
  console.log("!!!!!!!!!!!!!!" + JSON.stringify(estadoAtual.filaMissoes));
  const [explorers, setExplorers] = useState(initialExplorers);
  const [tab, setTab] = useState("all"); // all | available | mission
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // Mapa dos originais para detectar alterações (evita mudar updatedAt à toa)
  const originalById = useMemo(() => {
    const map = {};
    (initialExplorers || []).forEach((ex) => {
      map[ex.id] = ex;
    });
    return map;
  }, [initialExplorers]);

  useEffect(() => {
    setExplorers(initialExplorers);
  }, [initialExplorers]);

  const counts = useMemo(() => {
    const total = explorers.length;
    const available = explorers.filter((e) => e.status === "disponivel").length;
    const mission = explorers.filter((e) => e.status === "emMissao").length;
    return { total, available, mission };
  }, [explorers]);

  const filtered = useMemo(() => {
    if (tab === "available")
      return explorers.filter((e) => e.status === "disponivel");
    if (tab === "mission")
      return explorers.filter((e) => e.status === "emMissao");
    return explorers;
  }, [tab, explorers]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleNameChange = (id, name) => {
    setExplorers((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, name, nickname: name, updatedAt: Date.now() } : e
      )
    );
  };

  const handleRecall = (id) => {
    setExplorers((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: "disponivel",
              missionId: null,
              updatedAt: Date.now(),
            }
          : e
      )
    );
    showToast("Explorador retirado da missão!");
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const payloadExplorers = explorers.map((e) => ({
        ...e,
        updatedAt: Date.now(),
      }));

      if (typeof onSalvar === "function") {
        await onSalvar({ exploradores: payloadExplorers });
      } else {
        await coloniaService.atualizarColonia(estadoAtual._id, {
          exploradores: payloadExplorers,
        });
      }

      showToast("Alterações salvas com sucesso!");
    } catch (e) {
      console.error("Erro ao atualizar colônia no backend:", e);
      showToast("Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetStats = () => {
    setExplorers((prev) =>
      prev.map((e) => ({
        ...e,
        hp: e.hp ? { ...e.hp, current: e.hp.max } : e.hp,
        stamina: e.stamina
          ? { ...e.stamina, current: e.stamina.max }
          : e.stamina,
        updatedAt: Date.now(),
      }))
    );
    showToast("Stats resetadas!");
  };

  return (
    <div className="text-white">
      {/* Header */}
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Status dos Exploradores
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Gerencie e monitore o desenvolvimento de sua equipe de exploradores
        </p>
      </header>

      {/* Filtros e ações */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-2">
          <button
            className={`tab-button px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition ${
              tab === "all" ? "bg-blue-600 text-white" : ""
            }`}
            onClick={() => setTab("all")}
          >
            Todos ({counts.total})
          </button>
          <button
            className={`tab-button px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition ${
              tab === "available" ? "bg-blue-600 text-white" : ""
            }`}
            onClick={() => setTab("available")}
          >
            Disponíveis ({counts.available})
          </button>
          <button
            className={`tab-button px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition ${
              tab === "mission" ? "bg-blue-600 text-white" : ""
            }`}
            onClick={() => setTab("mission")}
          >
            Em Missão ({counts.mission})
          </button>
        </div>

        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 transition disabled:opacity-60"
            onClick={handleSaveAll}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
          <button
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
            onClick={handleResetStats}
          >
            Resetar Stats
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filtered.map((e) => {
          const hpCur = e.hp?.current ?? 0;
          const hpMax = e.hp?.max ?? 0;
          const stCur = e.stamina?.current ?? 0;
          const stMax = e.stamina?.max ?? 0;
          const xp = e.xp ?? 0;
          const xpNext = e.xpNext ?? 1;
          const portrait = e.portrait || "/images/explorador.png";
          const onMission = e.status === "emMissao";

          return (
            <div
              key={e.id}
              className="explorer-card bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 transition"
              data-status={onMission ? "mission" : "available"}
            >
              {/* Topo */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <img
                    src={portrait}
                    alt={e.name || e.id}
                    className={`w-16 h-16 rounded-full border-2 ${
                      onMission
                        ? "border-orange-500"
                        : e.status === "disponivel"
                        ? "border-green-500"
                        : "border-gray-500"
                    } object-cover`}
                    onError={(ev) => {
                      ev.currentTarget.src = "/images/exploradores/default.png";
                    }}
                  />
                  <div>
                    <input
                      type="text"
                      className="editable-name bg-transparent border-none text-xl font-bold w-full focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                      value={e.name || ""}
                      onChange={(ev) => handleNameChange(e.id, ev.target.value)}
                    />

                    {/* Mostra o nickname só se existir e for diferente do name */}
                    {e.nickname &&
                    e.nickname.trim() &&
                    e.nickname !== e.name ? (
                      <p className="text-gray-400">{e.nickname}</p>
                    ) : null}

                    <StatusBadge status={e.status} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-yellow-400">
                    Nível {e.level ?? 1}
                  </p>
                  <p className="text-sm text-gray-400">
                    {xp} / {xpNext} XP
                  </p>
                </div>
              </div>

              {/* Missão atual */}
              {onMission &&
                (() => {
                  console.log(estadoAtual.filaMissoes);
                  // pega a missão da fila vinculada a este explorador
                  const m = (estadoAtual?.filaMissoes || []).find(
                    (fm) => fm.explorerId === e.id && fm.status !== "concluida"
                  );

                  const total = Number.isFinite(m?.turnosTotais)
                    ? m.turnosTotais
                    : null;
                  const rest = Number.isFinite(m?.tempoRestante)
                    ? m.tempoRestante
                    : null;

                  // progresso seguro: 0..1
                  const progress =
                    total && rest != null ? (total - rest) / total : 0;
                  const pctInt =
                    total && rest != null ? Math.round(progress * 100) : null;

                  return (
                    <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4 mb-6">
                      <h3 className="text-lg font-semibold text-orange-400 mb-2">
                        Missão Atual
                      </h3>

                      <p className="text-sm">
                        {e.missionId
                          ? `Missão #${e.missionId}`
                          : "Em deslocamento..."}
                        {m?.nome ? ` — ${m.nome}` : null}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {total && rest != null
                            ? `Progresso: ${total - rest}/${total} turnos` // turnos concluídos
                            : "Coletando dados..."}
                        </span>

                        {/* Semáforo de 3 bolinhas com base no progresso (1/3, 2/3, 3/3) */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 3 }).map((_, i) => {
                            const frac = (i + 1) / 3;
                            const ativo = progress >= frac;
                            return (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition ${
                                  ativo ? "bg-orange-500" : "bg-gray-600"
                                }`}
                                title={pctInt != null ? `${pctInt}%` : ""}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatBar
                  label="HP"
                  color="text-red-400"
                  current={hpCur}
                  max={hpMax}
                />
                <StatBar
                  label="Energia"
                  color="text-yellow-400"
                  current={stCur}
                  max={stMax}
                />
                <XPBar xp={xp} xpNext={xpNext} />
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-blue-400">Resiliência</span>
                    <span className="text-sm">
                      {e.traits?.length || 0} traits
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${clamp(
                          (e.traits?.length || 0) * 10,
                          0,
                          100
                        )}%`,
                        transition: "width .4s ease",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Atributos */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Atributos</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {SKILL_ORDER.map(([key, txt, bg]) => {
                    const val = e.skills?.[key] ?? 0;
                    return (
                      <div className="text-center" key={key}>
                        <div
                          className={`rounded-full w-[60px] h-[60px] flex items-center justify-center font-bold ${bg} ${txt} mx-auto mb-2`}
                        >
                          {val}
                        </div>
                        <p className="text-xs text-gray-400 capitalize">
                          {key}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Equipamentos */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Equipamentos</h3>
                <div className="grid grid-cols-4 gap-2">
                  <EquipmentSlot label="Arma" value={e.equipment?.arma} />
                  <EquipmentSlot
                    label="Armadura"
                    value={e.equipment?.armadura}
                  />
                  <EquipmentSlot label="Gadget" value={e.equipment?.gadget} />
                  <EquipmentSlot label="Extra" value={null} />
                </div>
              </div>

              {/* Ações de missão */}
              {onMission && (
                <button
                  className="w-full py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
                  onClick={() => handleRecall(e.id)}
                >
                  Retirar da Missão
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full text-center text-gray-400 py-12">
            Nenhum explorador encontrado para este filtro.
          </div>
        )}
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        } bg-green-600 text-white`}
      >
        <p>{toast || ""}</p>
      </div>
    </div>
  );
}
