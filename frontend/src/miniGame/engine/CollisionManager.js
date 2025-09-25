// src/engine/CollisionManager.js

import { Projectile } from "../entities/Projectile";
import { tileRows } from "../entities/Tiles";
import { estaNaAreaDeCombate } from "../entities/mapData";

//#region Helpers
// ===================== helpers (gating por frames) ==========================
function normalizeFrames(spec) {
  if (spec == null) return null;
  return Array.isArray(spec) ? spec : [spec];
}

/** Retorna os frames que “disparam” neste tick (suporta array). */
function getTriggeredFramesThisTick(
  entity,
  framesSpec,
  expectedState = "attack"
) {
  const frames = normalizeFrames(framesSpec);
  if (!frames) return { framesNow: ["__free__"], looped: false };

  if (expectedState && entity.state !== expectedState) {
    entity._lastFI = undefined;
    entity._firedFramesCycle = undefined;
    return { framesNow: [], looped: false };
  }

  const fi = entity.frameIndex | 0;
  const prev = entity._lastFI ?? fi;

  let looped = false;
  if (fi < prev) {
    // animação reiniciou
    looped = true;
    entity._firedFramesCycle = undefined;
  }

  if (!entity._firedFramesCycle) entity._firedFramesCycle = new Set();

  const fired = entity._firedFramesCycle;
  const framesNow = [];
  for (const f of frames) {
    if (prev < f && fi >= f && !fired.has(f)) {
      framesNow.push(f);
      fired.add(f);
    }
  }

  entity._lastFI = fi;
  return { framesNow, looped };
}

// Resolve hitFrame: número, array, por-estado, "last", "middle", -1, base 1 opcional
function resolveHitFrames(enemy, state = "attack") {
  // 1) Descobrir quantos frames existem de fato nesse estado
  const count =
    enemy.framesByState?.[state]?.length ??
    enemy.animacoes?.[state]?.frameCount ??
    enemy.frames?.length ??
    0;

  // 2) Pegar spec de forma robusta (prefira config > instance)
  let spec = enemy.config?.hitFrame ?? enemy.hitFrame ?? null; // << só cai em "last" se realmente não vier nada

  // 3) Se for objeto por estado, reduzir para o estado atual/solicitado
  if (spec && typeof spec === "object" && !Array.isArray(spec)) {
    spec = spec[enemy.state] ?? spec[state] ?? spec.default ?? null;
  }

  // 4) Base de índice (0 = default, 1 = humano)
  const indexBase =
    enemy.config?.hitFrameIndexBase ?? enemy.hitFrameIndexBase ?? 0;
  const toZeroBased = (n) => (n | 0) - (indexBase === 1 ? 1 : 0); // 1→0, 2→1 se base for 1

  // 5) Atalhos textuais
  if (spec === "last" || spec === -1) return count ? [count - 1] : null;
  if (spec === "middle" || spec === "mid")
    return count ? [Math.floor((count - 1) / 2)] : null;

  // 6) Normalização (número/array) + clamp seguro
  const clamp = (n) => {
    const z = toZeroBased(n);
    if (!Number.isFinite(z)) return null;
    if (count <= 0) return null;
    return Math.max(0, Math.min(count - 1, z));
  };

  if (Array.isArray(spec)) {
    const arr = spec
      .map(clamp)
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    return arr.length ? Array.from(new Set(arr)) : count ? [count - 1] : null;
  }

  if (spec != null) {
    const v = clamp(spec);
    if (v != null) return [v];
    // se veio algo inválido, caímos para "last" só como fallback final
    return count ? [count - 1] : null;
  }

  // 7) Nada fornecido → fallback "last"
  return count ? [count - 1] : null;
}

const isAttackLocked = (e) => e.state === "attack" && e._attackLock;

function finishAttackCycle(enemy) {
  const cd =
    enemy.cooldownOnFinish ??
    enemy.config?.cooldownOnFinish ??
    enemy.config?.cooldown ??
    enemy.cooldown ??
    0;

  if (cd > 0) enemy.cooldownTimer = cd;

  enemy._attackLock = false;
  enemy._attackStopX = undefined;

  enemy.state = "idle";
  enemy.frameIndex = 0;
  enemy._lastFI = undefined;
  enemy._didTriggerThisCycle = false;
  enemy._firedFramesCycle = undefined;
}

function tickLockedAttack(enemy) {
  if (!isAttackLocked(enemy)) return false;
  const hitFrames = resolveHitFrames(enemy, "attack");
  const { looped } = getTriggeredFramesThisTick(enemy, hitFrames, "attack");
  if (looped) finishAttackCycle(enemy);
  return true; // houve lock; não ande este tick
}

