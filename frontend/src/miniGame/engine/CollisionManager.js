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

  console.log(JSON.stringify(enemy));

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

  console.log(spec);
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
        if (!p.active) break;
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
      p.cor = t.config.corProjetil || "#fff";
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
        return;
      }

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
        }
        firedAny = true;
        if (isBurst && f === lastFrameTarget) firedLastFrame = true;
        if (cooldownPerShot) t.cooldown = t.config.cooldown | 0; // espaça cada tiro
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
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
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
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
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
        enemy.speed = enemy.baseSpeed;
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
        enemy.speed = enemy.baseSpeed;
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
