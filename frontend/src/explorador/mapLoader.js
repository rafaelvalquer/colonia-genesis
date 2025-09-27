// Helpers iguais aos do GameCanvas
export function rectSegments(x, y, w, h) {
  return [
    { x1: x, y1: y, x2: x + w, y2: y },
    { x1: x + w, y1: y, x2: x + w, y2: y + h },
    { x1: x + w, y1: y + h, x2: x, y2: y + h },
    { x1: x, y1: y + h, x2: x, y2: y },
  ];
}

// Converte a lista "walls" do JSON em segmentos.
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

// Monta estrutura world a partir do nível do JSON
export function buildWorldFromLevel(level) {
  const walls = buildSegmentsFromSpec(level.walls);
  const pickups = level.pickups || [];
  const exits = level.exits || [];
  const enemies = (level.enemies || []).map((e) => ({
    x: e.x,
    y: e.y,
    r: e.r ?? 12,
    dir: 0,
    state: "patrol",
    targetIdx: 0,
    waypoints: e.waypoints || [],
    lastSeenPlayerAt: null,
    hp: 20,
  }));
  const playerStart = level.playerStart || { x: 140, y: 140, r: 12 };
  return {
    walls,
    pickups,
    exits,
    enemies,
    playerStart,
    meta: { mapW: level.mapW, mapH: level.mapH },
  };
}