function spawnShotgunMuzzleFX(gameRef, x, y, cor, tileH) {
  // shockwave duplo
  (gameRef.particles ||= []).push(
    { kind: "ring", x, y, t: 0, max: 10, cor: "rgba(255,255,255,0.95)" },
    { kind: "ring", x, y, t: 0, max: 18, cor: "rgba(96,165,250,0.85)" } // azul claro sutil
  );

  // flash cônico: 3 “feixes” curtos à frente
  const len = 22; // comprimento do flash
  const offsets = [-tileH * 0.08, 0, tileH * 0.08];
  offsets.forEach((dy) => {
    gameRef.particles.push({
      kind: "beam",
      x0: x,
      y0: y,
      x1: x + len,
      y1: y + dy,
      w: 12,
      t: 0,
      max: 10,
      cor,
      seed: ((Math.random() * 1e9) | 0) ^ (Date.now() & 0xffff),
    });
  });

  // faíscas quentes para frente (tracers)
  for (let i = 0; i < 10; i++) {
    const ang = (Math.random() - 0.2) * 0.6; // leque frontal
    const spd = 1.0 + Math.random() * 1.8;
    gameRef.particles.push({
      kind: "spark",
      x,
      y,
      vx: Math.cos(ang) * spd + 0.8,
      vy: Math.sin(ang) * spd * 0.5,
      g: 0.02,
      t: 0,
      max: (12 + Math.random() * 8) | 0,
      cor,
    });
  }

  // “cápsulas” ejetadas para trás (use spark com gravidade)
  for (let i = 0; i < 3; i++) {
    const spd = 0.8 + Math.random() * 1.2;
    gameRef.particles.push({
      kind: "spark",
      x,
      y,
      vx: -(0.8 + Math.random() * 1.2), // para esquerda
      vy: -(0.2 + Math.random() * 0.6), // leve para cima
      g: 0.06, // cai rapidinho
      t: 0,
      max: (16 + Math.random() * 8) | 0,
      cor: "rgba(229,231,235,0.9)", // cinza claro (latão estilizado)
    });
  }
}

// -----------------------------------------------------------------------------

