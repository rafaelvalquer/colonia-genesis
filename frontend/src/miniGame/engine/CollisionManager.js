// src/engine/CollisionManager.js

import { Projectile } from "../entities/Projectile";
import { tileWidth, tileHeight } from "../entities/Tiles";

function getEnemyRow(enemyY) {
  return Math.floor(enemyY / tileHeight);
}

function getEnemyCol(enemyX) {
  return Math.floor(enemyX / tileWidth);
}

export const CollisionManager = {
  updateProjectilesAndCheckCollisions(gameRef) {
    gameRef.projectilePool.forEach((p) => {
      if (!p.active) return;

      p.update();

      for (let enemy of gameRef.inimigos) {
        p.checkCollision(enemy);
        if (!p.active) break;
      }
    });
  },

  tropasAtacam(gameRef) {
    gameRef.tropas.forEach((t) => {
      // muralha não ataca
      if (t.state === "defense") return;

      t.updateCooldown();
      if (t.cooldown <= 0) {
        const alcance = t.config.alcance;
        const alvo = gameRef.inimigos.find(
          (e) =>
            e.row === t.row &&
            Math.floor(e.x / tileWidth) >= t.col &&
            Math.floor(e.x / tileWidth) <= t.col + alcance
        );

        if (alvo) {
          const projData = t.attack(tileWidth, tileHeight);
          projData.tipo = t.tipo;

          const proj = gameRef.projectilePool.find((p) => !p.active);
          if (proj) {
            Object.assign(proj, projData);
          } else {
            gameRef.projectilePool.push(new Projectile(projData));
          }
        }
      }
    });
  },

  // 🔹 Ataque corpo a corpo usando alcance em COLUNAS
// 🔹 Ataque corpo a corpo usando alcance em COLUNAS + aproximação em pixels
inimigosAtacam(gameRef) {
  const approachPadPx = -20; // quanto "dentro" da célula o inimigo deve chegar antes de parar

  // helper pra trocar estado e resetar animação
  const setAnim = (enemy, state) => {
    if (enemy.state !== state) {
      enemy.state = state;
      enemy.frameIndex = 0;
      enemy.frameTick = 0;
    }
  };

  gameRef.inimigos.forEach((enemy) => {
    const enemyRow = enemy.row;
    const enemyCol = Math.floor(enemy.x / tileWidth);

    // tropas vivas na mesma linha
    const candidatas = gameRef.tropas.filter(
      (t) => !t.remove && !t.isDead && t.row === enemyRow
    );

    if (candidatas.length === 0) {
      // sem alvo nessa linha → segue andando
      enemy.speed = enemy.baseSpeed ?? enemy.speed;
      if (enemy.state !== "attack") setAnim(enemy, "walking");
      return;
    }

    // escolhe a mais próxima dentro do alcance em COLUNAS
    const alcanceCols = enemy.alcance ?? 1;
    const noAlcance = candidatas
      .filter((t) => Math.abs(t.col - enemyCol) <= alcanceCols)
      .sort((a, b) => Math.abs(a.col - enemyCol) - Math.abs(b.col - enemyCol));

    const alvo = noAlcance[0];

    if (!alvo) {
      // ninguém no alcance → segue andando
      enemy.speed = enemy.baseSpeed ?? enemy.speed;
      if (enemy.state !== "attack") setAnim(enemy, "walking");
      return;
    }

    // guarda velocidade original se ainda não guardou
    if (enemy.baseSpeed == null) enemy.baseSpeed = enemy.speed;

    // Queremos parar um pouco ANTES da borda direita da célula da tropa
    // Borda direita da célula da tropa = (alvo.col + 1) * tileWidth
    const desiredStopX = (alvo.col + 1) * tileWidth - approachPadPx;

    if (enemy.x > desiredStopX) {
      // ainda não encostou o suficiente → continua andando
      enemy.speed = enemy.baseSpeed;
      if (enemy.state !== "attack") setAnim(enemy, "walking");
      return;
    }

    // chegou na distância ideal → para e interage
    enemy.speed = 0;

    if (enemy.canAttack && enemy.canAttack()) {
      enemy.attack(alvo);       // chama takeDamage e seta cooldown interno
      setAnim(enemy, "attack"); // animação de ataque
      if (alvo.hp <= 0) {
        alvo.startDeath?.();
      }
    } else {
      // aguardando cooldown → fica em idle
      if (enemy.state !== "attack") setAnim(enemy, "idle");
    }
  });

  // limpeza de tropas que terminaram o fade (se você não fizer em outro lugar)
  gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
},

};
