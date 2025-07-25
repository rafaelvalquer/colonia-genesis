import { renderScene } from "./Renderer";

export function startGameLoop(ctx, gameState) {
  let lastTime = 0;

  function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // Atualização de lógica (ainda não implementada)

    // Renderização
    renderScene(ctx, gameState);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
}
