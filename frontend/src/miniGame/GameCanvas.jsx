import { useRef, useEffect, useState, useMemo } from "react";
import { Troop, troopTypes, troopAnimations } from "./entities/Troop";
import { Enemy } from "./entities/Enemy";
import { waveConfig } from "./entities/WaveConfig";
import { tileCols, tileRows, tileWidth, tileHeight } from "./entities/Tiles";
import { CollisionManager } from "./engine/CollisionManager";
import Button from "@mui/material/Button";
import { useNavigate } from "react-router-dom";
import coloniaService from "../services/coloniaService";
import centro from "./assets/tiles/groundCentro.png";
import teto from "./assets/tiles/groundTeto.png";
import tetoD from "./assets/tiles/groundSuperiorD.png";
import tetoE from "./assets/tiles/groundSuperiorE.png";
import CantoD from "./assets/tiles/groundDireito.png";
import CantoE from "./assets/tiles/groundEsquerdo.png";
import chao from "./assets/tiles/groundInferior.png";
import chaoD from "./assets/tiles/groundInferiorD.png";
import chaoE from "./assets/tiles/groundInferiorE.png";

import { groundMap, estaNaAreaDeCombate } from "./entities/mapData";

const tileImages = {
  teto: new Image(),
  centro: new Image(),
  tetoD: new Image(),
  tetoE: new Image(),
  CantoD: new Image(),
  CantoE: new Image(),
  chao: new Image(),
  chaoD: new Image(),
  chaoE: new Image(),
};

// Atribuindo as fontes das imagens
tileImages.teto.src = teto;
tileImages.centro.src = centro;
tileImages.tetoD.src = tetoD;
tileImages.tetoE.src = tetoE;
tileImages.CantoD.src = CantoD;
tileImages.CantoE.src = CantoE;
tileImages.chao.src = chao;
tileImages.chaoD.src = chaoD;
tileImages.chaoE.src = chaoE;

