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
        t.frameTick = Math.floor(Math.random() * atkInt); // << desync leve
        t._firedFramesCycle = undefined;
        t._lastFI = undefined;
      }

      // frames de disparo (número ou array)
      const fireSpec = t.config.fireFrame ?? t.fireFrame; // number | number[] | undefined
      const { framesNow } = getTriggeredFramesThisTick(t, fireSpec, "attack");

      // sem frames configurados → disparo “livre” 1x por tick
      const free = framesNow.length === 1 && framesNow[0] === "__free__";
      const framesToFire = free ? [null] : framesNow;
      if (framesToFire.length === 0) return;

      // === correção: burst só quando for ARRAY com length>1 ===
      const framesArr = normalizeFrames(fireSpec);
      const isBurst = Array.isArray(fireSpec) && framesArr.length > 1;

      // por padrão: se for burst (array com >1), cooldown só no fim; caso contrário, por tiro
      const cooldownPerShot =
        t.config.cooldownPerShot !== undefined
          ? !!t.config.cooldownPerShot
          : !isBurst;

      const lastFrameTarget =
        framesArr && framesArr.length
          ? Math.max(...framesArr)
          : typeof fireSpec === "number"
          ? fireSpec
          : null;

      let firedAny = false;
      let firedLastFrame = false;

      for (const f of framesToFire) {
        // === montar projétil ===
        const projData = t.attack(tileW, tileH) || {};
        projData.tipo = t.tipo;

        // spawn no cano (muzzle) publicado pelo GameCanvas
        const muzzle =
          typeof gameRef.getMuzzleWorldPos === "function"
            ? gameRef.getMuzzleWorldPos(t)
            : { x: (t.col + 0.5) * tileW, y: (t.row + 0.5) * tileH };

        projData.x = muzzle.x;
        projData.y = muzzle.y;

        // direção, se não veio do attack()
        if (projData.vx == null || projData.vy == null) {
          const speed = projData.speed ?? t.config.velocidadeProjetil ?? 5;
          projData.vx = Math.abs(speed);
          projData.vy = 0;
        }

        // limites do mundo + dados auxiliares p/ colisão
        projData.bounds = {
          minX: 0,
          maxX: gameRef.view?.w ?? Infinity,
          minY: 0,
          maxY: gameRef.view?.h ?? Infinity,
        };
        projData.tileH = tileH;
        projData.row = t.row;

        // pool de projéteis
        const reused = gameRef.projectilePool.find((p) => !p.active);
        if (reused) {
          Object.assign(reused, new Projectile(projData)); // reinit completo
          reused.active = true;
          reused.ticks = 0;
        } else {
          gameRef.projectilePool.push(new Projectile(projData));
        }

        firedAny = true;
        if (isBurst && f === lastFrameTarget) firedLastFrame = true;

        // cooldown por tiro (se configurado/implicado)
        if (cooldownPerShot) {
          t.cooldown = t.config.cooldown;
        }
      }

      // cooldown ao final do burst
      if (firedAny && !cooldownPerShot) {
        if (!isBurst || firedLastFrame) {
          t.cooldown = t.config.cooldown;
        }
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
      if (enemy.state !== "attack") {
        enemy.state = "attack";
        enemy._lastFI = undefined;
        enemy._didTriggerThisCycle = false;
      }

      // opcional: se quiser sincronizar o "golpe" num frame da animação do inimigo,
      // defina enemy.hitFrame (number|number[]) ou enemy.config?.hitFrame
      const hitFrames = enemy.hitFrame ?? enemy.config?.hitFrame;

      if (enemy.canAttack && enemy.canAttack()) {
        if (shouldTriggerThisFrame(enemy, hitFrames, "attack")) {
          enemy.attack(alvo);
          if (alvo.hp <= 0) alvo.startDeath?.();
        }
      }
      // se estiver em cooldown, fica apenas animando "attack"
    });

    // limpeza de tropas removidas, se aplicável
    gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
  },
};
