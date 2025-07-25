import { cartToIso } from "../utils/IsoMath";

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;
const GRID_WIDTH = 10;
const GRID_HEIGHT = 6;

export function renderScene(ctx, gameState) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Desenha o grid isométrico
  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const { x: isoX, y: isoY } = cartToIso(x, y);

      const screenX = isoX + 400; // Offset para centralizar
      const screenY = isoY + 100;

      ctx.strokeStyle = "#666";
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
      ctx.lineTo(screenX, screenY + TILE_HEIGHT);
      ctx.lineTo(screenX - TILE_WIDTH / 2, screenY + TILE_HEIGHT / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Exemplo: desenhar uma tropa no tile (2,2)
  const tropaCoord = cartToIso(2, 2);
  const tropaX = tropaCoord.x + 400;
  const tropaY = tropaCoord.y + 100;

  ctx.fillStyle = "green";
  ctx.beginPath();
  ctx.arc(tropaX, tropaY + TILE_HEIGHT / 2, 10, 0, Math.PI * 2);
  ctx.fill();
}
