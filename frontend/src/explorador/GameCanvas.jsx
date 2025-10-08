// src/minigames/explorador-fov/GameCanvas.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { buildWorldFromLevel } from "./mapLoader";
import levels from "./maps/levels.json";

/**
 * Explorador 2D Top-Down em <canvas>
 * - WASD: mover | Shift: sprint
 * - Mouse: direção da lanterna
 * - FOV por raycasting (cone) + “bolinha” 360° suave
 * - Inimigos: patrulha -> caça (com LOS) -> retorno à rota
 * - Anti-trava: desvio curto, slide na parede, unstuck timer
 * - Pickups: energia, cura, chave | Saída com chave
 *
 * DICAS:
 * - O “chase” só roda se houver LOS REAL (sem ver através de paredes).
 * - Ao perder o player, usa um pequeno grace e entra em “return”, reancorando
 *   no waypoint mais próximo para voltar à patrulha.
 */

const CFG = {
  speed: 130, // velocidade base
  sprintMul: 1.6, // multiplicador ao sprintar
  sprintDrainPerSec: 12, // gasto de stamina por segundo correndo
  regenWhileWalk: 3, // regen/s caminhando normal
  regenWhileIdle: 6, // regen/s parado
  fovDeg: 70,
  rays: 180,
  viewDist: 420,
  enemyViewDist: 340,
  enemyFovDeg: 95,
  enemySpeed: 90,
  chaseSpeed: 130,
  enemyDamagePerSec: 6,
  energyPickup: 8,
  healPickup: 6,
  useVisionBubble: true,
  visionBubbleRadius: 140,
  visionBubbleFeather: 36,
  sentinelTurnDegPerSec: 35,
  sentinelSweepDeg: 110,
  debugDrawSound: true,
};

/** Ajusta o canvas ao CSS e DPR */
function setCanvasSize(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function calcSkillMods(sk) {
  const v = sk?.visao | 0,
    ag = sk?.agilidade | 0,
    fo = sk?.folego | 0,
    fu = sk?.furtividade | 0,
    re = sk?.resiliencia | 0;

  return {
    // Visão
    fovAddDeg: clamp(1.5 * v, 0, 15),
    viewDistMul: clamp(1 + 0.03 * v, 1, 1.3),
    bubbleMul: clamp(1 + 0.06 * v, 1, 1.6),

    // Movimento
    speedMul: clamp(1 + 0.03 * ag, 1, 1.3),
    sprintMulBonus: clamp(1 + 0.02 * ag, 1, 1.2),

    // Stamina
    enMaxBonus: 2 * fo,
    regenMul: clamp(1 + 0.05 * fo, 1, 1.5),
    sprintDrainMul: clamp(1 - (0.03 * ag + 0.04 * fo), 0.6, 1),

    // Furtividade
    noiseMul: clamp(1 - 0.06 * fu, 0.4, 1),
    lostGraceAdd: clamp(0.02 * fu, 0, 0.25),

    // Sobrevivência
    hpMaxBonus: 2 * re,
    dmgTakenMul: clamp(1 - 0.03 * re, 0.7, 1),
  };
}

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const rpx = bx - ax,
    rpy = by - ay;
  const spx = dx - cx,
    spy = dy - cy;
  const denom = rpx * spy - rpy * spx;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((cx - ax) * spy - (cy - ay) * spx) / denom;
  const u = ((cx - ax) * rpy - (cy - ay) * rpx) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: ax + t * rpx, y: ay + t * rpy, t, u };
}

/** Raycast: do ponto (px,py) no ângulo ang até bater numa parede ou maxDist */
function castRay(px, py, ang, segs, maxDist) {
  const dx = Math.cos(ang) * maxDist;
  const dy = Math.sin(ang) * maxDist;
  let hit = null;
  for (const s of segs) {
    const i = segIntersect(px, py, px + dx, py + dy, s.x1, s.y1, s.x2, s.y2);
    if (!i) continue;
    if (!hit || i.t < hit.t) hit = i;
  }
  return hit || { x: px + dx, y: py + dy, t: 1 };
}

/** Empurra um círculo (p,r) para fora das paredes finas (com margem) */
function circleWallPushOut(p, r, segs) {
  const margin = 3;
  for (const s of segs) {
    const vx = s.x2 - s.x1,
      vy = s.y2 - s.y1;
    const wx = p.x - s.x1,
      wy = p.y - s.y1;
    const c1 = vx * wx + vy * wy;
    const c2 = vx * vx + vy * vy;
    let t = 0;
    if (c2 > 0) t = clamp(c1 / c2, 0, 1);
    const projx = s.x1 + t * vx,
      projy = s.y1 + t * vy;
    const dx = p.x - projx,
      dy = p.y - projy;
    const dist = Math.hypot(dx, dy);
    const minD = r + margin;
    if (dist < minD) {
      const nx = dist > 0 ? dx / dist : 1;
      const ny = dist > 0 ? dy / dist : 0;
      const push = minD - dist;
      p.x += nx * push;
      p.y += ny * push;
    }
  }
}
const angleBetween = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
};
function hasLineOfSight(x1, y1, x2, y2, segs) {
  for (const s of segs) {
    if (segIntersect(x1, y1, x2, y2, s.x1, s.y1, s.x2, s.y2)) return false;
  }
  return true;
}

