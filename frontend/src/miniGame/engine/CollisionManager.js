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

      // tropas vivas na mesma linha
      const candidatas = gameRef.tropas.filter(
        (t) => !t.remove && !t.isDead && t.row === enemyRow
      );
      if (candidatas.length === 0) {
        // sem alvo nessa linha → segue andando
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
        return;
      }

      // escolhe a tropa mais próxima dentro do alcance (em COLUNAS)
      const alcanceCols = enemy.alcance ?? 1;
      const alvo = candidatas
        .filter((t) => Math.abs(t.col - enemyCol) <= alcanceCols)
        .sort(
          (a, b) => Math.abs(a.col - enemyCol) - Math.abs(b.col - enemyCol)
        )[0];

      if (!alvo) {
        // ninguém no alcance → segue andando
        enemy.speed = enemy.baseSpeed ?? enemy.speed;
        return;
      }

      // guarda velocidade original
      if (enemy.baseSpeed == null) enemy.baseSpeed = enemy.speed;

      // queremos que ele pare um pouco à direita da tropa (mais “próximo”)
      // borda direita da célula da tropa = (alvo.col + 1) * tileWidth
      const approachPadPx = -20; // ajuste fino da distância (px)
      const desiredStopX = (alvo.col + 1) * tileWidth - approachPadPx;

      if (enemy.x > desiredStopX) {
        // ainda não chegou perto o suficiente → continue andando
        enemy.speed = enemy.baseSpeed;
      } else {
        // chegou na distância ideal → para e ataca
        enemy.speed = 0;
        enemy.attack(alvo); // usa cooldown interno
        if (alvo.hp <= 0) {
          alvo.startDeath?.();
        }
      }
    });

    // limpa tropas que terminaram o fade de morte em outro ponto do loop se preferir
    gameRef.tropas = gameRef.tropas.filter((t) => !t.remove);
  },
};
