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
  inimigosAtacam(gameRef) {
    gameRef.inimigos.forEach((enemy) => {
      const enemyRow = enemy.row;
      const enemyCol = Math.floor(enemy.x / tileWidth);

      const alvo = gameRef.tropas.find(
        (t) =>
          !t.remove &&
          t.row === enemyRow &&
          Math.abs(t.col - enemyCol) <= (enemy.alcance ?? 1)
      );

      if (alvo) {
        // para para atacar
        enemy.speed = 0;

        if (enemy.canAttack()) {
          enemy.attack(alvo); // estado 'attack' + reseta cooldown
        } else {
          // aguardando cooldown
          if (enemy.state !== "attack") {
            enemy.state = "idle";
            enemy.frameIndex = 0;
            enemy.frameTick = 0;
          }
        }
      } else {
        // sem alvo -> volta a andar
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
        if (enemy.state !== "attack") {
          enemy.state = "walking";
        }
      }
    });
  },
};
