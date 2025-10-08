// Helpers iguais aos do GameCanvas
export function rectSegments(x, y, w, h) {
  return [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y },
  ];
}

export function buildSegmentsFromSpec(wallsSpec = []) {
  const segs = [];
  for (const spec of wallsSpec) {
    const [type, ...rest] = spec;
    if (type === "rect") {
      segs.push(...rectSegments(...rest)); // x,y,w,h
    } else if (type === "seg") {
      const [x1, y1, x2, y2] = rest;
      segs.push({ x1, y1, x2, y2 });
    }
  }
  return segs;
}

export function buildWorldFromLevel(level) {
  const walls = buildSegmentsFromSpec(level?.walls || []);
  const pickups = level?.pickups || [];
  const exits = level?.exits || [];

  const enemies = (level?.enemies || []).map((raw) => {
    const kind = raw.type ?? "patrulheiro";
    const waypoints = Array.isArray(raw.waypoints) ? raw.waypoints.slice() : [];
    const rawIdx = Number.isFinite(raw.targetIdx) ? raw.targetIdx : 0;
    const targetIdx =
      waypoints.length > 0
        ? Math.max(0, Math.min(rawIdx, waypoints.length - 1))
        : 0;

    // dir: preserva do JSON; senão deriva do WP alvo; senão 0
    const dir =
      typeof raw.dir === "number"
        ? raw.dir
        : waypoints[targetIdx]
        ? Math.atan2(
            waypoints[targetIdx].y - raw.y,
            waypoints[targetIdx].x - raw.x
          )
        : 0;

    // estado inicial: preserva do JSON; senão por tipo
    const initState = raw.state ?? (kind === "sentinela" ? "guard" : "patrol");

    return {
      ...raw, // preserva campos do JSON
      type: kind,
      x: raw.x,
      y: raw.y,
      r: raw.r ?? 12,
      dir,
      state: initState,
      targetIdx,
      waypoints,
      home: raw.home ?? { x: raw.x, y: raw.y }, // ⬅ sentinela precisa
      lastSeenPlayerAt: raw.lastSeenPlayerAt ?? null,
      hp: raw.hp ?? 20,
    };
  });

  const playerStart = level?.playerStart || { x: 140, y: 140, r: 12 };

  return {
    walls,
    pickups,
    exits,
    enemies,
    playerStart,
    meta: { mapW: level?.mapW, mapH: level?.mapH },
  };
}
