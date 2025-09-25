// src/utils/battleStats.js
export function computeBattleStats(bc) {
  if (!bc) return null;
  const entries = Object.entries(bc.history || {});
  const sum = (k) => entries.reduce((a, [, v]) => a + (v?.[k] || 0), 0);

  const attempts = Math.max(bc.attempts ?? 0, sum("attempts"));
  const victories = sum("victories");
  const defeats = sum("defeats");
  const winRate = attempts ? Math.round((victories / attempts) * 100) : 0;

  const current = bc.currentMissionId;
  const curStats = bc.history?.[current] || {
    attempts: 0,
    victories: 0,
    defeats: 0,
  };
  const lastOutcome = bc.lastOutcome ?? curStats.lastOutcome ?? null;
  const lastPlayedAt = bc.lastPlayedAt ?? curStats.lastPlayedAt ?? null;

  const missionsCleared = entries.filter(
    ([, v]) => (v?.victories || 0) > 0
  ).length;

  // histórico ordenado por índice numérico da fase, quando possível
  const parseIdx = (id) => Number(String(id).match(/\d+/)?.[0] ?? -1);
  const history = entries
    .map(([id, v]) => ({ id, ...v, idx: parseIdx(id) }))
    .sort((a, b) => a.idx - b.idx);

  return {
    attempts,
    victories,
    defeats,
    winRate,
    currentId: current,
    currentDeaths: curStats.defeats || 0,
    missionsCleared,
    lastOutcome,
    lastPlayedAt,
    history,
    progressPct: attempts
      ? Math.min(
          100,
          Math.round((missionsCleared / (missionsCleared + defeats || 1)) * 100)
        )
      : 0,
  };
}

export const fmtDateTime = (ts) => (ts ? new Date(ts).toLocaleString() : "—");
