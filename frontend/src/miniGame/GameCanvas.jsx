import { useRef, useEffect, useState } from "react";
import { Troop, troopTypes } from "./entities/Troop";
import { Enemy, enemyTypes } from "./entities/Enemy";
import { Projectile } from "./entities/Projectile";
import { waveConfig } from "./entities/WaveConfig";
import { tileCols, tileRows, tileWidth, tileHeight } from "./entities/Tiles";

const GameCanvas = () => {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    tropas: [],
    inimigos: [],
    projectilePool: [],
  });

  const [tropaSelecionada, setTropaSelecionada] = useState(null);
  const [moedas, setMoedas] = useState(100);
  const [jogoEncerrado, setJogoEncerrado] = useState(false);
  const [onda, setOnda] = useState(1);
  const [contadorSpawn, setContadorSpawn] = useState(0);

  // Desenho com frame por frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // GRID
      for (let row = 0; row < tileRows; row++) {
        for (let col = 0; col < tileCols; col++) {
          const x = col * tileWidth;
          const y = row * tileHeight;
          ctx.strokeStyle = "#444";
          ctx.strokeRect(x, y, tileWidth, tileHeight);
        }
      }

      // TROPAS
      gameRef.current.tropas.forEach((t) => {
        const x = t.col * tileWidth + tileWidth / 2;
        const y = t.row * tileHeight + tileHeight / 2;
        ctx.fillStyle = troopTypes[t.tipo].cor;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.fillText(t.tipo[0].toUpperCase(), x - 5, y + 5);
      });

      // INIMIGOS
      gameRef.current.inimigos.forEach((e) => {
        const x = e.x;
        const y = e.row * tileHeight + tileHeight / 2;
        ctx.fillStyle = e.hitTimer > 0 ? "white" : e.cor;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fill();

        // Barra de vida
        ctx.fillStyle = "red";
        ctx.fillRect(x - 15, y - 25, 30, 4);
        ctx.fillStyle = "lime";
        ctx.fillRect(x - 15, y - 25, (30 * e.hp) / e.maxHp, 4);
      });

      // PROJÉTEIS
      gameRef.current.projectilePool.forEach((p) => {
        if (!p.active) return;

        const corProjetil = troopTypes[p.tipo]?.corProjetil || "white";

        ctx.save();
        ctx.shadowColor = corProjetil;
        ctx.shadowBlur = 10;
        ctx.fillStyle = corProjetil;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      });

      if (jogoEncerrado) {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", 400, 288);
      }

      requestAnimationFrame(draw);
    };

    draw();
  }, [jogoEncerrado]);

  // GAME LOOP
  useEffect(() => {
    const loop = setInterval(() => {
      if (jogoEncerrado) return;

      const { tropas, inimigos } = gameRef.current;

      // Move inimigos
      gameRef.current.inimigos = inimigos
        .map((e) => {
          e.updatePosition();
          return e;
        })
        .filter((e) => !e.isDead());

      // Fim de jogo
      if (gameRef.current.inimigos.some((e) => e.x <= 50)) {
        setJogoEncerrado(true);
      }

      // Atualizar projéteis e colisões
      gameRef.current.projectilePool.forEach((p) => {
        if (!p.active) return;

        p.update();

        // Colisão
        for (let i of gameRef.current.inimigos) {
          p.checkCollision(i);
          if (!p.active) break;
        }
      });

      // Tropas atacam
      tropas.forEach((t) => {
        t.updateCooldown();
        if (t.cooldown <= 0) {
          const alcance = t.config.alcance;
          const alvo = gameRef.current.inimigos.find(
            (e) =>
              e.row === t.row &&
              Math.floor(e.x / tileWidth) >= t.col &&
              Math.floor(e.x / tileWidth) <= t.col + alcance
          );

          if (alvo) {
            const projData = t.attack(tileWidth, tileHeight);
            projData.tipo = t.tipo;

            const proj = gameRef.current.projectilePool.find((p) => !p.active);
            if (proj) {
              Object.assign(proj, projData);
            } else {
              gameRef.current.projectilePool.push(new Projectile(projData));
            }
          }
        }
      });

      // Spawn de inimigos
      setContadorSpawn((contadorAnterior) => {
        const novoContador = contadorAnterior + 1;

        if (novoContador >= waveConfig.frequenciaSpawn) {
          const row = Math.floor(Math.random() * tileRows);

          // Pega os tipos possíveis para a onda atual
          const tiposDisponiveis = waveConfig.tiposPorOnda(onda);

          // Escolhe um tipo aleatório entre os disponíveis
          const tipoAleatorio =
            tiposDisponiveis[
              Math.floor(Math.random() * tiposDisponiveis.length)
            ];

          // Cria o inimigo baseado no tipo
          gameRef.current.inimigos.push(new Enemy(tipoAleatorio, row));

          return 0; // reseta contador após spawn
        }

        return novoContador;
      });

      // Progresso de onda (a cada 30s)
      if (Date.now() % 30000 < 100) {
        setOnda((o) => o + 1);
        setMoedas((m) => m + 20);
      }
      console.log("frameRate");
    }, 100); // 100 = ~10 FPS - 16 = ~60 FPS

    return () => clearInterval(loop);
  }, [jogoEncerrado, onda]);

  const handleClick = (e) => {
    if (!tropaSelecionada || jogoEncerrado) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / tileWidth);
    const row = Math.floor(y / tileHeight);

    // Impede posicionar sobre outra tropa
    const ocupado = gameRef.current.tropas.some(
      (t) => t.row === row && t.col === col
    );
    if (ocupado) return;

    if (moedas < troopTypes[tropaSelecionada].preco) return;

    gameRef.current.tropas.push(new Troop(tropaSelecionada, row, col));

    setTropaSelecionada(null);
    setMoedas((m) => m - troopTypes[tropaSelecionada].preco);
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <strong>Moedas: {moedas}</strong>
        <button onClick={() => setTropaSelecionada("arqueiro")}>
          🧝 Arqueiro (10)
        </button>
        <button onClick={() => setTropaSelecionada("guerreiro")}>
          🛡 Guerreiro (15)
        </button>
        <button onClick={() => setTropaSelecionada("mago")}>
          🧙 Mago (20)
        </button>
        <button onClick={() => setTropaSelecionada(null)}>❌ Cancelar</button>
      </div>
      <p>
        <strong>🌀 Onda: {onda}</strong>
      </p>
      <canvas
        ref={canvasRef}
        width={1024}
        height={576}
        style={{ background: "#202020", border: "2px solid #fff" }}
        onClick={handleClick}
      />
    </div>
  );
};

export default GameCanvas;
