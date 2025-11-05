// src/explorador/GameCanvas.jsx

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildWorldFromLevel } from "./mapLoader";
import levels from "./maps/levels.json";
import { stepProjectiles } from "./engine/CollisionManager";
import coloniaService from "../services/coloniaService";

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
  gridSize: 40, // <-- novo
  bulletSpeed: 560,
  bulletRadius: 4,
  bulletLife: 1.2, // segundos
  bulletCooldownMs: 140, // cadência
  bulletMaxDist: 650,
  bulletDamage: 4,
  enemyHitChaseMs: 4500, // quanto tempo o inimigo persegue/investiga após levar tiro sem ver
  searchArcDeg: 180, // abertura da “olhada” (180°)
  searchTurnDegPerSec: 45, // menos giro (estava alto)
  searchMaxTimeMs: 5000, // limite de segurança (mantém)
  searchDwellMs: 700, // PAUSA no fim de cada lado (novo)

  emote: {
    lifeMs: 750, // duração total
    riseV0: -185, // velocidade inicial para cima
    gravity: 520, // gravidade da “quicada”
    hoverMs: 150, // tempo de hover no topo
    fadeMs: 160, // fade final
    offsetY: 18, // distância acima da cabeça
    minCooldownMs: 180, // evita spam
  },
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

/*
visao: aumenta raio da bolha, FOV e alcance do cone.

agilidade: aumenta velocidade e boost do sprint.

folego: aumenta stamina máx., regen e reduz gasto do sprint.

furtividade: reduz “barulho” ao andar (audição dos inimigos) e dá um grace maior ao perder LOS.

resiliencia: aumenta HP máx. e reduz dano recebido.
*/

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

// === XP helpers (mesma lógica do menu) ===
function calcXpNext(level = 1) {
  const base = 10;
  return Math.max(10, Math.round(base * Math.pow(2, Math.max(0, level - 1))));
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

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

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

// ====== GRID + A* ======
function segIntersectsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
  const INS = 0,
    L = 1,
    R = 2,
    B = 4,
    T = 8;
  const out = (x, y) =>
    (x < rx ? L : x > rx + rw ? R : 0) | (y < ry ? B : y > ry + rh ? T : 0);
  let c1 = out(x1, y1),
    c2 = out(x2, y2);
  while (true) {
    if (!(c1 | c2)) return true;
    if (c1 & c2) return false;
    const c = c1 ? c1 : c2;
    let x = 0,
      y = 0;
    if (c & T) {
      x = x1 + (x2 - x1) * ((ry + rh - y1) / (y2 - y1));
      y = ry + rh;
    } else if (c & B) {
      x = x1 + (x2 - x1) * ((ry - y1) / (y2 - y1));
      y = ry;
    } else if (c & R) {
      y = y1 + (y2 - y1) * ((rx + rw - x1) / (x2 - x1));
      x = rx + rw;
    } else {
      y = y1 + (y2 - y1) * ((rx - x1) / (x2 - x1));
      x = rx;
    }
    if (c === c1) {
      x1 = x;
      y1 = y;
      c1 = out(x1, y1);
    } else {
      x2 = x;
      y2 = y;
      c2 = out(x2, y2);
    }
  }
}
function cellBlocked(ci, cj, gs, walls, pad) {
  const rx = ci * gs - pad,
    ry = cj * gs - pad,
    rw = gs + 2 * pad,
    rh = gs + 2 * pad;
  for (const s of walls)
    if (segIntersectsAABB(s.x1, s.y1, s.x2, s.y2, rx, ry, rw, rh)) return true;
  return false;
}
function buildNavGrid(mapW, mapH, walls, agentRadius, gs) {
  const cols = Math.ceil(mapW / gs),
    rows = Math.ceil(mapH / gs),
    pad = Math.max(2, agentRadius + 3);
  const data = Array.from({ length: rows }, (_, j) =>
    Array.from({ length: cols }, (_, i) =>
      cellBlocked(i, j, gs, walls, pad) ? 1 : 0
    )
  );
  return { cols, rows, gs, data };
}
const clampi = (v, a, b) => Math.max(a, Math.min(b, v));
const ptToCell = (x, y, gs) => ({
  i: Math.floor(x / gs),
  j: Math.floor(y / gs),
});
const cellCenter = (i, j, gs) => ({
  x: i * gs + gs * 0.5,
  y: j * gs + gs * 0.5,
});

