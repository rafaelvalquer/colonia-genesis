// src/engine/CollisionManager.js

import { Projectile } from "../entities/Projectile";

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

/** Borda simples (usada nos inimigos, opcional). */
function shouldTriggerThisFrame(entity, framesSpec, expectedState = "attack") {
  const frames = normalizeFrames(framesSpec);
  if (!frames) return true;
  if (expectedState && entity.state !== expectedState) {
    entity._lastFI = undefined;
    entity._didTriggerThisCycle = false;
    return false;
  }
  const fi = entity.frameIndex | 0;
  const prev = entity._lastFI ?? fi;
  if (fi < prev) entity._didTriggerThisCycle = false;

  let hit = false;
  if (!entity._didTriggerThisCycle) {
    for (const f of frames) {
      if (prev < f && fi >= f) {
        hit = true;
        break;
      }
    }
  }
  entity._lastFI = fi;
  if (hit) entity._didTriggerThisCycle = true;
  return hit;
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

// -----------------------------------------------------------------------------

export const CollisionManager = {
  updateProjectilesAndCheckCollisions(gameRef) {
    gameRef.projectilePool.forEach((p) => {
      if (!p.active) return;

      p.update();

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

    gameRef.tropas.forEach((t) => {
      // 🛑 não processa quem já morreu/está removendo
      if (t.remove || t.isDead) return;

      // muralha viva em "defense" não ataca
      if (t.state === "defense") return;

      // anda cooldown, mas não dá return ainda (para manter animação fluindo)
      t.updateCooldown();

      // procura alvo na mesma linha e dentro do alcance (colunas)
      const alcance = t.config.alcance;
      const alvo = gameRef.inimigos.find(
        (e) =>
          e.row === t.row &&
          Math.floor(e.x / tileW) >= t.col &&
          Math.floor(e.x / tileW) <= t.col + alcance
      );

      if (!alvo) {
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
        t.frameTick = Math.floor(Math.random() * atkInt);
        t._firedFramesCycle = undefined;
        t._lastFI = undefined;
      }

      const fireSpec = t.config.fireFrame ?? t.fireFrame;
      const { framesNow } = getTriggeredFramesThisTick(t, fireSpec, "attack");
      const free = framesNow.length === 1 && framesNow[0] === "__free__";
      const framesToFire = free ? [null] : framesNow;
      if (framesToFire.length === 0) return;

      const framesArr = normalizeFrames(fireSpec);
      const isBurst = Array.isArray(fireSpec) && framesArr.length > 1;
      const cooldownPerShot =
        t.config.cooldownPerShot !== undefined
          ? !!t.config.cooldownPerShot
          : !isBurst;

      let firedAny = false;
      let firedLastFrame = false;
      const lastFrameTarget =
        framesArr && framesArr.length
          ? Math.max(...framesArr)
          : typeof fireSpec === "number"
          ? fireSpec
          : null;

      for (const f of framesToFire) {
        // ❗ agora aborta se a tropa não tem ataque
        const projData = t.attack(tileW, tileH);
        if (!projData) continue;

        projData.tipo = t.tipo;

        const muzzle =
          typeof gameRef.getMuzzleWorldPos === "function"
            ? gameRef.getMuzzleWorldPos(t)
            : { x: (t.col + 0.5) * tileW, y: (t.row + 0.5) * tileH };

        projData.x = muzzle.x;
        projData.y = muzzle.y;

        if (projData.vx == null || projData.vy == null) {
          const speed = projData.speed ?? t.config.velocidadeProjetil ?? 5;
          projData.vx = Math.abs(speed);
          projData.vy = 0;
        }

        projData.bounds = {
          minX: 0,
          maxX: gameRef.view?.w ?? Infinity,
          minY: 0,
          maxY: gameRef.view?.h ?? Infinity,
        };
        projData.tileH = tileH;
        projData.row = t.row;

        const reused = gameRef.projectilePool.find((p) => !p.active);
        if (reused) {
          Object.assign(reused, new Projectile(projData));
          reused.active = true;
          reused.ticks = 0;
        } else {
          gameRef.projectilePool.push(new Projectile(projData));
        }

        firedAny = true;
        if (isBurst && f === lastFrameTarget) firedLastFrame = true;

        if (cooldownPerShot) t.cooldown = t.config.cooldown;
      }

      if (firedAny && !cooldownPerShot) {
        if (!isBurst || firedLastFrame) t.cooldown = t.config.cooldown;
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
        // ainda fora do alcance → continua andando
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

      // ===== cooldown gate =====
      const canAtk =
        typeof enemy.canAttack === "function"
          ? enemy.canAttack()
          : (enemy.cooldownTimer ?? 0) <= 0;

      // Se está em cooldown, fica em IDLE (parado) e não reentra em 'attack'
      if (!canAtk) {
        if (enemy.state !== "idle") {
          enemy.state = "idle";
          enemy.frameIndex = 0;
          enemy._lastFI = undefined;
          enemy._didTriggerThisCycle = false;
          enemy._firedFramesCycle = undefined;
        }
        return;
      }

      // Pronto para atacar → entra em 'attack' apenas quando pode
      if (enemy.state !== "attack") {
        enemy.state = "attack";
        enemy.frameIndex = 0; // garante ciclo completo
        const atkInt = enemy.animacoes?.attack?.frameInterval ?? 1;
        enemy.frameTick = Math.floor(Math.random() * atkInt);
        enemy._lastFI = undefined;
        enemy._didTriggerThisCycle = false;
        enemy._firedFramesCycle = undefined;
      }

      // Frames que disparam o hit + detecção de loop da animação
      const hitFrames = resolveHitFrames(enemy, "attack");
      const { framesNow, looped } = getTriggeredFramesThisTick(
        enemy,
        hitFrames,
        "attack"
      );

      // Aplica dano quando atingir os frames configurados
      if (framesNow.length > 0) {
        enemy.attack(alvo);
        if (alvo.hp <= 0) alvo.startDeath?.();
      }

      // Quando o ciclo de 'attack' termina, entra em IDLE e inicia cooldown
      if (looped) {
        const cd =
          enemy.cooldownOnFinish ??
          enemy.config?.cooldownOnFinish ??
          enemy.config?.cooldown ??
          enemy.cooldown ??
          0;

        if (cd > 0) enemy.cooldownTimer = cd;

        enemy.state = "idle";
        enemy.frameIndex = 0;
        enemy._lastFI = undefined;
        enemy._didTriggerThisCycle = false;
        enemy._firedFramesCycle = undefined;
        return; // não continua este tick
      }

      // se estiver em cooldown, fica apenas animando "attack"
    });

    // limpeza de tropas removidas, se aplicável
    gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
  },
};