const toRad = (deg) => (deg * Math.PI) / 180;
// ⬇️ agora parametrizada com FOV e alcance efetivos
function buildFOVPolygon(px, py, dir, segs, fovDeg, viewDist) {
  const half = toRad(fovDeg) / 2;
  const start = dir - half,
    end = dir + half;
  const n = CFG.rays,
    pts = [];
  for (let i = 0; i <= n; i++) {
    const ang = start + ((end - start) * i) / n;
    const h = castRay(px, py, ang, segs, viewDist);
    pts.push(h);
  }
  return pts;
}

/** Ray curto à frente: detecta parede colada na direção atual */
function forwardBlocked(ent, segs, dist = 18) {
  const hit = castRay(ent.x, ent.y, ent.dir, segs, dist);
  return hit && hit.t < 0.98;
}

/** Escolhe pequeno desvio lateral a partir de um ângulo desejado */
function pickDetourDir(fromDir, ent, segs) {
  const candidatesDeg = [30, -30, 60, -60, 90, -90, 120, -120];
  for (const d of candidatesDeg) {
    const ang = fromDir + (d * Math.PI) / 180;
    const hit = castRay(ent.x, ent.y, ang, segs, 60);
    if (!hit || hit.t > 0.98) return ang;
  }
  return fromDir;
}

/** Move entidade até (tx,ty) com velocidade sp */
function moveTowards(ent, tx, ty, sp, dt) {
  const dx = tx - ent.x,
    dy = ty - ent.y;
  const d = Math.hypot(dx, dy) || 1;
  ent.x += (dx / d) * sp * dt;
  ent.y += (dy / d) * sp * dt;
}

/** Waypoint mais próximo do inimigo (para “return”) */
function nearestWaypointIndex(e) {
  let best = 0,
    bestD = Infinity;
  for (let i = 0; i < e.waypoints.length; i++) {
    const wp = e.waypoints[i];
    const d2 = (wp.x - e.x) ** 2 + (wp.y - e.y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      best = i;
    }
  }
  return best;
}