function aStar(grid, start, goal) {
  const { data, cols, rows } = grid,
    key = (i, j) => i + "_" + j;
  const inB = (i, j) =>
    i >= 0 && j >= 0 && i < cols && j < rows && data[j][i] === 0;
  const h = (i, j) => Math.abs(i - goal.i) + Math.abs(j - goal.j);
  const open = [],
    came = new Map(),
    g = new Map(),
    f = new Map(),
    sk = key(start.i, start.j);
  g.set(sk, 0);
  f.set(sk, h(start.i, start.j));
  open.push([f.get(sk), start.i, start.j]);
  const push = (fi, i, j) => {
    open.push([fi, i, j]);
    open.sort((a, b) => a[0] - b[0]);
  };
  while (open.length) {
    const [_, i, j] = open.shift();
    if (i === goal.i && j === goal.j) {
      const path = [];
      let ci = i,
        cj = j,
        cur = key(ci, cj);
      while (came.has(cur)) {
        const [pi, pj] = came.get(cur);
        path.push([ci, cj]);
        ci = pi;
        cj = pj;
        cur = key(ci, cj);
      }
      path.push([start.i, start.j]);
      path.reverse();
      return path;
    }
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di,
        nj = j + dj;
      if (!inB(ni, nj)) continue;
      const ck = key(i, j),
        nk = key(ni, nj),
        tentative = (g.get(ck) ?? Infinity) + 1;
      if (tentative < (g.get(nk) ?? Infinity)) {
        came.set(nk, [i, j]);
        g.set(nk, tentative);
        const nf = tentative + h(ni, nj);
        f.set(nk, nf);
        if (!open.some((e) => e[1] === ni && e[2] === nj)) push(nf, ni, nj);
      }
    }
  }
  return null;
}
const los = (x1, y1, x2, y2, segs) => hasLineOfSight(x1, y1, x2, y2, segs);
function smoothPathToPoints(grid, raw, walls) {
  if (!raw || !raw.length) return [];
  const pts = raw.map(([i, j]) => cellCenter(i, j, grid.gs));
  const out = [pts[0]];
  let anchor = pts[0];
  for (let k = 2; k < pts.length; k++) {
    const cand = pts[k];
    if (!los(anchor.x, anchor.y, cand.x, cand.y, walls)) {
      out.push(pts[k - 1]);
      anchor = pts[k - 1];
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function sumRewardsFromCollected(rewards = [], collectedSet) {
  return rewards.reduce(
    (acc, r, idx) => {
      if (!collectedSet.has(idx)) return acc;
      if (Number.isFinite(r.colono)) acc.colonos += r.colono;
      if (Number.isFinite(r.comida)) acc.comida += r.comida;
      if (Number.isFinite(r.minerais)) acc.minerais += r.minerais;
      return acc;
    },
    { colonos: 0, comida: 0, minerais: 0 }
  );
}

function rotateTowards(current, target, maxStep) {
  const d = angleBetween(current, target); // b - a normalizado
  if (Math.abs(d) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(d) * maxStep);
}

function spawnEmote(e, kind = "?") {
  const now = performance.now();
  if ((e.__emoteCooldown || 0) > now) return; // anti-spam

  e.__emote = {
    kind,
    y: 0,
    vy: CFG.emote.riseV0,
    bornAt: now,
    phase: "rise", // rise -> hover -> fall -> done
    alpha: 1,
  };
  e.__emoteCooldown = now + CFG.emote.minCooldownMs;
}

function stepEmote(e, dt) {
  const emo = e.__emote;
  if (!emo) return;

  const now = performance.now();
  const age = now - emo.bornAt;

  // fases simples: sobe um pouco, para, cai, some
  if (emo.phase === "rise") {
    emo.vy += CFG.emote.gravity * dt;
    emo.y += emo.vy * dt;
    if (emo.vy >= 0) {
      // começou a “parar”
      emo.phase = "hover";
      emo.hoverUntil = now + CFG.emote.hoverMs;
      emo.vy = 0;
    }
  } else if (emo.phase === "hover") {
    if (now >= emo.hoverUntil) {
      emo.phase = "fall";
      emo.vy = 60; // cai suave
    }
  } else if (emo.phase === "fall") {
    emo.vy += CFG.emote.gravity * 0.6 * dt;
    emo.y += emo.vy * dt;
  }

  // fade out perto do fim
  const t =
    1 -
    Math.max(0, age - (CFG.emote.lifeMs - CFG.emote.fadeMs)) / CFG.emote.fadeMs;
  emo.alpha = Math.max(0, Math.min(1, t));

  if (age >= CFG.emote.lifeMs || emo.alpha <= 0) {
    e.__emote = null; // terminou
  }
}

function drawEmote(ctx, e) {
  const emo = e.__emote;
  if (!emo) return;

  const x = e.x;
  const y = e.y - e.r - CFG.emote.offsetY + emo.y;

  ctx.save();
  ctx.globalAlpha = emo.alpha;

  // Balão simples
  const w = 20,
    h = 18,
    r = 6;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + r, y - h / 2);
  ctx.arcTo(x + w / 2, y - h / 2, x + w / 2, y + h / 2, r);
  ctx.arcTo(x + w / 2, y + h / 2, x - w / 2, y + h / 2, r);
  ctx.arcTo(x - w / 2, y + h / 2, x - w / 2, y - h / 2, r);
  ctx.arcTo(x - w / 2, y - h / 2, x + w / 2, y - h / 2, r);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();

  // “rabinho” do balão
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x - 4, y + h / 2 + 6);
  ctx.lineTo(x + 2, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.stroke();

  // “?” central
  ctx.font = "bold 14px Arial";
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emo.kind, x, y + 1);

  ctx.restore();
}

// #region Inicio do Jogo

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
  const navGridRef = useRef(null);
  const lastReplanAtRef = useRef(0); // limita replanejamentos/s
  const projectilesRef = useRef([]); // {x,y,vx,vy,r,life,travel,maxDist,dead}
  const lastShotAtRef = useRef(0);
  const navigate = useNavigate();
  const finishedRef = useRef(false);
  const baseXpRef = useRef(explorer?.xp ?? 0);
  const [sessionXp, setSessionXp] = useState(0);
  const sessionXpRef = useRef(0);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState({
    xpGained: 0,
    done: [],
    total: 0,
  });
  const collectedRewardsRef = useRef(new Set());

  // Progresso de nível local (visual)
  const levelRef = useRef(Number(explorer?.level) || 1); // nível atual (visual)
  const xpInLevelRef = useRef(Number(explorer?.xp) || 0); // xp acumulado dentro do nível (visual)

  // Partículas de "LEVEL UP!"
  const levelUpParticlesRef = useRef([]); // {x,y,vx,vy,life,age,sz}
  function spawnLevelUpBurst(x, y) {
    const N = 36;
    for (let i = 0; i < N; i++) {
      const ang = (Math.PI * 2 * i) / N + (Math.random() * 0.8 - 0.4);
      const spd = 70 + Math.random() * 110; // velocidade inicial
      levelUpParticlesRef.current.push({
        x,
        y,
        vx: Math.cos(ang) * spd * 0.35,
        vy: -Math.abs(Math.sin(ang) * spd) * 0.5 - (60 + Math.random() * 40),
        life: 0.9 + Math.random() * 0.5, // duração
        age: 0,
        sz: 0.8 + Math.random() * 0.8, // tamanho bem menor (0.8–1.6)
      });
    }
  }

  console.log(explorerId);

  // atualiza o explorador certo dentro de estadoAtual.exploradores
  const updateExplorerInEstado = useCallback(
    (patch) => {
      if (!estadoAtual || !Array.isArray(estadoAtual.exploradores)) return;
      const novos = estadoAtual.exploradores.map((ex) =>
        ex.id === explorerId ? { ...ex, ...patch, updatedAt: Date.now() } : ex
      );
      onEstadoChange?.({ ...estadoAtual, exploradores: novos });
    },
    [estadoAtual, explorerId, onEstadoChange]
  );

  // mapa atual (vem do JSON)
  const mapSizeRef = useRef({ w: 1600, h: 900 }); // atualizado pelo level
  const world = useRef({ walls: [], enemies: [], pickups: [], exits: [] });
  const playerRef = useRef({ x: 140, y: 140, r: 12, dir: 0, vx: 0, vy: 0 });
  const pressed = useRef({});
  const cam = useRef({ x: 0, y: 0, w: 0, h: 0 });

  function planPathForEnemy(e, tx, ty) {
    const grid = navGridRef.current;
    if (!grid) return [];
    const gs = grid.gs;

    // snap para célula livre mais próxima
    const snapFree = (ci, cj) => {
      const seen = new Set([ci + "_" + cj]);
      const q = [[ci, cj]];
      while (q.length) {
        const [i, j] = q.shift();
        if (
          i >= 0 &&
          j >= 0 &&
          i < grid.cols &&
          j < grid.rows &&
          grid.data[j][i] === 0
        )
          return { i, j };
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ni = i + di,
            nj = j + dj,
            k = ni + "_" + nj;
          if (!seen.has(k)) {
            seen.add(k);
            q.push([ni, nj]);
          }
        }
      }
      return null;
    };

    let s = ptToCell(e.x, e.y, gs),
      g = ptToCell(tx, ty, gs);
    s.i = clampi(s.i, 0, grid.cols - 1);
    s.j = clampi(s.j, 0, grid.rows - 1);
    g.i = clampi(g.i, 0, grid.cols - 1);
    g.j = clampi(g.j, 0, grid.rows - 1);
    if (grid.data[s.j][s.i] === 1) {
      const ss = snapFree(s.i, s.j);
      if (!ss) return [];
      s = ss;
    }
    if (grid.data[g.j][g.i] === 1) {
      const gg = snapFree(g.i, g.j);
      if (!gg) return [];
      g = gg;
    }

    const raw = aStar(grid, s, g);
    if (!raw) return [];
    return smoothPathToPoints(grid, raw, world.current.walls);
  }

  // minimapa/fog
  const mini = useRef({ scale: 0.12, w: 0, h: 0 });
  const fogCanvasRef = useRef(null);

  const [levelReady, setLevelReady] = useState(false);

  // 🔎 Deriva valores do explorador (usa os valores persistidos no objeto)
  const toNum = (v, d) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const hpCurrent0 = toNum(explorer?.hp?.current, 10);
  const hpMax0 = toNum(explorer?.hp?.max, 10);
  const enCurrent0 = toNum(explorer?.stamina?.current, 10);
  const enMax0 = toNum(explorer?.stamina?.max, 10);

  const [hud, setHud] = useState({
    hp: hpCurrent0,
    hpMax: hpMax0,
    en: enCurrent0,
    enMax: enMax0,
    keys: [],
  });

  const [playerXp, setPlayerXp] = useState(explorer?.xp ?? 0);
  const playerXpRef = useRef(playerXp);
  useEffect(() => {
    playerXpRef.current = playerXp;
  }, [playerXp]);

  const hudRef = useRef(hud);
  useEffect(() => {
    hudRef.current = hud;
  }, [hud]);

  const mods = useMemo(
    () => calcSkillMods(explorer?.skills),
    [explorer?.skills]
  );

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

  // Mantém o HUD em linha com os valores persistidos no explorer (sem bônus)
  useEffect(() => {
    setHud((h) => {
      const hpMax = toNum(explorer?.hp?.max, h.hpMax);
      const enMax = toNum(explorer?.stamina?.max, h.enMax);
      const hpCur = Math.min(toNum(explorer?.hp?.current, h.hp), hpMax);
      const enCur = Math.min(toNum(explorer?.stamina?.current, h.en), enMax);
      return { ...h, hpMax, enMax, hp: hpCur, en: enCur };
    });
  }, [
    explorer?.hp?.max,
    explorer?.hp?.current,
    explorer?.stamina?.max,
    explorer?.stamina?.current,
  ]);

  // objetivos básicos do minigame
  const [objectives, setObjectives] = useState([]);

  useEffect(() => {
    collectedRewardsRef.current.clear();
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

      const hpBase =
        typeof e.hp === "number" ? e.hp : kind === "sentinela" ? 20 : 12;
      const xpBase =
        typeof e.xp === "number" ? e.xp : kind === "sentinela" ? 12 : 6;

      console.log("xpBase");
      console.log(xpBase);

      return {
        ...e,
        type: kind,
        waypoints: wps,
        home,
        state: e.state ?? initState,
        __guardBaseDir: typeof e.dir === "number" ? e.dir : dir,
        __spinDir: 1,
        targetIdx,
        dir,
        hp: hpBase,
        hpMax: hpBase,
        xp: xpBase,
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

    navGridRef.current = buildNavGrid(
      mapSizeRef.current.w,
      mapSizeRef.current.h,
      world.current.walls,
      12, // raio do inimigo
      CFG.gridSize
    );

    // aplica no mundo
    world.current.pickups = rewardPickups;

    setLevelReady(true);
    sessionXpRef.current = 0;
    setSessionXp(0);
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
    const kd = (e) => {
      const k = e.key.toLowerCase();
      pressed.current[k] = true;
    };
    const ku = (e) => {
      const k = e.key.toLowerCase();
      pressed.current[k] = false;
      if (e.key === "Shift") sprintLockedRef.current = false; // destrava sprint
    };
    const onBlur = () => {
      pressed.current = {}; // evita tecla "presa" ao trocar de aba/janela
      sprintLockedRef.current = false;
    };

    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", onBlur);
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

  // Mouse: atirar com botão esquerdo
  useEffect(() => {
    const onDown = (e) => {
      if (e.button !== 0) return; // só botão esquerdo
      const now = performance.now();
      if (now - (lastShotAtRef.current || 0) < CFG.bulletCooldownMs) return;
      lastShotAtRef.current = now;

      const c = canvasRef.current;
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left + cam.current.x;
      const my = e.clientY - r.top + cam.current.y;

      const p = playerRef.current;
      const ang = Math.atan2(my - p.y, mx - p.x);

      const vx = Math.cos(ang) * CFG.bulletSpeed;
      const vy = Math.sin(ang) * CFG.bulletSpeed;

      projectilesRef.current.push({
        x: p.x + Math.cos(ang) * (p.r + 6),
        y: p.y + Math.sin(ang) * (p.r + 6),
        vx,
        vy,
        r: CFG.bulletRadius,
        life: CFG.bulletLife,
        travel: 0,
        maxDist: CFG.bulletMaxDist,
        dead: false,
      });
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
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
        // entra/permanece em chase
        e.state = "chase";
        e.lastSeenPlayerAt = { x: p.x, y: p.y, t: performance.now() };
        e.__lostT = 0;
        e.__investigate = null;
      } else {
        // Sentinela em guard pode sair para investigar um som
        if (canHear) {
          const now = performance.now();
          e.__lastHeardAt = now;
          e.__investigate = { x: p.x, y: p.y, until: now + 3500 }; // 3.5s de interesse
          if (e.type === "sentinela" && e.state === "guard") e.state = "return";
        }

        // Se estava em chase e perdeu o player por um tempinho => return
        if (e.state === "chase") {
          e.__lostT = (e.__lostT ?? 0) + dt;
          if (e.__lostT > 0.3 + mods.lostGraceAdd) {
            e.state = "return";
            if (e.type === "patrulheiro") {
              e.anchorIdx = nearestWaypointIndex(e);
              const wp = e.waypoints[e.anchorIdx];
              e.__path = planPathForEnemy(e, wp.x, wp.y);
            } else {
              e.__path = planPathForEnemy(e, e.home.x, e.home.y);
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
          const seesNow = hasLineOfSight(
            e.x,
            e.y,
            p.x,
            p.y,
            world.current.walls
          );
          if (!seesNow) {
            // prepara estado de busca
            const tgt = e.lastSeenPlayerAt || {
              x: p.x,
              y: p.y,
              t: performance.now(),
            };
            e.state = "search";
            e.__search = {
              x: tgt.x,
              y: tgt.y,
              phase: "going", // going -> sweeping
              baseDir: e.dir, // será ajustado ao chegar
              sweepDir: 1, // alterna esquerda/direita
              startedAt: performance.now(),
              lastFlipAt: performance.now(),
            };
            spawnEmote(e, "?");
            e.__path = planPathForEnemy(e, tgt.x, tgt.y);
            e.__detourT = 0;
            e.__detourDir = null;
            e.__wpBlockedT = 0;
            break;
          }

          // ainda vê -> segue perseguindo normalmente
          const desiredDir = Math.atan2(p.y - e.y, p.x - e.x);
          e.dir = desiredDir;
          moveTowards(e, p.x, p.y, CFG.chaseSpeed, dt);

          if (forwardBlocked(e, world.current.walls, e.r + 10)) {
            const detour = pickDetourDir(desiredDir, e, world.current.walls);
            e.dir = detour;
            e.x += Math.cos(e.dir) * CFG.chaseSpeed * dt;
            e.y += Math.sin(e.dir) * CFG.chaseSpeed * dt;
          }
          break;
        }

        case "search": {
          // se recobrar visão em qualquer momento, volta a chase
          const seesNow =
            Math.hypot(p.x - e.x, p.y - e.y) <= CFG.enemyViewDist &&
            Math.abs(angleBetween(e.dir, Math.atan2(p.y - e.y, p.x - e.x))) <=
              toRad(CFG.enemyFovDeg) / 2 &&
            hasLineOfSight(e.x, e.y, p.x, p.y, world.current.walls);

          if (seesNow) {
            e.state = "chase";
            e.lastSeenPlayerAt = { x: p.x, y: p.y, t: performance.now() };
            e.__search = null;
            e.__path = [];
            break;
          }

          const S = e.__search;
          if (!S) {
            // fallback de segurança
            e.state = "return";
            break;
          }

          // 1) Ir até o ponto onde perdeu de vista
          if (S.phase === "going") {
            const tx = S.x,
              ty = S.y;

            if (hasLineOfSight(e.x, e.y, tx, ty, world.current.walls)) {
              e.__path = [];
              const ndir = Math.atan2(ty - e.y, tx - e.x);
              e.dir = ndir;
              moveTowards(e, tx, ty, CFG.enemySpeed, dt);
            } else {
              e.__path =
                e.__path && e.__path.length
                  ? e.__path
                  : planPathForEnemy(e, tx, ty);

              const now = performance.now();
              if (
                (!e.__path ||
                  !e.__path.length ||
                  forwardBlocked(e, world.current.walls, e.r + 10)) &&
                now - (lastReplanAtRef.current || 0) > 250
              ) {
                e.__path = planPathForEnemy(e, tx, ty);
                lastReplanAtRef.current = now;
              }

              if (e.__path && e.__path.length) {
                const node = e.__path[0];
                const ndir = Math.atan2(node.y - e.y, node.x - e.x);
                e.dir = ndir;
                moveTowards(e, node.x, node.y, CFG.enemySpeed, dt);
                if (Math.hypot(node.x - e.x, node.y - e.y) < 8)
                  e.__path.shift();
              } else {
                const ndir = Math.atan2(ty - e.y, tx - e.x);
                e.dir = pickDetourDir(ndir, e, world.current.walls);
                e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
                e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;
              }
            }

            // Chegou no ponto de perda de vista?
            if (Math.hypot(S.x - e.x, S.y - e.y) < 10) {
              S.phase = "sweeping";
              S.startedAt = performance.now();
              S.baseDir = e.dir; // centraliza a varredura no olhar atual
              S.sweepDir = 1;
              e.__path = [];
              spawnEmote(e, "?"); // opcional: outro “?”
            }
          }

          // 2) Varredura de 180° (olhada)
          else if (S.phase === "sweeping") {
            const half = toRad(CFG.searchArcDeg) / 2;
            const turnStep = toRad(CFG.searchTurnDegPerSec) * dt;

            // Inicializa sequência uma única vez
            if (!S.seq) {
              S.seq = [
                { phase: "sweepL", target: S.baseDir - half },
                {
                  phase: "holdL",
                  until: performance.now() + (CFG.searchDwellMs || 0),
                },
                { phase: "sweepR", target: S.baseDir + half },
                {
                  phase: "holdR",
                  until: performance.now() + (CFG.searchDwellMs || 0),
                },
              ];
              S.seqIdx = 0;
            }

            const step = S.seq[S.seqIdx];

            // 1) varrer para um alvo angular
            if (step.phase === "sweepL" || step.phase === "sweepR") {
              const targetDir = step.target;
              e.dir = rotateTowards(e.dir, targetDir, turnStep);

              // Chegou no alvo? avança para a próxima etapa e cria janela de "hold"
              if (e.dir === targetDir) {
                S.seqIdx++;
                if (
                  S.seq[S.seqIdx] &&
                  S.seq[S.seqIdx].phase.startsWith("hold")
                ) {
                  S.seq[S.seqIdx].until =
                    performance.now() + (CFG.searchDwellMs || 0);
                }
              }
            }
            // 2) pequenas pausas nas extremidades
            else if (step.phase === "holdL" || step.phase === "holdR") {
              if (performance.now() >= step.until) {
                S.seqIdx++;
              }
            }

            // 3) terminou a sequência? voltar ao posto
            if (S.seqIdx >= S.seq.length) {
              e.__search = null;
              e.__path = [];
              // volta ao comportamento base
              if (e.type === "patrulheiro") {
                e.state = "return";
                e.anchorIdx = nearestWaypointIndex(e);
              } else {
                e.state = "return"; // sentinela volta ao home no 'return'
              }
            }

            // 4) timeout de segurança da busca (mantém seu guarda-chuva)
            if (performance.now() - S.startedAt > CFG.searchMaxTimeMs) {
              e.__search = null;
              e.__path = [];
              e.state = "return";
            }
          }

          break;
        }

        case "return": {
          // alvo: waypoint âncora (patrulheiro) OU home (sentinela)
          const now = performance.now();
          const hasInvestigate = e.__investigate && now < e.__investigate.until;
          const target = hasInvestigate
            ? e.__investigate
            : e.type === "patrulheiro"
            ? e.waypoints[e.anchorIdx ?? nearestWaypointIndex(e)]
            : e.home;
          const tx = target.x,
            ty = target.y;

          // se LOS direta ao alvo, abandona path e vai direto
          if (hasLineOfSight(e.x, e.y, tx, ty, world.current.walls)) {
            e.__path = [];
            const desiredDir = Math.atan2(ty - e.y, tx - e.x);
            e.dir = desiredDir;
            moveTowards(e, tx, ty, CFG.enemySpeed, dt);
          } else {
            // seguir caminho
            e.__path =
              e.__path && e.__path.length
                ? e.__path
                : planPathForEnemy(e, tx, ty);

            // limite de replanejamentos (ex.: 4/s)
            const now = performance.now();
            if (
              (!e.__path ||
                !e.__path.length ||
                forwardBlocked(e, world.current.walls, e.r + 10)) &&
              now - (lastReplanAtRef.current || 0) > 250
            ) {
              e.__path = planPathForEnemy(e, tx, ty);
              lastReplanAtRef.current = now;
            }

            if (e.__path && e.__path.length) {
              const node = e.__path[0];
              const ndir = Math.atan2(node.y - e.y, node.x - e.x);
              e.dir = ndir;
              moveTowards(e, node.x, node.y, CFG.enemySpeed, dt);
              if (Math.hypot(node.x - e.x, node.y - e.y) < 8) e.__path.shift();
            } else {
              // fallback mínimo: pequeno desvio
              const desiredDir = Math.atan2(ty - e.y, tx - e.x);
              e.dir = pickDetourDir(desiredDir, e, world.current.walls);
              e.x += Math.cos(e.dir) * CFG.enemySpeed * dt;
              e.y += Math.sin(e.dir) * CFG.enemySpeed * dt;
            }
          }

          // converge
          if (Math.hypot(tx - e.x, ty - e.y) < 10) {
            if (hasInvestigate) {
              e.__investigate = null; // limpa o ponto investigado
              if (e.type === "sentinela") {
                e.state = "guard"; // volta a guardar depois de checar o som
                e.__guardBaseDir = e.dir;
              } else {
                e.state = "return"; // patrulheiro segue para o anchor/home
              }
              e.__path = [];
              break;
            }
            if (e.type === "patrulheiro") {
              e.state = "patrol";
              e.targetIdx = e.anchorIdx ?? nearestWaypointIndex(e);
            } else {
              e.state = "guard";
              e.__guardBaseDir = e.dir; // <-- adicione isto para centralizar o sweep atual
            }
            e.__path = [];
          }
          break;
        }
      }

      // mantém o "?" pulando enquanto estiver em SEARCH
      if (e.state === "search") {
        // se a animação terminou (ou nunca começou), tenta respawnar
        if (!e.__emote) {
          spawnEmote(e, "?"); // respeita minCooldownMs
        }
      } else {
        // saiu do search => para (limpa qualquer emote pendente)
        if (e.__emote) e.__emote = null;
        // (opcional) também pode limpar e.__emoteCooldown se quiser
      }

      // push-out iterativo (3x) para garantir desencaixe
      for (let k = 0; k < 3; k++)
        circleWallPushOut(e, e.r, world.current.walls);

      // anti-trava/steering só para quem PODE mover
      const isSweeping =
        e.state === "search" && e.__search?.phase === "sweeping";

      // anti-trava/steering só para quem PODE mover (e não está varrendo)
      if (!(e.type === "sentinela" && e.state === "guard") && !isSweeping) {
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

    // === projéteis ===
    // === projéteis ===
    if (projectilesRef.current.length) {
      // snapshot de HP para detectar quem levou tiro neste frame
      const prevHp = world.current.enemies.map((e) =>
        Number.isFinite(e.hp) ? e.hp : Infinity
      );

      // AVANÇA projéteis + aplica dano/colisão
      const res = stepProjectiles({
        projectiles: projectilesRef.current,
        walls: world.current.walls,
        enemies: world.current.enemies,
        dt,
        bulletDamage: CFG.bulletDamage,
      });

      // Se alguém levou tiro sem ver o player, entra em "return" com __investigate; se vê, "chase"
      const nowMs = performance.now();
      const chaseWindow = CFG.enemyHitChaseMs ?? 4000;
      const px = p.x,
        py = p.y;

      world.current.enemies.forEach((e, i) => {
        const before = prevHp[i];
        const after = Number.isFinite(e.hp) ? e.hp : before;
        if (after < before) {
          const toPlayer = Math.atan2(py - e.y, px - e.x);
          const dist = Math.hypot(px - e.x, py - e.y);
          const sees =
            dist <= CFG.enemyViewDist &&
            Math.abs(angleBetween(e.dir, toPlayer)) <=
              toRad(CFG.enemyFovDeg) / 2 &&
            hasLineOfSight(e.x, e.y, px, py, world.current.walls);

          if (sees) {
            e.state = "chase";
            e.__lostT = 0;
            e.__investigate = null;
            e.lastSeenPlayerAt = { x: px, y: py, t: nowMs };
          } else {
            e.__lastHeardAt = nowMs;
            e.__investigate = { x: px, y: py, until: nowMs + chaseWindow };
            e.state = "return"; // 'return' já caminha até __investigate
            e.__path = planPathForEnemy(e, px, py);
            e.__detourT = 0;
            e.__detourDir = null;
            e.__wpBlockedT = 0;
          }
        }
      });

      // XP + remover inimigos mortos
      if (res.killed && res.killed.length) {
        const gained = res.killed.reduce((acc, k) => acc + (k.xp || 0), 0);
        if (gained > 0) {
          setSessionXp((v) => {
            const nv = v + gained;
            sessionXpRef.current = nv;
            return nv;
          });
          setPlayerXp((xp0) => {
            const nxp = xp0 + gained;
            playerXpRef.current = nxp;
            updateExplorerInEstado({ xp: nxp });
            return nxp;
          });

          xpInLevelRef.current += gained;
          while (xpInLevelRef.current >= calcXpNext(levelRef.current)) {
            xpInLevelRef.current -= calcXpNext(levelRef.current);
            levelRef.current += 1;
            const ppos = playerRef.current;
            spawnLevelUpBurst(ppos.x, ppos.y - ppos.r);
          }
        }

        const deadIdx = new Set(res.killed.map((k) => k.idx));
        world.current.enemies = world.current.enemies.filter(
          (_, idx) => !deadIdx.has(idx)
        );
      }

      // limpa projéteis mortos
      projectilesRef.current = projectilesRef.current.filter((b) => !b.dead);
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
          if (!finishedRef.current) {
            finishedRef.current = true;
            // marca objetivo de saída, se houver
            setObjectives((list) =>
              list.map((o) => (o.id === "exit" ? { ...o, done: true } : o))
            );
            // bônus de energia (opcional)
            onEstadoChange?.({
              ...estadoAtual,
              energia: Math.round((estadoAtual?.energia ?? 0) + 5),
            });

            // calcula resultados
            const xpGained = sessionXpRef.current;
            const finalXp = (baseXpRef.current ?? 0) + xpGained;
            const collected = collectedRewardsRef.current;
            const done = objectives.filter(
              (o, i) => collected.has(i) || o.id === "exit"
            );
            const rewardTotals = sumRewardsFromCollected(
              mission?.recompensas ?? [],
              collected
            );
            const total = objectives.length; // ou: (mission?.recompensas?.length ?? objectives.length)

            // 🔽 remove a missão concluída da fila (usa filaItem.id; fallback missionId)
            const removerDaFila = (m) => {
              const sameId = filaItem?.id
                ? m.id === filaItem.id
                : m.id === missionId;
              // se houver mais de uma com mesmo id, garante pelo explorerId também
              const sameExplorer = explorerId
                ? m.explorerId === explorerId
                : true;
              return !(sameId && sameExplorer);
            };
            const novaFila = (estadoAtual?.filaMissoes || []).filter(
              removerDaFila
            );

            // ✅ Aplica localmente no estadoAtual
            const novoEstado = {
              ...estadoAtual,
              populacao: {
                ...estadoAtual?.populacao,
                colonos:
                  (estadoAtual?.populacao?.colonos || 0) + rewardTotals.colonos,
              },
              comida: (estadoAtual?.comida || 0) + rewardTotals.comida,
              minerais: (estadoAtual?.minerais || 0) + rewardTotals.minerais,
              filaMissoes: novaFila,
              updatedAt: Date.now(),
            };

            onEstadoChange?.(novoEstado);

            // mostra diálogo
            setResultData({ xpGained, done, total });
            setShowResult(true);

            // sincroniza o EXPLORADOR correto no backend
            if (estadoAtual?._id && explorerId) {
              coloniaService
                .atualizarExplorador(estadoAtual._id, explorerId, {
                  xp: finalXp,
                  status: "disponivel",
                  missionId: null,
                  updatedAt: Date.now(),
                })
                .catch((err) =>
                  console.error("Erro ao sincronizar explorador:", err)
                );
              // reflete localmente o novo XP no estado atual
              updateExplorerInEstado({ xp: finalXp });
            }

            // ✅ Persiste as recompensas no backend
            if (estadoAtual?._id) {
              coloniaService
                .atualizarColonia(estadoAtual._id, {
                  populacao: novoEstado.populacao,
                  comida: novoEstado.comida,
                  minerais: novoEstado.minerais,
                  filaMissoes: novoEstado.filaMissoes,
                  updatedAt: novoEstado.updatedAt,
                })
                .catch((err) =>
                  console.error(
                    "Erro ao sincronizar recompensas da missão:",
                    err
                  )
                );
            }
          }
        }
      }
    }

    // === Partículas de level-up ===
    if (levelUpParticlesRef.current.length) {
      const g = 220; // gravidade p/ cair devagar
      levelUpParticlesRef.current = levelUpParticlesRef.current.filter((p) => {
        p.age += dt;
        if (p.age >= p.life) return false;
        p.vy += g * dt * 0.25; // leve gravidade (ainda "sobem" no início)
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return true;
      });
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
    collectedRewardsRef.current.add(pk.rewardId);
  }

  // #region DRAW
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

      // ...
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

      // HP bar Inimigos
      if (typeof e.hp === "number" && typeof e.hpMax === "number") {
        const bw = 24,
          bh = 4,
          ox = -12,
          oy = -e.r - 10;
        const pct = Math.max(0, Math.min(1, e.hp / e.hpMax));
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.x + ox - 1, e.y + oy - 1, bw + 2, bh + 2);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(e.x + ox, e.y + oy, bw * pct, bh);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.strokeRect(e.x + ox, e.y + oy, bw, bh);
      }

      drawEmote(ctx, e); // Emoji em cima do inimigo

      // DEBUG: desenhar caminho
      if (e.__path && e.__path.length) {
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        for (const n of e.__path) ctx.lineTo(n.x, n.y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(59,130,246,0.6)";
        ctx.stroke();
      }
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

    // === Partículas de "LEVEL UP!" ===
    if (levelUpParticlesRef.current.length) {
      for (const pz of levelUpParticlesRef.current) {
        const t = Math.max(0, Math.min(1, 1 - pz.age / pz.life)); // 1..0
        const alpha = 0.25 + 0.75 * t;
        ctx.beginPath();
        ctx.arc(pz.x, pz.y, pz.sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`; // amarelo dourado
        ctx.fill();
      }

      // pequeno texto "LEVEL UP!" (opcional)
      const last =
        levelUpParticlesRef.current[levelUpParticlesRef.current.length - 1];
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 14px Arial";
      ctx.fillText(
        "LEVEL UP!",
        playerRef.current.x - 34,
        playerRef.current.y - 28
      );
    }

    // Projéteis
    for (const b of projectilesRef.current) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = "#e5e7eb"; // cinza claro
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#0b0b0b";
      ctx.stroke();
    }

    //#region Fim do Mundo
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

  //#region drawHUD
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

    //Mostrar XP
    ctx.fillText(`XP: ${playerXpRef.current}`, pad + 4, pad + 30 + barH + 30);
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

  function closeAndGo() {
    setShowResult(false);
    navigate("/jogo");
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
      +{" "}
      {showResult && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: 420,
              background: "#0b1220",
              color: "#fff",
              border: "1px solid #1f2937",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Missão concluída!
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              <div style={{ marginBottom: 8 }}>
                XP adquirido: <b>{resultData.xpGained}</b>
              </div>
              <div style={{ marginBottom: 8 }}>Objetivos cumpridos:</div>
              <ul style={{ marginLeft: 16, marginBottom: 12 }}>
                {resultData.done.map((o) => (
                  <li key={o.id}>✅ {o.label}</li>
                ))}
                {resultData.done.length === 0 && <li>—</li>}
              </ul>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={closeAndGo}
                style={{
                  background: "#22c55e",
                  color: "#0b0b0b",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  cursor: "pointer",
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
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