const GameCanvas = ({ estadoAtual, onEstadoChange }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    tropas: [],
    inimigos: [],
    projectilePool: [],
  });

  const navigate = useNavigate();

  const LIMITE_DE_ONDAS = estadoAtual.turno;

  const atualizarEstado = async (novosDados, sincronizarBackend = false) => {
    const atual =
      typeof novosDados === "function"
        ? novosDados({ ...estadoAtual, energia: energiaRef.current })
        : novosDados;

    const atualizado = {
      ...estadoAtual,
      ...atual,
      populacao: {
        ...estadoAtual.populacao,
        ...(atual.populacao || {}),
      },
    };

    //onEstadoAtualChange?.(atualizado);

    if (atual.energia !== undefined) {
      setEnergia(atual.energia);
      energiaRef.current = atual.energia;
    }
    console.log("atualizado = " + JSON.stringify(atualizado));

    if (sincronizarBackend) {
      try {
        await coloniaService.atualizarColonia(estadoAtual._id, atualizado);
      } catch (err) {
        console.error("Erro ao sincronizar com backend:", err);
      }
    }
  };

  const [tropaSelecionada, setTropaSelecionada] = useState(null);
  const [jogoEncerrado, setJogoEncerrado] = useState(false);
  const [onda, setOnda] = useState(1);
  const [contadorSpawn, setContadorSpawn] = useState(0);
  const [modoPreparacao, setModoPreparacao] = useState(true);
  const inimigosCriadosRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTroop, setDraggedTroop] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [modoRemocao, setModoRemocao] = useState(false);
  const [energia, setEnergia] = useState(estadoAtual.energia);
  const energiaRef = useRef(energia);

  // Sincroniza energia local caso prop mude (ex: reinício, recarga etc)
  useEffect(() => {
    setEnergia(estadoAtual.energia);
    energiaRef.current = estadoAtual.energia;
  }, [estadoAtual.energia]);

  // Desenho com frame por frame
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let animationId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      //Mapa Canvas
      for (let row = 0; row < tileRows; row++) {
        for (let col = 0; col < tileCols; col++) {
          const tipo = groundMap[row][col] || "grass";
          const img = tileImages[tipo];
          const x = col * tileWidth;
          const y = row * tileHeight;

          // desenha tile normalmente
          if (img.complete) {
            ctx.drawImage(img, x, y, tileWidth, tileHeight);
          }

          // destaque visual para área de combate
          if (estaNaAreaDeCombate(row, col)) {
            ctx.strokeStyle = "#00ff00"; // verde claro
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, tileWidth - 2, tileHeight - 2);
          } else {
            // opcional: escurece fora da área de combate
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillRect(x, y, tileWidth, tileHeight);
          }
        }
      }

      // TROPAS
      gameRef.current.tropas.forEach((t) => {
        t.updateAnimation?.(); // chama animação por frame

        const framesByState = troopAnimations[t.tipo];
        const frames = framesByState?.[t.state];
        if (!frames || frames.length === 0) return;

        const img = frames[t.frameIndex || 0];
        if (!img || !img.complete) return;

        const escala = 1;
        const larguraDesejada = img.width * escala;
        const alturaDesejada = img.height * escala;

        const x = t.col * tileWidth + tileWidth / 2;
        const y = t.row * tileHeight + tileHeight / 2;

        ctx.drawImage(
          img,
          x - larguraDesejada / 2,
          y - alturaDesejada / 2,
          larguraDesejada,
          alturaDesejada
        );
      });

      //Inimigos
      gameRef.current.inimigos.forEach((e) => {
        const img = e.frames[e.frameIndex];
        const escala = 0.2;
        const larguraDesejada = 217 * escala; // ≈ 162.75
        const alturaDesejada = 425 * escala; // ≈ 318.75
        const y = e.row * tileHeight + tileHeight / 2;

        ctx.save();
        ctx.translate(e.x, y);
        ctx.scale(-1, 1);
        ctx.drawImage(
          img,
          -larguraDesejada / 2,
          -alturaDesejada / 2,
          larguraDesejada,
          alturaDesejada
        );
        ctx.restore();

        // Barra de vida
        ctx.fillStyle = "red";
        ctx.fillRect(e.x - 15, y - 30, 30, 4);
        ctx.fillStyle = "lime";
        ctx.fillRect(e.x - 15, y - 30, (30 * e.hp) / e.maxHp, 4);
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
        const frames = troopAnimations[draggedTroop]?.idle;
        const img = frames?.[0];

        if (img && img.complete) {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(img, dragPosition.x - 25, dragPosition.y - 25, 50, 50);
          ctx.globalAlpha = 1.0;
        }
      }

      if (jogoEncerrado) {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText("GAME OVER", 400, 288);
      }

      animationId = requestAnimationFrame(draw); // apenas aqui
    };

    animationId = requestAnimationFrame(draw); // chama uma vez fora
    return () => cancelAnimationFrame(animationId);
  }, [jogoEncerrado, isDragging, dragPosition]);

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setDragPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  function obterLinhasDeCombateValidas() {
    const linhasValidas = [];
    for (let row = 0; row < tileRows; row++) {
      if (estaNaAreaDeCombate(row, 1)) {
        // qualquer coluna dentro da área
        linhasValidas.push(row);
      }
    }
    return linhasValidas;
  }

  // GAME LOOP
  useEffect(() => {
    const linhasValidasParaSpawn = obterLinhasDeCombateValidas();

    const loopId = setInterval(() => {
      (async () => {
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
          return;
        }

        // Atualizar projéteis e verificar colisões
        CollisionManager.updateProjectilesAndCheckCollisions(gameRef.current);

        // Tropas atacam
        CollisionManager.tropasAtacam(gameRef.current);

        // Spawn de inimigos
        setContadorSpawn((contadorAnterior) => {
          const novoContador = contadorAnterior + 1;

          const podeSpawnar =
            novoContador >= waveConfig.frequenciaSpawn &&
            inimigosCriadosRef.current < waveConfig.quantidadePorOnda(onda);

          if (podeSpawnar) {
            const row =
              linhasValidasParaSpawn[
                Math.floor(Math.random() * linhasValidasParaSpawn.length)
              ];

            const tiposDisponiveis = ["alienVermelho", "alienBege"];
            const tipoAleatorio =
              tiposDisponiveis[
                Math.floor(Math.random() * tiposDisponiveis.length)
              ];

            gameRef.current.inimigos.push(new Enemy(tipoAleatorio, row));
            inimigosCriadosRef.current += 1;

            return 0; // zera o contador de spawn
          }

          return novoContador;
        });

        // Verifica fim da onda
        const todosInimigosMortos = gameRef.current.inimigos.length === 0;
        const todosInimigosGerados =
          inimigosCriadosRef.current >= waveConfig.quantidadePorOnda(onda);

        if (!modoPreparacao && todosInimigosMortos && todosInimigosGerados) {
          console.log("ENERGIA = " + energiaRef.current);

          if (onda >= LIMITE_DE_ONDAS) {
            // Final do jogo: atualiza energia e retorna
            await atualizarEstado({ energia: energiaRef.current }, true);

            const novaColonia = await coloniaService.buscarColonia(
              estadoAtual.nome
            );
            onEstadoChange?.(novaColonia);
            navigate("/jogo");
          } else {
            // Próxima onda
            setModoPreparacao(true);
            setOnda((o) => o + 1);
          }
        }

        console.log("Inimigos Criados:", inimigosCriadosRef.current);
      })();
    }, 32); // Frame rate

    return () => clearInterval(loopId); // ✅ limpa corretamente o intervalo
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

    if (!estaNaAreaDeCombate(row, col)) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

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
    console.log("ENERGIA == " + JSON.stringify(energiaRef));

    const novaEnergia = energiaRef.current - troopTypes[draggedTroop].preco;
    const novaPopulacao = { ...estadoAtual.populacao };

    if (draggedTroop === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (draggedTroop === "marine" && novaPopulacao.marines > 0) {
      novaPopulacao.marines -= 1;
      estadoAtual.populacao.marines -= 1;
    }

    // Aqui criamos um novo objeto de estado (sem mutar o antigo)
    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
    };

    onEstadoChange(novoEstado); // Dispara re-render do HUD

    atualizarEstado(
      {
        energia: novaEnergia,
        populacao: novaPopulacao,
      },
      true
    );

    setIsDragging(false);
    setDraggedTroop(null);
  };

  const handleClick = (e) => {
    if (jogoEncerrado) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const col = Math.floor(x / tileWidth);
    const row = Math.floor(y / tileHeight);

    if (!estaNaAreaDeCombate(row, col)) return;

    if (modoRemocao) {
      const index = gameRef.current.tropas.findIndex(
        (t) => t.row === row && t.col === col
      );

      if (index !== -1) {
        const tipo = gameRef.current.tropas[index].tipo;
        gameRef.current.tropas.splice(index, 1);
        const novaEnergia = Math.floor(troopTypes[tipo].preco / 2);

        // Clona população atual
        const novaPopulacao = { ...estadoAtual.populacao };

        // Ajusta o tipo removido
        if (tipo === "colono") {
          novaPopulacao.colonos += 1;
          estadoAtual.populacao.colonos += 1;
        } else if (tipo === "marine") {
          novaPopulacao.marines += 1;
          estadoAtual.populacao.marines += 1;
        }

        // Aqui criamos um novo objeto de estado (sem mutar o antigo)
        const novoEstado = {
          ...estadoAtual,
          energia: novaEnergia,
          populacao: novaPopulacao,
        };

        onEstadoChange(novoEstado); // Dispara re-render do HUD

        // Atualiza estado
        atualizarEstado(
          {
            energia: energiaRef.current + novaEnergia,
            populacao: novaPopulacao,
          },
          true
        );
      }

      setModoRemocao(false); // sair do modo após clique
      return;
    }

    if (!tropaSelecionada) return;

    const ocupado = gameRef.current.tropas.some(
      (t) => t.row === row && t.col === col
    );
    if (ocupado) return;

    if (energia < troopTypes[tropaSelecionada].preco) return;

    gameRef.current.tropas.push(new Troop(tropaSelecionada, row, col));

    const novaEnergia = energiaRef.current - troopTypes[draggedTroop].preco;
    const novaPopulacao = { ...estadoAtual.populacao };

    if (draggedTroop === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (draggedTroop === "marine" && novaPopulacao.marines > 0) {
      novaPopulacao.marines -= 1;
      estadoAtual.populacao.marines -= 1;
    }

    // Aqui criamos um novo objeto de estado (sem mutar o antigo)
    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
    };

    onEstadoChange(novoEstado); // Dispara re-render do HUD

    atualizarEstado(
      {
        energia: novaEnergia,
        populacao: novaPopulacao,
      },
      true
    );

    setTropaSelecionada(null);
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {/* Coluna lateral esquerda com botões */}
      <div style={{ marginRight: "16px", minWidth: "180px" }}>
        <strong style={{ display: "block", marginBottom: "10px" }}>
          ⚡ Energia: {energia}
        </strong>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {Object.entries(troopTypes).map(([tipo, config]) => (
            <Button
              key={tipo}
              variant="contained"
              color="primary"
              onMouseDown={() => handleMouseDown(tipo)}
              disabled={
                energia < config.preco ||
                (tipo === "colono" && estadoAtual.populacao.colonos <= 0) ||
                (tipo === "marine" && estadoAtual.populacao.marines <= 0)
              }
            >
              {getEmoji(tipo)} {capitalize(tipo)} ({config.preco})
            </Button>
          ))}

          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              setModoRemocao(true);
              setTropaSelecionada(null); // desfaz seleção de compra
            }}
          >
            💥 Remover Tropa
          </Button>
        </div>

        <p style={{ marginTop: "20px" }}>
          <strong>🌀 Onda: {onda}</strong>
        </p>

        {modoPreparacao && (
          <div style={{ marginTop: "10px" }}>
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
      </div>

      {/* Canvas ao lado direito */}
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
