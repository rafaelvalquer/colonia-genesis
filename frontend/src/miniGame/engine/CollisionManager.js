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
          !t.remove && // não removida ainda
          t.row === enemyRow &&
          Math.abs(t.col - enemyCol) <= (enemy.alcance ?? 1)
      );

      if (alvo) {
        if (enemy.baseSpeed == null) enemy.baseSpeed = enemy.speed;
        enemy.speed = 0;
        enemy.attack(alvo); // chama takeDamage internamente
      } else {
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
      }
    });

    // remove só depois do fade
    gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
  },
};