/** ✅ Agora recebe explorer/mission e usa stats do explorador no HUD */
export default function ExplorerGameCanvas({
  estadoAtual,
  onEstadoChange,
  explorer,
  explorerId,
  mission,
  missionId,
  filaItem,
}) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const sprintLockedRef = useRef(false);

  console.log(mission.recompensas);
  // mapa atual (vem do JSON)
  const mapSizeRef = useRef({ w: 1600, h: 900 }); // atualizado pelo level
  const world = useRef({ walls: [], enemies: [], pickups: [], exits: [] });
  const playerRef = useRef({ x: 140, y: 140, r: 12, dir: 0, vx: 0, vy: 0 });
  const pressed = useRef({});
  const cam = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // minimapa/fog
  const mini = useRef({ scale: 0.12, w: 0, h: 0 });
  const fogCanvasRef = useRef(null);

  const [levelReady, setLevelReady] = useState(false);

  // 🔎 Deriva valores do explorador (fallback para estadoAtual ou defaults)
  const hpCurrent0 = explorer?.hp?.current ?? estadoAtual?.hp?.current ?? 10;
  const hpMax0 = explorer?.hp?.max ?? estadoAtual?.hp?.max ?? 10;
  const enCurrent0 = explorer?.stamina?.current ?? estadoAtual?.energia ?? 10;
  const enMax0 = explorer?.stamina?.max ?? estadoAtual?.energiaMax ?? 10;

  const [hud, setHud] = useState({
    hp: hpCurrent0,
    hpMax: hpMax0,
    en: enCurrent0,
    enMax: enMax0,
    keys: [],
  });
  const hudRef = useRef(hud);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  const mods = useMemo(
    () => calcSkillMods(explorer?.skills),
    [explorer?.skills]
  );

  useEffect(() => {
    const kd = (e) => (pressed.current[e.key.toLowerCase()] = true);
    const ku = (e) => {
      pressed.current[e.key.toLowerCase()] = false;
      if (e.key === "Shift") sprintLockedRef.current = false; // libera ao soltar
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // Aplicar nos CFGs efetivos:
  const fovDegEff = CFG.fovDeg + mods.fovAddDeg;
  const viewDistEff = CFG.viewDist * mods.viewDistMul;
  const bubbleRadEff = CFG.visionBubbleRadius * mods.bubbleMul;
  const speedEff = CFG.speed * mods.speedMul;
  const sprintMulEff = CFG.sprintMul * mods.sprintMulBonus;
  const sprintDrainEff = CFG.sprintDrainPerSec * mods.sprintDrainMul;
  const regenWalkEff = CFG.regenWhileWalk * mods.regenMul;
  const regenIdleEff = CFG.regenWhileIdle * mods.regenMul;
  const enemyDpsEff = CFG.enemyDamagePerSec * mods.dmgTakenMul;

  // HP/Stamina máximos do HUD
  useEffect(() => {
    setHud((h) => ({
      ...h,
      hpMax: (explorer?.hp?.max ?? h.hpMax) + mods.hpMaxBonus,
      enMax: (explorer?.stamina?.max ?? h.enMax) + mods.enMaxBonus,
      hp: Math.min(h.hp, (explorer?.hp?.max ?? h.hpMax) + mods.hpMaxBonus),
      en: Math.min(h.en, (explorer?.stamina?.max ?? h.enMax) + mods.enMaxBonus),
    }));
  }, [mods]);

  // objetivos básicos do minigame
  const [objectives, setObjectives] = useState([]);

  useEffect(() => {
    const level =
      levels.levels.find((l) => l.id === missionId) || levels.levels[0];
    if (!level) return;

    const built = buildWorldFromLevel(level);
    // aplica mundo
    world.current.walls = built.walls;
    world.current.pickups = [...built.pickups];
    world.current.exits = built.exits;
    world.current.enemies = built.enemies.map((e) => {
      const kind = e.type || "patrulheiro"; // default
      console.log(e);

      // home para sentinela
      const home = { x: e.x, y: e.y };

      // waypoints (fallback se vazio)
      let wps = Array.isArray(e.waypoints) ? e.waypoints.slice() : [];
      if (wps.length === 0) {
        const s = 80;
        wps = [
          { x: e.x + s, y: e.y },
          { x: e.x + s, y: e.y + s },
          { x: e.x, y: e.y + s },
          { x: e.x, y: e.y },
        ];
      }

      const targetIdx = e.targetIdx ?? 0;
      const dir =
        typeof e.dir === "number"
          ? e.dir
          : Math.atan2(wps[targetIdx].y - e.y, wps[targetIdx].x - e.x);

      // estado inicial por tipo
      const initState = kind === "sentinela" ? "guard" : "patrol";

      return {
        ...e,
        type: kind,
        waypoints: wps,
        home,
        state: e.state ?? initState,
        __guardBaseDir: typeof e.dir === "number" ? e.dir : dir, // centro do sweep
        __spinDir: 1, // 1 ou -1
        targetIdx,
        dir,
        __detourT: 0,
        __detourDir: null,
        __wpBlockedT: 0,
        __lostT: 0,
        __investigate: null,
        __lastHeardAt: 0,
      };
    });

    // tamanho do mapa
    mapSizeRef.current = {
      w: built.meta.mapW || 1600,
      h: built.meta.mapH || 900,
    };

    // player start
    playerRef.current.x = built.playerStart.x;
    playerRef.current.y = built.playerStart.y;
    playerRef.current.r = built.playerStart.r ?? 12;

    // fog baseado no tamanho do mapa
    const fog = document.createElement("canvas");
    fog.width = mapSizeRef.current.w;
    fog.height = mapSizeRef.current.h;
    const fctx = fog.getContext("2d");
    fctx.fillStyle = "rgba(0,0,0,0.92)";
    fctx.fillRect(0, 0, fog.width, fog.height);
    fogCanvasRef.current = fog;

    // minimapa
    mini.current.w = Math.round(mapSizeRef.current.w * mini.current.scale);
    mini.current.h = Math.round(mapSizeRef.current.h * mini.current.scale);

    // cria objetivos a partir das recompensas da missão
    const rewards = Array.isArray(mission?.recompensas)
      ? mission.recompensas
      : [];
    setObjectives(
      rewards.map((r, i) => ({
        id: `reward_${i}`,
        label: r.label || `Objetivo ${i + 1}`,
        done: false,
        payload: r,
      }))
    );

    // posições vindas do JSON do level
    const spawns = Array.isArray(level.rewardSpawns) ? level.rewardSpawns : [];

    // monta pickups somente do tipo reward nas posições do JSON
    const rewardPickups = rewards.map((r, i) => {
      const sp = spawns[i] ||
        spawns[spawns.length - 1] || {
          x: playerRef.current.x,
          y: playerRef.current.y,
          r: 10,
        };
      return {
        x: sp.x,
        y: sp.y,
        r: sp.r ?? 10,
        kind: "reward",
        rewardId: i,
        label: r.label || `Objetivo ${i + 1}`,
        reward: r,
      };
    });

    // aplica no mundo
    world.current.pickups = rewardPickups;

    setLevelReady(true);
  }, [missionId]); // reconstroi se mudar missão

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const onResize = () => {
      const r = box.getBoundingClientRect();
      setCanvasSize(
        canvas,
        Math.floor(r.width),
        Math.floor(window.innerHeight - r.top - 24)
      );
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Teclado
  useEffect(() => {
    const kd = (e) => (pressed.current[e.key.toLowerCase()] = true);
    const ku = (e) => (pressed.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  // Mouse -> direção do player
  useEffect(() => {
    const onMove = (e) => {
      const c = canvasRef.current;
      const r = c.getBoundingClientRect();
      const px = playerRef.current.x - cam.current.x;
      const py = playerRef.current.y - cam.current.y;
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      playerRef.current.dir = Math.atan2(my - py, mx - px);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Loop
  useEffect(() => {
    let last = performance.now(),
      raf;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (levelReady) {
        update(dt);
        draw();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [levelReady]);

  function update(dt) {
    const p = playerRef.current;

    // INPUT
    let ix = 0,
      iy = 0;
    if (pressed.current["w"]) iy -= 1;
    if (pressed.current["s"]) iy += 1;
    if (pressed.current["a"]) ix -= 1;
    if (pressed.current["d"]) ix += 1;
    const moving = ix !== 0 || iy !== 0;

    const h0 = hudRef.current;

    // sprint só se: Shift, tem stamina, está movendo e NÃO está travado
    const canSprint =
      pressed.current["shift"] &&
      !sprintLockedRef.current &&
      h0.en > 0.01 &&
      moving;

    // velocidades
    const sp = canSprint ? speedEff * sprintMulEff : speedEff;

    // move...
    const len = Math.hypot(ix, iy) || 1;
    p.x += (ix / len) * sp * dt;
    p.y += (iy / len) * sp * dt;

    circleWallPushOut(p, p.r, world.current.walls);

    // stamina
    let newEn = h0.en;
    if (canSprint) newEn = Math.max(0, newEn - sprintDrainEff * dt);
    else if (moving) newEn = Math.min(h0.enMax, newEn + regenWalkEff * dt);
    else newEn = Math.min(h0.enMax, newEn + regenIdleEff * dt);

    // 🔒 se zerou enquanto Shift ainda está pressionado, trava o sprint
    if (pressed.current["shift"] && newEn <= 0.001) {
      newEn = 0;
      sprintLockedRef.current = true;
    }

    if (newEn !== h0.en) {
      hudRef.current = { ...h0, en: newEn };
      setHud((h) => (h.en === newEn ? h : { ...h, en: newEn }));
    }

    // Furtividade/ruído (skills)
    const noiseRadiusBase = 120;
    const noiseRadius = noiseRadiusBase * mods.noiseMul;
    const noiseFactor = moving ? (canSprint ? 1.25 : 1.0) : 0.0;
    const lostGrace = 0.3 + mods.lostGraceAdd;

    // inimigos
    for (const e of world.current.enemies) {
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
      const dist = Math.hypot(p.x - e.x, p.y - e.y);

      // 1) Percepção + transições
      const sees =
        dist <= CFG.enemyViewDist &&
        Math.abs(angleBetween(e.dir, toPlayer)) <= toRad(CFG.enemyFovDeg) / 2 &&
        hasLineOfSight(e.x, e.y, p.x, p.y, world.current.walls);

      // audição só se NÃO for patrulheiro
      const canHear =
        e.type !== "patrulheiro" &&
        noiseFactor > 0 &&
        dist < noiseRadius * noiseFactor;

      if (sees) {
        e.state = "chase";
        e.lastSeenPlayerAt = { x: p.x, y: p.y, t: performance.now() };
        e.__lostT = 0;
        e.__investigate = null;
      } else {
        if (canHear) {
          e.__lastHeardAt = performance.now();
          e.__investigate = { x: p.x, y: p.y };

          // ⬇️ Agora, se for sentinela em guard, ele passa a "return"
          // para caminhar até o ponto investigado e, depois, voltar ao home.
          if (e.type === "sentinela" && e.state === "guard") {
            e.state = "return";
          }
        }

        if (e.state === "chase") {
          e.__lostT = (e.__lostT ?? 0) + dt;
          if (e.__lostT > 0.3 + mods.lostGraceAdd) {
            e.state = "return";
            // patrulheiro: volta aos WPs; sentinela: volta ao home
            if (e.type === "patrulheiro") {
              e.targetIdx = nearestWaypointIndex(e);
            }
            e.__detourT = 0;
            e.__detourDir = null;
            e.__wpBlockedT = 0;
          }
        }
      }

      // 2) FSM – executa o estado atual
      switch (e.state) {
        case "guard": {
          const half = (CFG.sentinelSweepDeg * Math.PI) / 180 / 2;
          const speed = ((CFG.sentinelTurnDegPerSec * Math.PI) / 180) * dt;
          e.dir += speed * (e.__spinDir ?? 1);
          const rel =
            ((e.dir - e.__guardBaseDir + Math.PI) % (2 * Math.PI)) - Math.PI;
          if (rel > half) {
            e.dir = e.__guardBaseDir + half;
            e.__spinDir = -1;
          }
          if (rel < -half) {
            e.dir = e.__guardBaseDir - half;
            e.__spinDir = 1;
          }
          break;
        }

        case "patrol": {
          const wp = e.waypoints[e.targetIdx];
          if (wp) {
            const desiredDir = Math.atan2(wp.y - e.y, wp.x - e.x);
            const haveLOS = hasLineOfSight(
              e.x,
              e.y,
              wp.x,
              wp.y,
              world.current.walls
            );

            if (haveLOS) {
              e.__detourT = 0;
              e.__detourDir = null;
              e.__wpBlockedT = 0;
              moveTowards(e, wp.x, wp.y, CFG.enemySpeed, dt);
              e.dir = desiredDir;
            } else {
              e.__wpBlockedT = (e.__wpBlockedT ?? 0) + dt;
              e.__detourDir ??= pickDetourDir(
                desiredDir,
                e,
                world.current.walls
              );
              e.__detourT = (e.__detourT ?? 0) + dt;
              e.dir = e.__detourDir;
              e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
              e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;

              if (hasLineOfSight(e.x, e.y, wp.x, wp.y, world.current.walls)) {
                e.__detourT = 0;
                e.__detourDir = null;
                e.__wpBlockedT = 0;
              }
              if (e.__detourT > 0.9) {
                e.__detourT = 0;
                e.__detourDir = pickDetourDir(
                  desiredDir,
                  e,
                  world.current.walls
                );
              }
              if (e.__wpBlockedT > 2.0) {
                e.targetIdx = nearestWaypointIndex(e);
                e.__wpBlockedT = 0;
                e.__detourT = 0;
                e.__detourDir = null;
              }
            }

            if (Math.hypot(wp.x - e.x, wp.y - e.y) < 8) {
              e.targetIdx = (e.targetIdx + 1) % e.waypoints.length;
              e.__detourT = 0;
              e.__detourDir = null;
              e.__wpBlockedT = 0;
            }

            // comportamento ao final da patrulha (apenas p/ sentinela)
            if (e.type === "sentinela") {
              // se faz um tempinho que não ouve nada e não vê o player, volta ao home
              const msSinceHeard = performance.now() - (e.__lastHeardAt || 0);
              if (msSinceHeard > 4000) {
                e.state = "return";
              }
            }
          }
          break;
        }

        case "chase": {
          // só persegue se LOS verdadeiro; caso contrário, volta ao “return”
          if (!hasLineOfSight(e.x, e.y, p.x, p.y, world.current.walls)) {
            e.state = "return";
            e.targetIdx = nearestWaypointIndex(e);
            break;
          }
          const desiredDir = Math.atan2(p.y - e.y, p.x - e.x);
          e.dir = desiredDir;
          moveTowards(e, p.x, p.y, CFG.chaseSpeed, dt);

          // pequeno desvio quando tem parede colada
          if (forwardBlocked(e, world.current.walls, e.r + 10)) {
            const detour = pickDetourDir(desiredDir, e, world.current.walls);
            e.dir = detour;
            e.x += Math.cos(e.dir) * CFG.chaseSpeed * dt;
            e.y += Math.sin(e.dir) * CFG.chaseSpeed * dt;
          }
          break;
        }

        case "return": {
          // Se houver ponto de investigação, caminhe até ele primeiro (igual você já tinha)
          if (e.__investigate) {
            const tx = e.__investigate.x,
              ty = e.__investigate.y;
            const desiredDir = Math.atan2(ty - e.y, tx - e.x);
            const haveLOS = hasLineOfSight(
              e.x,
              e.y,
              tx,
              ty,
              world.current.walls
            );
            if (haveLOS) {
              e.__detourT = 0;
              e.__detourDir = null;
              e.__wpBlockedT = 0;
              moveTowards(e, tx, ty, CFG.enemySpeed, dt);
              e.dir = desiredDir;
            } else {
              e.__wpBlockedT = (e.__wpBlockedT ?? 0) + dt;
              e.__detourDir ??= pickDetourDir(
                desiredDir,
                e,
                world.current.walls
              );
              e.__detourT = (e.__detourT ?? 0) + dt;
              e.dir = e.__detourDir;
              e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
              e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;

              if (hasLineOfSight(e.x, e.y, tx, ty, world.current.walls)) {
                e.__detourT = 0;
                e.__detourDir = null;
                e.__wpBlockedT = 0;
              }
              if (e.__detourT > 0.9) {
                e.__detourT = 0;
                e.__detourDir = pickDetourDir(
                  desiredDir,
                  e,
                  world.current.walls
                );
              }
              if (e.__wpBlockedT > 2.0) {
                e.__investigate = null;
                e.__wpBlockedT = 0;
                e.__detourT = 0;
                e.__detourDir = null;
                if (e.type === "patrulheiro")
                  e.targetIdx = nearestWaypointIndex(e);
              }
            }
            if (Math.hypot(tx - e.x, ty - e.y) < 12) {
              e.__investigate = null;
              if (e.type === "patrulheiro")
                e.targetIdx = nearestWaypointIndex(e);
            }
            break;
          }

          if (e.type === "patrulheiro") {
            // volta ao ciclo de WPs
            const wp = e.waypoints[e.targetIdx];
            if (wp) {
              const desiredDir = Math.atan2(wp.y - e.y, wp.x - e.x);
              const haveLOS = hasLineOfSight(
                e.x,
                e.y,
                wp.x,
                wp.y,
                world.current.walls
              );
              if (haveLOS) {
                e.__detourT = 0;
                e.__detourDir = null;
                e.__wpBlockedT = 0;
                moveTowards(e, wp.x, wp.y, CFG.enemySpeed, dt);
                e.dir = desiredDir;
              } else {
                e.__wpBlockedT = (e.__wpBlockedT ?? 0) + dt;
                e.__detourDir ??= pickDetourDir(
                  desiredDir,
                  e,
                  world.current.walls
                );
                e.__detourT = (e.__detourT ?? 0) + dt;
                e.dir = e.__detourDir;
                e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
                e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;

                if (hasLineOfSight(e.x, e.y, wp.x, wp.y, world.current.walls)) {
                  e.__detourT = 0;
                  e.__detourDir = null;
                  e.__wpBlockedT = 0;
                }
                if (e.__detourT > 0.9) {
                  e.__detourT = 0;
                  e.__detourDir = pickDetourDir(
                    desiredDir,
                    e,
                    world.current.walls
                  );
                }
                if (e.__wpBlockedT > 2.0) {
                  e.targetIdx = nearestWaypointIndex(e);
                  e.__wpBlockedT = 0;
                  e.__detourT = 0;
                  e.__detourDir = null;
                }
              }
              if (Math.hypot(wp.x - e.x, wp.y - e.y) < 8) {
                e.state = "patrol";
              }
            }
          } else {
            // sentinela: voltar ao ponto inicial (home) e então ficar em "guard"
            const tx = e.home.x,
              ty = e.home.y;
            const desiredDir = Math.atan2(ty - e.y, tx - e.x);
            const haveLOS = hasLineOfSight(
              e.x,
              e.y,
              tx,
              ty,
              world.current.walls
            );
            if (haveLOS) {
              e.__detourT = 0;
              e.__detourDir = null;
              e.__wpBlockedT = 0;
              moveTowards(e, tx, ty, CFG.enemySpeed, dt);
              e.dir = desiredDir;
            } else {
              e.__wpBlockedT = (e.__wpBlockedT ?? 0) + dt;
              e.__detourDir ??= pickDetourDir(
                desiredDir,
                e,
                world.current.walls
              );
              e.__detourT = (e.__detourT ?? 0) + dt;
              e.dir = e.__detourDir;
              e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
              e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;

              if (hasLineOfSight(e.x, e.y, tx, ty, world.current.walls)) {
                e.__detourT = 0;
                e.__detourDir = null;
                e.__wpBlockedT = 0;
              }
              if (e.__detourT > 0.9) {
                e.__detourT = 0;
                e.__detourDir = pickDetourDir(
                  desiredDir,
                  e,
                  world.current.walls
                );
              }
            }
            if (Math.hypot(tx - e.x, ty - e.y) < 10) {
              e.state = "guard";
              // mantém dir original se existir
              if (typeof e.dir === "number") {
                /* ok */
              }
            }
          }
          break;
        }
      }

      // anti-trava básico
      circleWallPushOut(e, e.r, world.current.walls);

      // anti-trava/steering só para quem PODE mover
      if (!(e.type === "sentinela" && e.state === "guard")) {
        // anti-trava básico
        // Steering curto se parede à frente
        if (forwardBlocked(e, world.current.walls, e.r + 10)) {
          e.dir += (22 * Math.PI) / 180;
          if (forwardBlocked(e, world.current.walls, e.r + 10))
            e.dir -= (44 * Math.PI) / 180;
        }
        e.__prevX ??= e.x;
        e.__prevY ??= e.y;
        e.__stuckT ??= 0;
        const moved = Math.hypot(e.x - e.__prevX, e.y - e.__prevY);
        if (moved < 0.4) e.__stuckT += dt;
        else e.__stuckT = 0;
        e.__prevX = e.x;
        e.__prevY = e.y;
        if (e.__stuckT > 0.5) {
          const tx = -Math.sin(e.dir),
            ty = Math.cos(e.dir),
            n = 14;
          const ox = e.x,
            oy = e.y;
          e.x += tx * n * dt;
          e.y += ty * n * dt;
          circleWallPushOut(e, e.r, world.current.walls);
          if (Math.hypot(e.x - ox, e.y - oy) < 0.5) {
            e.x = ox;
            e.y = oy;
            e.x -= tx * n * dt;
            e.y -= ty * n * dt;
            circleWallPushOut(e, e.r, world.current.walls);
          }
          if (Math.hypot(e.x - ox, e.y - oy) < 0.5)
            e.dir += (65 * Math.PI) / 180;
        }
      }
      // (mantenha o circleWallPushOut(e, e.r, ...) antes do if, se quiser só desencaixar)

      if (
        dist < 26 &&
        hasLineOfSight(e.x, e.y, p.x, p.y, world.current.walls)
      ) {
        setHud((h) => ({ ...h, hp: Math.max(0, h.hp - enemyDpsEff * dt) }));
      }
    }

    // Pickups
    world.current.pickups = world.current.pickups.filter((pk) => {
      if (Math.hypot(pk.x - p.x, pk.y - p.y) <= p.r + pk.r + 2) {
        applyPickup(pk);
        return false;
      }
      return true;
    });

    // Saída
    for (const ex of world.current.exits) {
      const inside =
        p.x >= ex.x && p.x <= ex.x + ex.w && p.y >= ex.y && p.y <= ex.y + ex.h;
      if (inside) {
        const has = !ex.needKey || hud.keys.includes(ex.needKey);
        if (has) {
          setObjectives((list) =>
            list.map((o) => (o.id === "exit" ? { ...o, done: true } : o))
          );
          onEstadoChange?.({
            ...estadoAtual,
            energia: Math.round((estadoAtual?.energia ?? 0) + 5),
          });
        }
      }
    }

    // Câmera
    const c = canvasRef.current;
    const r = c.getBoundingClientRect();
    cam.current.w = r.width;
    cam.current.h = r.height;
    const cx = clamp(
      p.x - cam.current.w / 2,
      0,
      mapSizeRef.current.w - cam.current.w
    );
    const cy = clamp(
      p.y - cam.current.h / 2,
      0,
      mapSizeRef.current.h - cam.current.h
    );
    cam.current.x = cx;
    cam.current.y = cy;
  }

  /** Aplica pickups ao HUD */
  function applyPickup(pk) {
    if (pk.kind !== "reward") return;
    setObjectives((list) =>
      list.map((o, idx) => (idx === pk.rewardId ? { ...o, done: true } : o))
    );
  }

  // ========================= DRAW (render) =========================
  // Aqui começa todo o desenho da cena (mundo + máscara de visão + HUD).
  function draw() {
    const p = playerRef.current;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);

    // Fundo
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, c.width, c.height);

    // Mundo (com câmera)
    ctx.save();
    ctx.translate(-cam.current.x, -cam.current.y);

    // Chão (usar tamanho real do mapa)
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, mapSizeRef.current.w, mapSizeRef.current.h);

    // Paredes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const s of world.current.walls) {
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
    }
    ctx.stroke();

    // Saídas
    for (const ex of world.current.exits) {
      ctx.fillStyle = "rgba(34,197,94,0.15)";
      ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
      ctx.strokeStyle = "rgba(34,197,94,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
    }

    // Pickups
    for (const pk of world.current.pickups) {
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, pk.r, 0, Math.PI * 2);
      ctx.fillStyle = "#a78bfa"; // recompensa
      ctx.fill();
      ctx.strokeStyle = "#0b0b0b";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Inimigos + cones de visão
    for (const e of world.current.enemies) {
      const half = toRad(CFG.enemyFovDeg) / 2;

      // escolha de cores por tipo/estado
      const isChasing = e.state === "chase";
      let bodyColor, coneColor;

      // sentinela: azul fora de chase, vermelho no chase
      if (e.type === "sentinela") {
        bodyColor = isChasing ? "#ef4444" : "#3b82f6"; // vermelho / azul
        coneColor = isChasing ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)";
      } else {
        // patrulheiro: laranja fora de chase, vermelho no chase
        bodyColor = isChasing ? "#ef4444" : "#f59e0b"; // vermelho / laranja
        coneColor = isChasing ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)";
      }

      // --- Debug: círculo do som do player (desenha 1x por frame) ---
      if (CFG.debugDrawSound) {
        const moving = !!(
          pressed.current["w"] ||
          pressed.current["a"] ||
          pressed.current["s"] ||
          pressed.current["d"]
        );
        const canSprint =
          pressed.current["shift"] && moving && hudRef.current.en > 0.01;

        const noiseRadiusBase = 120;
        const noiseRadius = noiseRadiusBase * mods.noiseMul;
        const noiseFactor = moving ? (canSprint ? 1.25 : 1.0) : 0.0;
        const rNoise = noiseRadius * noiseFactor;

        if (rNoise > 0) {
          ctx.save();
          // NÃO traduzir: já estamos em coordenadas do mundo aqui
          ctx.beginPath();
          ctx.setLineDash([6, 6]);
          ctx.arc(p.x, p.y, rNoise, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(99,102,241,0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.arc(p.x, p.y, rNoise, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(99,102,241,0.08)";
          ctx.fill();
          ctx.restore();
        }
      }

      // CONE
      ctx.save();
      ctx.fillStyle = coneColor;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, CFG.enemyViewDist, e.dir - half, e.dir + half);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // CORPO
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = bodyColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.dir) * 18, e.y + Math.sin(e.dir) * 18);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // --------- MÁSCARA DE VISÃO (cone + bolinha 360°) ---------
    const vx = cam.current.x,
      vy = cam.current.y,
      vw = cam.current.w,
      vh = cam.current.h;
    const mask = document.createElement("canvas");
    mask.width = Math.max(1, vw);
    mask.height = Math.max(1, vh);
    const mctx = mask.getContext("2d");

    // 1) Lanterna (raycasting opaco)
    mctx.save();
    mctx.translate(-vx, -vy);
    const poly = buildFOVPolygon(
      p.x,
      p.y,
      p.dir,
      world.current.walls,
      fovDegEff,
      viewDistEff
    );

    revealCircle(p.x, p.y, CFG.visionBubbleRadius * 0.9); // área próxima do player
    revealPoly([{ x: p.x, y: p.y }, ...poly]); // revela o que a lanterna “vê”
    mctx.beginPath();
    mctx.moveTo(p.x, p.y);
    for (const pt of poly) mctx.lineTo(pt.x, pt.y);
    mctx.closePath();
    mctx.fillStyle = "#fff";
    mctx.fill();
    mctx.restore();

    // 2) Bolinha 360° suave
    if (CFG.useVisionBubble) {
      mctx.save();
      mctx.translate(-vx, -vy);
      const r = bubbleRadEff,
        feather = CFG.visionBubbleFeather;
      const g = mctx.createRadialGradient(
        p.x,
        p.y,
        Math.max(1, r - feather),
        p.x,
        p.y,
        r
      );
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      mctx.globalCompositeOperation = "lighter";
      mctx.fillStyle = g;
      mctx.fillRect(vx, vy, vw, vh);
      mctx.restore();
    }

    // Aplica máscara à cena desenhada
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mask, vx, vy);
    ctx.restore();

    // Escurece fora da visão
    ctx.save();
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, mapSizeRef.current.w, mapSizeRef.current.h);
    ctx.restore();

    // Player por cima (sempre visível)
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0b0b0b";
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.dir) * 22, p.y + Math.sin(p.dir) * 22);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore(); // fim do mundo

    drawHUD(ctx, c);
    drawMinimap(ctx, c);
  }

  function revealCircle(x, y, r) {
    const fog = fogCanvasRef.current;
    if (!fog) return;
    const fctx = fog.getContext("2d");
    fctx.save();
    fctx.globalCompositeOperation = "destination-out";
    fctx.beginPath();
    fctx.arc(x, y, r, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();
  }
  function revealPoly(points) {
    const fog = fogCanvasRef.current;
    if (!fog) return;
    const fctx = fog.getContext("2d");
    fctx.save();
    fctx.globalCompositeOperation = "destination-out";
    fctx.beginPath();
    fctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      fctx.lineTo(points[i].x, points[i].y);
    fctx.closePath();
    fctx.fill();
    fctx.restore();
  }

  function drawHUD(ctx) {
    const h = hudRef.current; // ✅ pega valores atualizados
    const pad = 12,
      barW = 240,
      barH = 12;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(2,6,23,0.85)";
    ctx.fillRect(pad - 6, pad - 6, barW + 12, 68);
    ctx.restore();

    // HP
    const hpPct = h.hpMax > 0 ? h.hp / h.hpMax : 0;
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(pad, pad, barW * hpPct, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(pad, pad, barW, barH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(`HP: ${Math.ceil(h.hp)}/${h.hpMax}`, pad + 4, pad + barH + 14);

    // Stamina
    const enPct = h.enMax > 0 ? h.en / h.enMax : 0;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(pad, pad + 30, barW * enPct, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(pad, pad + 30, barW, barH);
    ctx.fillStyle = "#fff";
    ctx.fillText(
      `Stamina: ${Math.ceil(h.en)}/${h.enMax}`,
      pad + 4,
      pad + 30 + barH + 14
    );
  }

  function drawMinimap(ctx, c) {
    const cssW = c.getBoundingClientRect().width;
    const s = mini.current.scale;
    const mw = mini.current.w,
      mh = mini.current.h;
    const pad = 12;
    const x0 = cssW - mw - pad;
    const y0 = pad;

    ctx.save();
    ctx.fillStyle = "rgba(2,6,23,0.85)";
    ctx.fillRect(x0 - 6, y0 - 6, mw + 12, mh + 12);

    ctx.save();
    ctx.beginPath();
    for (const sgm of world.current.walls) {
      ctx.moveTo(x0 + sgm.x1 * s, y0 + sgm.y1 * s);
      ctx.lineTo(x0 + sgm.x2 * s, y0 + sgm.y2 * s);
    }
    ctx.strokeStyle = "rgba(148,163,184,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const fog = fogCanvasRef.current;
    if (fog) {
      ctx.save();
      ctx.drawImage(fog, 0, 0, fog.width, fog.height, x0, y0, mw, mh);
      ctx.restore();
    }

    const p = playerRef.current;
    ctx.beginPath();
    ctx.arc(x0 + p.x * s, y0 + p.y * s, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();

    for (const e of world.current.enemies) {
      const isChasing = e.state === "chase";
      let miniColor;
      if (e.type === "sentinela") {
        miniColor = isChasing ? "rgba(239,68,68,0.9)" : "rgba(59,130,246,0.9)"; // vermelho / azul
      } else {
        miniColor = isChasing ? "rgba(239,68,68,0.9)" : "rgba(245,158,11,0.9)"; // vermelho / laranja
      }
      ctx.beginPath();
      ctx.arc(x0 + e.x * s, y0 + e.y * s, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = miniColor;
      ctx.fill();
    }

    ctx.restore();
  }

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          background: "#0b1220",
          border: "2px solid #1f2937",
          borderRadius: 8,
          width: "100%",
          maxWidth: "100%",
        }}
      />
      {/* Checklist de objetivos */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 270, // fica ao lado das barras desenhadas no canvas
          background: "rgba(2,6,23,0.85)",
          color: "#fff",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          lineHeight: 1.4,
          backdropFilter: "blur(2px)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Objetivos</div>
        {objectives.map((o) => (
          <label
            key={o.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <input type="checkbox" checked={o.done} readOnly />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
