// src/engine/CollisionManager.js

import { Projectile } from "../entities/Projectile";
import { tileWidth, tileHeight } from "../entities/Tiles";

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
};
