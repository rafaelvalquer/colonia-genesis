// src/pages/EstatisticasBatalha.jsx
import { computeBattleStats, fmtDateTime } from "../utils/battleStats";
import { missionDefs, getNextMissionId } from "../miniGame/entities/WaveConfig";

export default function EstatisticasBatalha({ bc }) {
  const s = computeBattleStats(bc);
  if (!s) return <div className="text-slate-600">Sem dados de campanha.</div>;

  // ===== helpers missão atual =====
  const currentId = s.currentId || bc?.currentMissionId || "fase_01";
  // se não houver definição da atual, tenta próxima usando getNextMissionId
  const missionDef =
    missionDefs[currentId] ||
    missionDefs[getNextMissionId(currentId)] ||
    missionDefs.fase_01;

  const totalWaves = missionDef?.waves?.length || 0;

  // agregado por tipo (todas as ondas)
  const perType = {};
  missionDef?.waves?.forEach((w) =>
    (w?.enemies || []).forEach((e) => {
      perType[e.type] = (perType[e.type] || 0) + (e.count || 0);
    })
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center p-6 rounded-xl bg-slate-900/70 border border-slate-700">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-600/80 flex items-center justify-center">
            <span className="text-white text-xl">⚔️</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Estatísticas de Batalha
            </h2>
            <p className="text-amber-300">
              Missão atual: <b>{s.currentId || "—"}</b>
            </p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 px-4 py-2 rounded-lg bg-slate-800 text-right">
          <p className="text-xs text-slate-400">Atualizado</p>
          <p className="text-amber-300 font-semibold">
            {fmtDateTime(s.lastPlayedAt)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI
          icon="☠️"
          title="Mortes na Fase"
          value={s.currentDeaths}
          color="text-blue-400"
          bg="bg-blue-900"
          hint={s.currentId}
        />
        <KPI
          icon="🏆"
          title="Vitórias"
          value={s.victories}
          color="text-green-400"
          bg="bg-green-900"
          hint="Missões concluídas"
        />
        <KPI
          icon="🎯"
          title="Taxa de Vitória"
          value={`${s.winRate}%`}
          color="text-purple-400"
          bg="bg-purple-900"
          hint={`${s.victories}/${s.attempts} vit/tent`}
        />
        <KPI
          icon="⏱️"
          title="Último Resultado"
          value={s.lastOutcome ?? "—"}
          color="text-amber-400"
          bg="bg-amber-900"
          hint="missão anterior"
        />
      </div>

      {/* Progresso Geral */}
      <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          📈 Progresso Geral
        </h3>
        <div className="mb-3 flex justify-between text-sm">
          <span className="text-slate-300">Missões concluídas</span>
          <span className="text-amber-300">
            {s.missionsCleared}/{s.history.length}
          </span>
        </div>
        <div className="h-2 rounded bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${s.progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <StatBox
            label="Vitórias"
            value={s.victories}
            color="text-green-400"
          />
          <StatBox
            label="Tentativas"
            value={s.attempts}
            color="text-blue-400"
          />
          <StatBox label="Derrotas" value={s.defeats} color="text-red-400" />
        </div>
      </div>

      {/* Histórico de Missões */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🗂️ Histórico
          </h3>
          <div className="space-y-3">
            {s.history.map((h) => {
              const rate = h.attempts
                ? Math.round((h.victories / h.attempts) * 100)
                : 0;
              const cls =
                rate >= 50
                  ? "border-l-4 border-green-500"
                  : "border-l-4 border-red-500";
              return (
                <div key={h.id} className={`bg-slate-800 p-4 rounded ${cls}`}>
                  <div className="flex justify-between">
                    <div>
                      <div className="font-semibold text-slate-100">{h.id}</div>
                      <div className="text-xs text-slate-400">
                        {fmtDateTime(h.lastPlayedAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-300">
                        {rate}% vitória
                      </div>
                      <div className="text-xs text-slate-400">
                        {h.victories}/{h.attempts} • derrotas {h.defeats}
                      </div>
                    </div>
                  </div>
                  {h.attempts > 0 && (
                    <div className="mt-2 h-2 rounded bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Próximos Objetivos / Missão atual */}
        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            🎯 Missão Atual
          </h3>

          <div className="rounded-lg p-4 bg-amber-900/30 border border-amber-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-700 flex items-center justify-center">
                🎯
              </div>
              <div>
                <div className="text-amber-300 font-bold">
                  {missionDef?.id} • {missionDef?.nome || "Sem nome"}
                </div>
                <div className="text-sm text-amber-200">
                  Ondas: <b>{totalWaves}</b>
                  {" • "}
                  Tentativas nesta fase:{" "}
                  <b>{bc?.history?.[currentId]?.attempts || 0}</b>
                </div>
                <div className="text-sm text-amber-200">
                  Mortes nesta fase: <b>{s.currentDeaths}</b>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo por tipo */}
          <div className="mt-4">
            <div className="text-slate-300 mb-2 font-semibold">
              Inimigos por tipo (total da missão)
            </div>
            {Object.keys(perType).length === 0 ? (
              <div className="text-slate-500 text-sm">
                Sem inimigos definidos.
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {Object.entries(perType).map(([type, count]) => (
                  <li
                    key={type}
                    className="flex items-center justify-between p-2 rounded bg-slate-800"
                  >
                    <span className="uppercase tracking-wide text-slate-200">
                      {type}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-900 text-blue-300 text-sm">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Detalhe por onda */}
          <div className="mt-6">
            <div className="text-slate-300 mb-2 font-semibold">Por onda</div>
            <div className="space-y-2">
              {(missionDef?.waves || []).map((w, idx) => {
                const totalOnda = (w?.enemies || []).reduce(
                  (a, e) => a + (e.count || 0),
                  0
                );
                return (
                  <div key={idx} className="p-3 rounded bg-slate-800">
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-200">Onda {idx + 1}</span>
                      <span className="text-slate-400 text-sm">
                        {totalOnda} inimigos
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(w?.enemies || []).map((e, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-700 text-slate-200 text-xs"
                          title={`tipo: ${e.type}`}
                        >
                          {e.type}: {e.count}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon, title, value, color, bg, hint }) {
  return (
    <div className="text-center p-6 rounded-xl bg-slate-900/70 border border-slate-700">
      <div
        className={`w-14 h-14 ${bg} rounded-full flex items-center justify-center mx-auto mb-3`}
      >
        <span className="text-2xl">{icon}</span>
      </div>
      <h4 className="text-slate-400 mb-1">{title}</h4>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="bg-slate-800 p-4 rounded text-center">
      <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
}

function Row({ label, value, badgeClass }) {
  return (
    <div className="flex items-center justify-between p-3 rounded bg-slate-800">
      <span className="text-slate-200">{label}</span>
      <span className={`px-2 py-1 rounded text-sm ${badgeClass}`}>{value}</span>
    </div>
  );
}