//#region CollisionManager
export const CollisionManager = {
  updateProjectilesAndCheckCollisions(gameRef) {
    gameRef.projectilePool.forEach((p) => {
      if (!p.active) return;

      // --- homing + trilha de fumaça (micro-míssil) ---
      if (p.active && p.kind === "microMissile") {
        const speed = p.speed || Math.max(1, Math.hypot(p.vx, p.vy) || 6);
        const home = p.homeStrength ?? 0.08; // força de curva
        const maxTurn = p.maxTurnRad ?? Math.PI / 30; // ~6° por tick (limite)
        const lookAhead = p.lookAheadPx ?? 18; // só mira alvos à frente

        // fumaça (cinza) e faíscas discretas
        p._smokeTick = (p._smokeTick || 0) + 1;
        if (p._smokeTick % (p.smokeEvery || 2) === 0) {
          (gameRef.particles ||= []).push({
            kind: "spark",
            x: p.x - Math.random() * 3,
            y: p.y + (Math.random() * 2 - 1),
            vx: -0.4 + Math.random() * 0.2,
            vy: -0.25 + Math.random() * 0.15,
            g: 0.02,
            t: 0,
            max: 16,
            cor: "rgba(180,180,180,0.85)", // fumaça
          });
        }

        // alvo mais próximo à frente
        const tileH = gameRef.view?.tileHeight ?? 64;
        const target = gameRef.inimigos
          .filter((e) => !e.__death && e.x >= p.x - lookAhead)
          .sort((a, b) => {
            const ay = (a.row + 0.5) * tileH,
              by = (b.row + 0.5) * tileH;
            return (
              Math.hypot(a.x - p.x, ay - p.y) - Math.hypot(b.x - p.x, by - p.y)
            );
          })[0];

        // curva suave na direção do alvo (com limite de giro)
        if (target) {
          const ty = (target.row + 0.5) * tileH;
          const desired = Math.atan2(ty - p.y, target.x - p.x);
          const current = Math.atan2(p.vy, p.vx);
          let delta =
            ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          delta = Math.max(-maxTurn, Math.min(maxTurn, delta)) * home;
          const ang = current + delta;
          p.vx = Math.cos(ang) * speed;
          p.vy = Math.sin(ang) * speed;
        }

        p.speed = speed; // mantém velocidade base
      }

      // ❄️ trilha de neve para projéteis com slow
      if (p.active && p.slowMs && p.slowFactor) {
        // rate limit simples (1 emissão a cada 2 frames do updateProjectiles)
        p._snowTimer = (p._snowTimer || 0) - 1;
        if (p._snowTimer <= 0) {
          p._snowTimer = 2; // ajuste a frequência

          // emite 2–3 floquinhos
          const n = 2 + ((Math.random() * 2) | 0);
          for (let i = 0; i < n; i++) {
            gameRef.particles.push({
              kind: "snow",
              x: p.x + (Math.random() * 6 - 3),
              y: p.y + (Math.random() * 6 - 3),
              vx: (Math.random() * 0.6 - 0.3) * 0.6,
              vy: (Math.random() * 0.4 + 0.1) * 0.6,
              g: 0.02, // gravidade leve
              sway: 1 + Math.random() * 2, // balanço lateral
              phase: Math.random() * Math.PI * 2,
              r: 1 + Math.random() * 1.5, // raio
              a: 0.9, // alpha base
              t: 0,
              max: 28 + ((Math.random() * 14) | 0), // vida em frames
            });
          }
        }
      }

      // ❄️ neve caindo do projétil gelado
      if (p.active && p.fxSnow) {
        p._flakeTick = (p._flakeTick || 0) + 1;
        if (p._flakeTick % 3 === 0) {
          // densidade
          (gameRef.particles ||= []).push({
            kind: "snow",
            x: p.x + (Math.random() * 6 - 3),
            y: p.y + (Math.random() * 4 - 2),
            vx: Math.random() * 0.6 - 0.3, // drift horizontal
            vy: 0.4 + Math.random() * 0.6, // cai pra baixo
            g: 0.005 + Math.random() * 0.01, // gravidade leve
            t: 0,
            max: 90 + ((Math.random() * 60) | 0), // vida longa
            r: 1.5 + Math.random() * 1.5, // raio do floco
            a: 0.9, // alpha base
            phase: Math.random() * Math.PI * 2, // p/ balanço
            sway: 0.25 + Math.random() * 0.55, // intensidade do balanço
          });
        }
      }

      p.update();

      // —— convergência vertical para projéteis com shotgun/steer —— //
      if (p.__yBlendLeft > 0) {
        p.__yBlendLeft -= 1;
        if (p.__yBlendLeft <= 0) {
          // chega exatamente no alvo e ativa gating por linha
          p.y = p.__yTarget;
          p.vy = 0;
          p.row = p.__rowTarget;
          p.__yBlendLeft = 0;
        }
      }

      const candidates = gameRef.inimigos
        .filter((e) => {
          if (!e) return false;
          const alive =
            typeof e.isDead === "function" ? !e.isDead() : !e.isDead;
          if (!alive) return false;
          // gate por linha (quando p.row estiver definido)
          return p.row == null || e.row == null || e.row === p.row;
        })
        // inimigo mais próximo do projétil primeiro
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));

      for (const enemy of candidates) {
        p.checkCollision(enemy);
        if (p.hit) {
          // aplica FX hit
          if (!Array.isArray(gameRef.particles)) gameRef.particles = [];
          gameRef.particles.push({
            x: p.x,
            y: p.y,
            t: 0,
            max: 12,
            cor: p.cor || "#fff",
          });
          p.justHit = false;

          // 🔵 aplica slow se este projétil tiver slow
          if (p.slowMs && p.slowFactor && enemy && !enemy.__death) {
            const now = performance.now();
            // acumulação simples: mantém o mais forte (menor fator) e maior duração
            const cur = enemy.__slow || { factor: 1, until: 0 };
            const until = Math.max(cur.until || 0, now + p.slowMs);
            const factor = Math.min(cur.factor || 1, p.slowFactor);
            enemy.__slow = { factor, until };
          }

          if (p.fxSnow) {
            for (let i = 0; i < 14; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 0.6 + Math.random() * 1.2;
              (gameRef.particles ||= []).push({
                kind: "spark",
                x: p.x,
                y: p.y,
                vx: Math.cos(ang) * spd * 0.6,
                vy: Math.sin(ang) * spd * 0.4 - 0.1,
                g: 0.018,
                t: 0,
                max: 18 + ((Math.random() * 10) | 0),
                cor: "rgba(255,255,255,0.95)",
              });
            }
          }

          if (gameRef.onEnemyDamaged)
            gameRef.onEnemyDamaged({
              kind: "projectile",
              x: p.x,
              y: p.y,
              enemy,
            });
          break;
        }
      }

      if (p.justHit) {
        if (!Array.isArray(gameRef.particles)) gameRef.particles = [];
        gameRef.particles.push({
          x: p.x,
          y: p.y,
          t: 0,
          max: 12,
          cor: p.cor || "#fff", // ver passo 4 pra garantir que venha a cor
        });
        p.justHit = false; // evita duplicar em ticks seguintes
      }
    });
  },
  tropasAtacam(gameRef) {
    const tileW = gameRef.view?.tileWidth ?? 64;
    const tileH = gameRef.view?.tileHeight ?? 64;
    const maxX = gameRef.view?.w ?? tileW * 12;

    // helper: pega projétil ocioso da pool
    function acquireProjectile() {
      const p = gameRef.projectilePool.find((q) => !q.active);
      if (p) return p;
      const np = new Projectile({ active: false });
      gameRef.projectilePool.push(np);
      return np;
    }

    // dispara 1 projétil "bola"
    function fireBall(t) {
      const muzzle = gameRef.getMuzzleWorldPos?.(t) ?? {
        x: t.col * tileW + tileW / 2,
        y: (t.row + 0.5) * tileH,
      };
      const p = acquireProjectile();
      const bounds = {
        minX: 0,
        maxX,
        minY: 0,
        maxY: gameRef.view?.h ?? tileH * 7,
      };
      // re-inicializa TUDO que afeta colisão/vida do projétil
      p.x = muzzle.x;
      p.y = muzzle.y;
      p.vx = t.config.velocidadeProjetil || 6;
      p.vy = 0;
      p.row = t.row;
      p.tipo = t.tipo;
      p.dano = t.config.dano | 0;
      p.bounds = bounds;
      p.tileH = tileH; // 🔑 altura real do tile p/ colisão
      p.radius = 5;
      p.ticks = 0; // 🔑 reseta TTL
      p.hit = false; // 🔑 limpa estado de impacto antigo
      p.justHit = false;
      p.active = true;
      p.maxTicks = 300;
      p.kind = "bola";
      p.cor = t.config.corProjetil || "#fff";

      p.slowFactor = t.config.slowFactor ?? null;
      p.slowMs = t.config.slowMs ?? 0;

      // se essa tropa aplica slow, marcamos o projétil e ligamos FX de neve
      if ((t.config.slowFactor ?? 1) < 1 && (t.config.slowMs ?? 0) > 0) {
        p.slowFactor = t.config.slowFactor;
        p.slowMs = t.config.slowMs;
        p.fxSnow = true;

        // pequeno burst no muzzle
        gameRef.particles ||= [];
        for (let i = 0; i < 8; i++) {
          gameRef.particles.push({
            kind: "spark",
            x: p.x,
            y: p.y,
            vx: Math.random() * 1.2 - 0.6,
            vy: -0.3 + Math.random() * 0.6,
            g: 0.015, // queda suave
            t: 0,
            max: 18 + ((Math.random() * 8) | 0),
            cor: "rgba(255,255,255,0.95)", // branco (neve)
            r: 2 + Math.random() * 2, // se seu renderer usa raio opcional
          });
        }
      }

      // 🔊 som no frame de disparo (spawn do projétil)
      if (gameRef.onProjectileSpawn) gameRef.onProjectileSpawn(p);
    }

    // dispara "laser" instantâneo na linha inteira até o alcance
    function fireLaser(t) {
      // origem no muzzle.attack já convertido para mundo
      const muzzle = gameRef.getMuzzleWorldPos?.(t) ?? {
        x: t.col * tileW + tileW / 2,
        y: t.row * tileH + tileH / 2,
      };

      const alcanceCols = t.config.alcance | 0;
      const x0 = muzzle.x;
      const y0 = muzzle.y;

      // fim do feixe limitado ao alcance à direita
      const xReach = (t.col + alcanceCols + 0.5) * tileW;
      const x1 = Math.min(maxX, xReach);

      // faixa [xmin, xmax] para aplicar dano
      const xmin = Math.min(x0, x1);
      const xmax = Math.max(x0, x1);

      const dano = t.config.dano | 0;
      const hits = gameRef.inimigos.filter(
        (e) => !e.__death && e.row === t.row && e.x >= xmin && e.x <= xmax
      );
      for (const e of hits) e.hp = Math.max(0, (e.hp ?? 0) - dano);

      // FX do feixe alinhado ao muzzle
      (gameRef.particles ||= []).push({
        kind: "beam",
        x0,
        y0,
        x1,
        y1: y0,
        w: 10, // largura máxima do feixe
        t: 0,
        max: 14, // duração curta
        cor: t.config.corProjetil || "#6cf",
        seed:
          ((Math.random() * 1e9) | 0) ^ (t.row << 5) ^ (Date.now() & 0xffff), // << NOVO
      });
      for (const e of hits) {
        gameRef.particles.push({
          kind: "ring",
          x: e.x,
          y: y0,
          t: 0,
          max: 10,
          cor: "rgba(255,255,255,0.9)",
        });
      }
    }

    function fireShotgun3(t) {
      const muzzle = gameRef.getMuzzleWorldPos?.(t) ?? {
        x: t.col * tileW + tileW / 2,
        y: (t.row + 0.5) * tileH,
      };

      const lanes = [t.row - 1, t.row, t.row + 1].filter(
        (r) => r >= 0 && r < tileRows && estaNaAreaDeCombate(r, t.col)
      );

      const baseDano = t.config.dano | 0;
      const danoLane = (idx) =>
        idx === 1 ? baseDano : Math.max(1, Math.round(baseDano * 0.8));
      const speed = t.config.velocidadeProjetil || 6;
      const cor = t.config.corProjetil || "#fff";

      const bounds = {
        minX: 0,
        maxX,
        minY: 0,
        maxY: gameRef.view?.h ?? tileH * 7,
      };

      // quantos ticks para “encaixar” na lane alvo (ajuste fino visual)
      const blendTicks = 12; // 8–16 fica legal

      lanes.forEach((rowAlvo, i) => {
        const p = acquireProjectile();

        // nasce no MUZZLE (todos juntos)
        p.x = muzzle.x;
        p.y = muzzle.y;

        // anda para a direita já
        p.vx = speed;
        p.vy = ((rowAlvo + 0.5) * tileH - muzzle.y) / blendTicks; // sobe/desce até a lane

        // ainda sem gating por linha durante o blend
        p.row = null;
        p.__rowTarget = rowAlvo;
        p.__yTarget = (rowAlvo + 0.5) * tileH;
        p.__yBlendLeft = blendTicks;

        // meta/colisão
        p.tipo = t.tipo;
        p.dano = danoLane(i);
        p.bounds = bounds;
        p.tileH = tileH;
        p.radius = 5;
        p.ticks = 0;
        p.hit = false;
        p.justHit = false;
        p.active = true;
        p.maxTicks = 300;
        p.cor = cor;

        // trilha leve
        (gameRef.particles ||= []).push({
          kind: "spark",
          x: p.x,
          y: p.y,
          vx: 1.2,
          vy: 0,
          g: 0.0,
          t: 0,
          max: 10,
          cor,
        });
      });

      // FX no muzzle
      // FX no muzzle (substitui o bloco antigo)
      spawnShotgunMuzzleFX(gameRef, muzzle.x, muzzle.y, cor, tileH);
    }

    function fireMicroMissileSalvo(t) {
      const tileW = gameRef.view?.tileWidth ?? 64;
      const tileH = gameRef.view?.tileHeight ?? 64;
      const muzzle = gameRef.getMuzzleWorldPos?.(t) ?? {
        x: t.col * tileW + tileW / 2,
        y: (t.row + 0.5) * tileH,
      };

      const n = t.config.count ?? ((Math.random() * 2) | 0) + 3; // 3–5
      const spreadDeg = t.config.spreadDeg ?? 10; // leque inicial
      const speed = t.config.velocidadeProjetil || 7;
      const dano = t.config.dano | 0;
      const cor = t.config.corProjetil || "#ffd080";

      for (let i = 0; i < n; i++) {
        const p = acquireProjectile();

        // ângulo inicial com pequena variação (leque)
        const a = ((Math.random() * spreadDeg - spreadDeg / 2) * Math.PI) / 180;

        // nasce no cano (todos juntos) e vai curvando depois
        p.x = muzzle.x;
        p.y = muzzle.y;
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * (speed * 0.4); // leve inclinação vertical
        p.speed = speed;

        // meta / comportamento
        p.kind = "microMissile";
        p.homeStrength = t.config.homeStrength ?? 0.1;
        p.maxTurnRad = ((t.config.maxTurnDeg ?? 7) * Math.PI) / 180;
        p.lookAheadPx = t.config.lookAheadPx ?? 18;
        p.smokeEvery = 2;

        // deixa cruzar linhas (homing multi-row)
        p.row = null;

        // colisão/dano
        p.tipo = t.tipo;
        p.dano = dano;
        p.bounds = {
          minX: 0,
          maxX: gameRef.view?.w ?? tileW * 12,
          minY: 0,
          maxY: gameRef.view?.h ?? tileH * 7,
        };
        p.tileH = tileH;
        p.radius = 6;
        p.ticks = 0;
        p.hit = false;
        p.justHit = false;
        p.active = true;
        p.maxTicks = 260;
        p.cor = cor;

        // pequeno flash de exaustão no cano
        (gameRef.particles ||= []).push({
          kind: "beam",
          x0: muzzle.x,
          y0: muzzle.y,
          x1: muzzle.x + 12 + Math.random() * 6,
          y1: muzzle.y + (Math.random() * 4 - 2),
          w: 5,
          t: 0,
          max: 10,
          cor,
          seed: (Math.random() * 1e9) | 0,
        });
      }
    }

    function fireFlameStream(t) {
      const tileW = gameRef.view?.tileWidth ?? 64;
      const tileH = gameRef.view?.tileHeight ?? 64;
      const muzzle = gameRef.getMuzzleWorldPos?.(t) ?? {
        x: t.col * tileW + tileW / 2,
        y: (t.row + 0.5) * tileH,
      };

      // ===== ALCANCE (mais longo) =====
      const alcanceCols = t.config.alcance | 0;
      const range = Math.max(
        tileW,
        alcanceCols * tileW * (t.config.flameRangeScale ?? 1.8)
      );
      const x0 = muzzle.x,
        x1 = muzzle.x + range;

      // ===== EMISSÃO CONTÍNUA =====
      const cone = t.config.flameCone ?? 0.28; // cone ligeiramente mais fechado
      const base = t.config.flameSpeed ?? 5.0; // chamas “empurram” mais
      const count = t.config.flamePpt ?? 12; // mais partículas por tick

      for (let i = 0; i < count; i++) {
        const a = Math.random() * cone - cone / 2;
        const spd = base + Math.random() * 2.2;
        const life = 18 + ((Math.random() * 12) | 0); // vida maior
        (gameRef.particles ||= []).push({
          kind: "flame",
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(a) * (spd * (0.95 + Math.random() * 0.1)),
          vy: Math.sin(a) * spd * 0.45 - 0.1, // menos queda vertical
          r: 14 + Math.random() * 16, // “linguas” mais largas
          shrink: 0.28 + Math.random() * 0.18, // encolhe mais devagar
          a: 0.95,
          t: 0,
          max: life,
          // Núcleo bem claro e borda laranja avermelhada (como a imagem)
          rgb1: [255, 245, 140], // quase branco-amarelado
          rgb2: [
            255,
            120 + ((Math.random() * 40) | 0),
            30 + ((Math.random() * 30) | 0),
          ],
        });
      }

      // brilho de base (faixa amarela) – dá a sensação de chama forte na saída
      if (Math.random() < 0.5) {
        (gameRef.particles ||= []).push({
          kind: "beam",
          x0: muzzle.x,
          y0: muzzle.y,
          x1: muzzle.x + 18 + Math.random() * 16,
          y1: muzzle.y + (Math.random() * 6 - 3),
          w: 6,
          t: 0,
          max: 10,
          cor: "rgba(255,235,150,0.9)",
          seed: (Math.random() * 1e9) | 0,
        });
      }

      // fumaça quente sutil subindo
      if (Math.random() < 0.85) {
        (gameRef.particles ||= []).push({
          kind: "smoke",
          x: muzzle.x + 6,
          y: muzzle.y - 2,
          vx: 0.25 + Math.random() * 0.35,
          vy: -0.45 - Math.random() * 0.35,
          r: 7 + Math.random() * 9,
          a: 0.45,
          t: 0,
          max: 30 + ((Math.random() * 12) | 0),
          rgb: [150, 140, 140],
          drift: 0.3,
          rise: -0.18,
        });
      }

      // ===== DANO por tick (inalterado; já usa alcance) =====
      const dpt = t.config.flameDpsPerTick ?? t.config.flameDps ?? 2;
      const hits = gameRef.inimigos.filter(
        (e) => !e.__death && e.row === t.row && e.x >= x0 && e.x <= x1
      );
      for (const e of hits) {
        e.hp = Math.max(0, (e.hp ?? 0) - dpt);
        (gameRef.particles ||= []).push({
          kind: "spark",
          x: e.x,
          y: muzzle.y,
          vx: 0.4 + Math.random() * 0.4,
          vy: -0.15 + Math.random() * 0.2,
          g: 0.02,
          t: 0,
          max: 10,
          cor: "rgba(255,210,120,1)",
        });
      }
    }

    gameRef.tropas.forEach((t) => {
      // 🛑 não processa quem já morreu/está removendo
      if (t.remove || t.isDead) return;

      // muralha viva em "defense" não ataca
      if (t.state === "defense") return;

      // anda cooldown, mas não dá return ainda (para manter animação fluindo)
      t.updateCooldown();

      const alcance = t.config.alcance | 0;
      const temAlvo = gameRef.inimigos.some(
        (e) =>
          e.row === t.row &&
          Math.floor(e.x / tileW) >= t.col &&
          Math.floor(e.x / tileW) <= t.col + alcance
      );

      if (!temAlvo) {
        if (t.state !== "idle") {
          // NÃO zera frameIndex/frameTick — deixa o updateAnimation cuidar
          t.state = "idle";
          t._firedFramesCycle = undefined;
          t._lastFI = undefined;
        }
        // << adicione
        if (t.config?.projetil === "fireFlameStream") t.__flameChannel = false;
        return;
      }

      // depois de calcular temAlvo:
      const tipoProj = t.config.projetil || "bola";
      const isFlame = tipoProj === "fireFlameStream";

      // ===== Canalização FLAME já ativa =====
      // ===== Canalização FLAME já ativa =====
      if (isFlame && t.__flameChannel) {
        if (temAlvo) {
          if (t.state !== "attack") {
            t.state = "attack";
            t.frameIndex = 0;
            const atkInt = t.config.animacoes?.attack?.frameInterval ?? 1;
            t.frameTick = 0 | (Math.random() * atkInt);
            t._firedFramesCycle = undefined;
            t._lastFI = undefined;
            // (NÃO resete __flameChannel aqui)
          }
          fireFlameStream(t);
          return;
        } else {
          t.__flameChannel = false;
          t.cooldown = t.config.cooldown | 0;
          if (t.state !== "idle") {
            t.state = "idle";
            t._firedFramesCycle = undefined;
            t._lastFI = undefined;
          }
          return;
        }
      }

      // ================================================

      // se ainda em cooldown, NÃO force 'attack' (deixe animar em idle)
      if (t.cooldown > 0) return;

      // pronto para atacar → entra em 'attack' agora
      if (t.state !== "attack") {
        t.state = "attack";
        t.frameIndex = 0;
        const atkInt = t.config.animacoes?.attack?.frameInterval ?? 1;
        t.frameTick = 0 | (Math.random() * atkInt);
        t._firedFramesCycle = undefined;
        t._lastFI = undefined;
      }

      const fireSpec = t.config.fireFrame ?? t.fireFrame;
      const { framesNow } = getTriggeredFramesThisTick(t, fireSpec, "attack");
      if (!framesNow.length) return;

      // ---- burst logic ----
      const framesArr = Array.isArray(fireSpec)
        ? fireSpec.map((n) => n | 0)
        : [fireSpec | 0];
      const isBurst = framesArr.length > 1;
      const cooldownPerShot =
        t.config.cooldownPerShot !== undefined
          ? !!t.config.cooldownPerShot
          : !isBurst; // default: burst só dá cooldown no fim
      const lastFrameTarget = framesArr.length ? Math.max(...framesArr) : null;

      let firedAny = false;
      let firedLastFrame = false;

      for (const f of framesNow) {
        const tipo = t.config.projetil || "bola";
        if (tipo === "laser") {
          fireLaser(t);
        } else if (tipo === "bola") {
          fireBall(t);
        } else if (tipo === "shotgun") {
          fireShotgun3(t); // 👈 novo
        } else if (tipo === "microMissile") {
          fireMicroMissileSalvo(t);
        } else if (tipo === "fireFlameStream") {
          // inicia canalização no frame configurado
          t.__flameChannel = true;
          // dispara já neste tick (feedback imediato)
          fireFlameStream(t);
          // NÃO aplica cooldown aqui; ele só vem ao encerrar a canalização
        } else if (tipo === "melee") {
          const alvo = gameRef.inimigos
            .filter(
              (e) =>
                e.row === t.row &&
                Math.floor(e.x / tileW) >= t.col &&
                Math.floor(e.x / tileW) <= t.col + alcance
            )
            .sort((a, b) => a.x - b.x)[0];
          if (alvo) alvo.hp = Math.max(0, (alvo.hp ?? 0) - (t.config.dano | 0));
          if (gameRef.onTroopMeleeHit) gameRef.onTroopMeleeHit(t, alvo); // 🔊 aqui
        }
        firedAny = true;
        if (isBurst && f === lastFrameTarget) firedLastFrame = true;
        if (
          cooldownPerShot &&
          !(tipo === "flame" || tipo === "fireFlameStream")
        ) {
          // flame não usa cooldown por disparo
          t.cooldown = t.config.cooldown | 0;
        }
      }

      // cooldown só no fim do burst
      if (firedAny && !cooldownPerShot) {
        if (!isBurst || firedLastFrame) t.cooldown = t.config.cooldown | 0;
      }
    });
  },

  // INIMIGOS (aproxima e para alguns px antes da tropa; opcionalmente gate por frame)
  inimigosAtacam(gameRef) {
    // tamanho REAL do tile (do canvas)
    const tileW = Math.round(gameRef.view?.tileWidth ?? 64);

    // quantos px ANTES da borda direita do tile da tropa (valor POSITIVO)
    const approachPadPx = 20; // ajuste fino aqui
    const hysteresisPx = 2; // banda anti-jitter

    // 🔵 helper para aplicar/expirar slow
    function slowMul(e) {
      const s = e.__slow;
      if (!s) return 1;
      const now = performance.now();
      if (now > (s.until || 0)) {
        e.__slow = null;
        return 1;
      }
      return Math.max(0.1, s.factor || 1); // evita parar completamente
    }

    gameRef.inimigos.forEach((enemy) => {
      const enemyRow = enemy.row;
      const enemyColFloat = enemy.x / tileW; // posição em "colunas" com fração

      // tropas vivas na MESMA linha
      const tropasLinha = gameRef.tropas.filter(
        (t) => !t.remove && !t.isDead && t.row === enemyRow
      );

      if (tropasLinha.length === 0) {
        if (tickLockedAttack(enemy)) {
          enemy.speed = 0;
          return;
        }
        enemy.speed = (enemy.baseSpeed ?? enemy.speed) * slowMul(enemy); // 👈 aplica slow
        if (enemy.state !== "walking") {
          enemy.state = "walking";
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
        }
        return;
      }
      // tropas "à frente" do inimigo (ele vem da direita → esquerda)
      const candidatas = tropasLinha.filter((t) => t.col <= enemyColFloat);
      if (candidatas.length === 0) {
        if (tickLockedAttack(enemy)) {
          enemy.speed = 0;
          return;
        }
        enemy.speed = (enemy.baseSpeed ?? enemy.speed) * slowMul(enemy); // 👈 aplica slow
        if (enemy.state !== "walking") {
          enemy.state = "walking";
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
        }
        return;
      }

      // pega a tropa mais à direita (a da frente)
      const alvo = candidatas.reduce((a, b) => (a.col > b.col ? a : b));

      // guarda velocidade base uma vez
      if (enemy.baseSpeed == null) enemy.baseSpeed = enemy.speed;

      // ===== alcance em colunas, compensando o "gap" em pixels =====
      const alcanceCols = enemy.alcance ?? 1;
      const extraCols = approachPadPx / tileW; // gap convertido para colunas
      const distCols = enemyColFloat - alvo.col; // >= 0

      if (distCols - extraCols > alcanceCols) {
        if (tickLockedAttack(enemy)) {
          enemy.speed = 0;
          return;
        }
        enemy.speed = enemy.baseSpeed * slowMul(enemy); // 👈 aplica slow
        if (enemy.state !== "walking") {
          enemy.state = "walking";
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
        }
        return;
      }

      // ===== ponto ideal p/ parar: à direita da borda do tile da tropa =====
      // (para não "entrar" no tile da tropa)
      const rightEdge = (alvo.col + 1) * tileW;
      const desiredStopX = rightEdge + approachPadPx;

      // anda enquanto estiver muito à direita do ponto de parada
      if (enemy.x > desiredStopX + hysteresisPx) {
        enemy.speed = enemy.baseSpeed * slowMul(enemy); // 👈 aplica slow
        if (enemy.state !== "walking") {
          enemy.state = "walking";
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
        }
        return;
      }

      enemy.x = desiredStopX;
      enemy.speed = 0;

      // pronto p/ atacar?
      const canAtk =
        typeof enemy.canAttack === "function"
          ? enemy.canAttack()
          : (enemy.cooldownTimer ?? 0) <= 0;

      if (!canAtk) {
        if (tickLockedAttack(enemy)) {
          enemy.x = enemy._attackStopX ?? enemy.x;
          return;
        }
        if (enemy.state !== "idle") {
          enemy.state = "idle";
          enemy.frameIndex = 0;
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
          enemy._firedFramesCycle = undefined;
        }
        return;
      }

      // entrar em 'attack' e TRAVAR ciclo
      if (enemy.state !== "attack") {
        enemy.state = "attack";
        enemy.frameIndex = 0;
        const atkInt = enemy.animacoes?.attack?.frameInterval ?? 1;
        enemy.frameTick = Math.floor(Math.random() * atkInt);
        enemy._lastFI = undefined;
        enemy._didTriggerThisCycle = false;
        enemy._firedFramesCycle = undefined;
        enemy._attackLock = true; // << lock
        enemy._attackStopX = desiredStopX; // << fixa posição
      }

      // Frames que disparam o hit + detecção de loop da animação
      const hitFrames = resolveHitFrames(enemy, "attack");
      const { framesNow, looped } = getTriggeredFramesThisTick(
        enemy,
        hitFrames,
        "attack"
      );

      // Quando o ciclo de 'attack' termina, entra em IDLE e inicia cooldown
      if (framesNow.length > 0) {
        enemy.attack(alvo);
        if (alvo.hp <= 0) alvo.startDeath?.(); // alvo pode morrer; lock mantém animação
      }

      if (looped) {
        const cd =
          enemy.cooldownOnFinish ??
          enemy.config?.cooldownOnFinish ??
          enemy.config?.cooldown ??
          enemy.cooldown ??
          0;
        if (cd > 0) enemy.cooldownTimer = cd;

        enemy._attackLock = false; // << libera
        enemy._attackStopX = undefined;

        enemy.state = "idle";
        enemy.frameIndex = 0;
        enemy._lastFI = undefined;
        enemy._didTriggerThisCycle = false;
        enemy._firedFramesCycle = undefined;
        return;
      }
      // se estiver em cooldown, fica apenas animando "attack"
    });

    // limpeza de tropas removidas, se aplicável
    gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
  },
};
