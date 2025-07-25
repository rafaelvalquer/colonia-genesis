import { useRef, useEffect, useState } from "react";
import { Troop, troopTypes } from "./entities/Troop";
import { Enemy } from "./entities/Enemy";
import { waveConfig } from "./entities/WaveConfig";
import { tileCols, tileRows, tileWidth, tileHeight } from "./entities/Tiles";
import { CollisionManager } from "./engine/CollisionManager";
import Button from "@mui/material/Button";

const GameCanvas = ({ estadoAtual, onEstadoAtualChange }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    tropas: [],
    inimigos: [],
    projectilePool: [],
  });

  const atualizarEstado = (novosDados) => {
    const atualizado = {
      ...estadoAtual,
      ...novosDados,
    };
    onEstadoAtualChange?.(atualizado); // só chama se função estiver definida
    // Atualiza energia local se estiver presente
    if (novosDados.energia !== undefined) {
      setEnergia(novosDados.energia);
    }
    // Se precisar sincronizar outros valores locais, adicione aqui
  };

  //console.log("População da colônia:", estadoAtual.populacao);
  //console.log("População da colônia:", JSON.stringify(estadoAtual));

  // Estado local para energia, iniciado com o valor da prop
  const [energia, setEnergia] = useState(estadoAtual.energia);

  // Sincroniza energia local caso prop mude (ex: reinício, recarga etc)
  useEffect(() => {
    setEnergia(estadoAtual.energia);
  }, [estadoAtual.energia]);

  const [tropaSelecionada, setTropaSelecionada] = useState(null);
  const [jogoEncerrado, setJogoEncerrado] = useState(false);
  const [onda, setOnda] = useState(1);
  const [contadorSpawn, setContadorSpawn] = useState(0);
  const [modoPreparacao, setModoPreparacao] = useState(true);
  const inimigosCriadosRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTroop, setDraggedTroop] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const troopImages = {
    colono: "https://placehold.co/50x50/4CAF50/FFFFFF?text=Arqueiro",
    marine: "https://placehold.co/50x50/2196F3/FFFFFF?text=marine",
    heavy: "https://placehold.co/50x50/9C27B0/FFFFFF?text=heavy",
  };

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

      // Desenha a tropa sendo arrastada
      if (isDragging && draggedTroop) {
        const img = new Image();
        img.src = troopImages[draggedTroop];
        ctx.globalAlpha = 0.7;
        ctx.drawImage(img, dragPosition.x - 25, dragPosition.y - 25, 50, 50);
        ctx.globalAlpha = 1.0;
      }

      if (jogoEncerrado) {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", 400, 288);
      }

      requestAnimationFrame(draw);
    };

    draw();
  }, [jogoEncerrado, isDragging, dragPosition]);

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setDragPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // GAME LOOP
  useEffect(() => {
    const loop = setInterval(() => {
      if (jogoEncerrado || modoPreparacao) return;

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
      CollisionManager.updateProjectilesAndCheckCollisions(gameRef.current);

      // Tropas atacam
      CollisionManager.tropasAtacam(gameRef.current);

      // Spawn de inimigos
      setContadorSpawn((contadorAnterior) => {
        const novoContador = contadorAnterior + 1;

        if (
          novoContador >= waveConfig.frequenciaSpawn &&
          inimigosCriadosRef.current < waveConfig.quantidadePorOnda(onda)
        ) {
          const row = Math.floor(Math.random() * tileRows);
          const tiposDisponiveis = waveConfig.tiposPorOnda(onda);
          const tipoAleatorio =
            tiposDisponiveis[
              Math.floor(Math.random() * tiposDisponiveis.length)
            ];

          gameRef.current.inimigos.push(new Enemy(tipoAleatorio, row));
          inimigosCriadosRef.current += 1;

          return 0;
        }

        return novoContador;
      });

      // Verifica fim da onda
      if (
        !modoPreparacao &&
        gameRef.current.inimigos.length === 0 &&
        inimigosCriadosRef.current >= waveConfig.quantidadePorOnda(onda)
      ) {
        setModoPreparacao(true);
        setOnda((o) => o + 1);
        atualizarEstado({ energia: energia + 20 });
      }

      console.log("Inimigos Criados:", inimigosCriadosRef.current);
    }, 100);

    return () => clearInterval(loop);
  }, [jogoEncerrado, onda, modoPreparacao]);

  const handleMouseDown = (troopType) => {
    if (energia < troopTypes[troopType].preco) return; // bloqueia se energia insuficiente
    setIsDragging(true);
    setDraggedTroop(troopType);
  };

  const handleMouseUp = (e) => {
    if (!isDragging || !draggedTroop) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / tileWidth);
    const row = Math.floor(y / tileHeight);

    // Impede posicionar sobre outra tropa
    const ocupado = gameRef.current.tropas.some(
      (t) => t.row === row && t.col === col
    );
    if (ocupado) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

    if (energia < troopTypes[draggedTroop].preco) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

    gameRef.current.tropas.push(new Troop(draggedTroop, row, col));
    atualizarEstado({ energia: energia - troopTypes[draggedTroop].preco }); // desconta energia
    setIsDragging(false);
    setDraggedTroop(null);
  };

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

    if (energia < troopTypes[tropaSelecionada].preco) return;

    gameRef.current.tropas.push(new Troop(tropaSelecionada, row, col));
    atualizarEstado({ energia: energia - troopTypes[tropaSelecionada].preco });
    setTropaSelecionada(null);
  };

  return (
    <div>
      <div className="mb-4">
        <strong className="block mb-2">⚡ Energia: {energia}</strong>

        <div className="flex flex-wrap gap-2">
          {Object.entries(troopTypes).map(([tipo, config]) => (
            <Button
              key={tipo}
              variant="contained"
              color="primary"
              onMouseDown={() => handleMouseDown(tipo)}
              disabled={energia < config.preco}
              sx={{ marginRight: 1, marginBottom: 1 }}
            >
              {getEmoji(tipo)} {capitalize(tipo)} ({config.preco})
            </Button>
          ))}

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => setTropaSelecionada(null)}
          >
            ❌ Cancelar
          </Button>
        </div>
      </div>

      <p>
        <strong>🌀 Onda: {onda}</strong>
      </p>

      {modoPreparacao && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => {
              setModoPreparacao(false);
              setContadorSpawn(0);
              inimigosCriadosRef.current = 0;
            }}
            style={{
              padding: "10px 20px",
              fontWeight: "bold",
              backgroundColor: "#4caf50",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            ▶️ Iniciar Onda {onda}
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={1024}
        height={576}
        style={{ background: "#202020", border: "2px solid #fff" }}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
    </div>
  );
};

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getEmoji(tipo) {
  const emojis = {
    colono: "🧑‍🌾",
    marine: "🪖",
    heavy: "🔫",
    grenadier: "💣",
    psi: "🧠",
  };
  return emojis[tipo] || "⚔️";
}

export default GameCanvas;
