import { useRef, useEffect, useState, useMemo } from "react";
import { Troop, troopTypes, troopAnimations } from "./entities/Troop";
import { Enemy } from "./entities/Enemy";
import { waveConfig } from "./entities/WaveConfig";
import { tileCols, tileRows, tileWidth, tileHeight } from "./entities/Tiles";
import { CollisionManager } from "./engine/CollisionManager";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
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
      construcoes: {
        ...estadoAtual.construcoes,
        ...(atual.construcoes ?? {}),
      },
    };

    //onEstadoAtualChange?.(atualizado);

    if (atual.energia !== undefined) {
      setEnergia(atual.energia);
      energiaRef.current = atual.energia;
    }

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
  const inimigosTotaisRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTroop, setDraggedTroop] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [modoRemocao, setModoRemocao] = useState(false);
  const [energia, setEnergia] = useState(estadoAtual.energia);
  const energiaRef = useRef(energia);
  const [openDialog, setOpenDialog] = useState(false);
  const [dadosVitoria, setDadosVitoria] = useState({
    inimigosMortos: 0,
  });

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

        // 🔹 atualiza fade de morte
        t.updateDeath?.();

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

        // 🔹 aplica opacidade
        ctx.save();
        ctx.globalAlpha = t.opacity ?? 1;

        ctx.drawImage(
          img,
          x - larguraDesejada / 2,
          y - alturaDesejada / 2,
          larguraDesejada,
          alturaDesejada
        );
        ctx.restore();

        // 🔹 barra de vida da tropa (acima do sprite)
        const maxHpTroop = t.maxHp ?? t.config.hp ?? 1;
        const hpRatio = Math.max(0, t.hp) / maxHpTroop;

        const barWidth = 30;
        const barHeight = 4;
        const barX = x - barWidth / 2;
        const barY = y - alturaDesejada / 2 - 10; // 10px acima do topo do sprite

        ctx.save();
        ctx.globalAlpha = t.opacity ?? 1; // acompanha o fade da morte
        ctx.fillStyle = "red";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = "lime";
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

        // (opcional) contorno
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.restore();
      });

      // Inimigos
      gameRef.current.inimigos.forEach((e) => {
        // 1) pega os frames do estado atual (novo sistema) ou cai pro legado (e.frames)
        const frames =
          (e.framesByState && e.state && e.framesByState[e.state]) ||
          e.frames ||
          [];

        const img = frames[e.frameIndex];
        if (!img || !img.complete) return;

        // 2) desenha sprite (como antes)
        const escala = 0.2;
        const larguraDesejada = 217 * escala;
        const alturaDesejada = 425 * escala;
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

        // 3) barra de vida com contorno
        const barWidth = 30;
        const barHeight = 4;
        const barX = e.x - barWidth / 2;
        const barY = y - 30;

        // fundo vermelho
        ctx.fillStyle = "red";
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // preenchimento verde proporcional
        ctx.fillStyle = "lime";
        ctx.fillRect(barX, barY, (barWidth * e.hp) / e.maxHp, barHeight);

        // contorno
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
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

        // Inimigos atacam tropas
        CollisionManager.inimigosAtacam(gameRef.current);

        // Fim de jogo
        if (gameRef.current.inimigos.some((e) => e.x <= 50)) {
          setJogoEncerrado(true);
          return;
        }

        // Atualizar projéteis e verificar colisões
        CollisionManager.updateProjectilesAndCheckCollisions(gameRef.current);

        // Inimigos atacam
        CollisionManager.inimigosAtacam(gameRef.current);

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
            console.log(tiposDisponiveis);
            gameRef.current.inimigos.push(new Enemy(tipoAleatorio, row));
            inimigosCriadosRef.current += 1;
            inimigosTotaisRef.current += 1; // contador global total

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

          if (onda == 1) {
            //LIMITE_DE_ONDAS) {

            // Para o loop
            setJogoEncerrado(true);
            clearInterval(loopId); // para o intervalo atual

            // 1️⃣ Contar tropas que estão em campo
            const tropasEmCampo = gameRef.current.tropas;
            const tropasParaRetornar = {};
            const novosPacientes = [];

            tropasEmCampo.forEach((tropa, idx) => {
              const tipo = tropa.tipo;
              const cfg = troopTypes[tipo];
              if (!cfg?.retornaAoFinal) return; // só retorna quem deve voltar

              // hp e maxHp são números simples no objeto da tropa
              const hpAtual = Number.isFinite(tropa.hp)
                ? tropa.hp
                : tropa.hp?.current ?? 0;

              const hpMax = Number.isFinite(tropa.maxHp)
                ? tropa.maxHp
                : tropa.hp?.max ?? tropa.config?.hp ?? 1;

              const ratio = hpMax > 0 ? hpAtual / hpMax : 1;

              // todos contam como "retornaram" para a colônia
              tropasParaRetornar[tipo] = (tropasParaRetornar[tipo] || 0) + 1;

              // 100% = normal | [50%, 99%] => leve | (<50%) => grave
              if (ratio < 1) {
                const severidade = ratio >= 0.5 ? "leve" : "grave";

                novosPacientes.push({
                  id: `pac_${estadoAtual.turno}_${Date.now()}_${idx}`,
                  tipo: "colono", // schema aceita "colono"|"explorador"; mantemos "colono"
                  refId: null,
                  severidade, // "leve" ou "grave"
                  entrouEm: Date.now(),
                  turnosRestantes: severidade === "grave" ? 3 : 1,
                  origem: `combate_${tipo}`, // preserva o tipo real da tropa para relatórios
                  status: "fila",
                });
              }
            });

            // 2) Atualizar hospital (empurra só para a fila; admissão acontece na simulação/turno)
            const hospitalAtual = estadoAtual.hospital ?? {
              fila: [],
              internados: [],
              historicoAltas: [],
            };
            const novoHospital = {
              ...hospitalAtual,
              fila: [...(hospitalAtual.fila || []), ...novosPacientes],
            };

            // 3) Atualizar população e estado (eles voltam para a colônia, mesmo que feridos)
            const novaPopulacao = { ...estadoAtual.populacao };
            Object.entries(tropasParaRetornar).forEach(([t, qtd]) => {
              if (t === "colono") novaPopulacao.colonos += qtd;
              if (t === "marine") novaPopulacao.marines += qtd;
              // se tiver outros tipos, trate aqui
            });

            const novoEstado = {
              ...estadoAtual,
              energia: energiaRef.current,
              populacao: novaPopulacao,
              hospital: novoHospital,
            };

            await atualizarEstado(novoEstado, true);

            // 4) Agregar dados para o diálogo
            const feridosLeves = novosPacientes.filter(
              (p) => p.severidade === "leve"
            ).length;
            const feridosGraves = novosPacientes.filter(
              (p) => p.severidade === "grave"
            ).length;

            const feridosPorTipo = novosPacientes.reduce((acc, p) => {
              let t = "desconhecido";
              if (
                typeof p.origem === "string" &&
                p.origem.startsWith("combate_")
              ) {
                t = p.origem.replace("combate_", "");
              }
              if (!acc[t]) acc[t] = { leve: 0, grave: 0, total: 0 };
              acc[t][p.severidade] += 1;
              acc[t].total += 1;
              return acc;
            }, {});

            setDadosVitoria({
              inimigosMortos: inimigosTotaisRef.current,
              tropasRetornadas: tropasParaRetornar,
              feridos: {
                total: feridosLeves + feridosGraves,
                leve: feridosLeves,
                grave: feridosGraves,
              },
              feridosPorTipo,
            });

            // 5️⃣ Abrir o Dialog (não navegar ainda)
            setOpenDialog(true);
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

    const novaEnergia = energiaRef.current - troopTypes[draggedTroop].preco;
    const novaPopulacao = { ...estadoAtual.populacao };
    const novaConstrucoes = { ...estadoAtual.construcoes };

    if (draggedTroop === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (draggedTroop === "marine" && novaPopulacao.marines > 0) {
      novaPopulacao.marines -= 1;
      estadoAtual.populacao.marines -= 1;
    } else if (
      draggedTroop === "muralhaReforcada" &&
      novaConstrucoes.muralhaReforcada > 0
    ) {
      novaConstrucoes.muralhaReforcada -= 1;
      estadoAtual.construcoes.muralhaReforcada -= 1;
    }

    // Aqui criamos um novo objeto de estado (sem mutar o antigo)
    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
      construcoes: novaConstrucoes,
    };

    onEstadoChange(novoEstado); // Dispara re-render do HUD

    atualizarEstado(
      {
        energia: novaEnergia,
        populacao: novaPopulacao,
        construcoes: novaConstrucoes,
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
        const novaConstrucoes = { ...estadoAtual.construcoes };

        // Ajusta o tipo removido
        if (tipo === "colono") {
          novaPopulacao.colonos += 1;
          estadoAtual.populacao.colonos += 1;
        } else if (tipo === "marine") {
          novaPopulacao.marines += 1;
          estadoAtual.populacao.marines += 1;
        } else if (tipo === "muralhaReforcada") {
          novaConstrucoes.muralhaReforcada += 1;
          estadoAtual.construcoes.muralhaReforcada += 1;
        }

        // Aqui criamos um novo objeto de estado (sem mutar o antigo)
        const novoEstado = {
          ...estadoAtual,
          energia: energiaRef.current + novaEnergia,
          populacao: novaPopulacao,
          construcoes: novaConstrucoes,
        };

        onEstadoChange(novoEstado); // Dispara re-render do HUD

        // Atualiza estado
        atualizarEstado(
          {
            energia: energiaRef.current + novaEnergia,
            populacao: novaPopulacao,
            construcoes: novaConstrucoes,
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
    const novaConstrucoes = { ...estadoAtual.construcoes };

    if (draggedTroop === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (draggedTroop === "marine" && novaPopulacao.marines > 0) {
      novaPopulacao.marines -= 1;
      estadoAtual.populacao.marines -= 1;
    } else if (
      draggedTroop === "muralhaReforcada" &&
      novaPopulacao.muralhaReforcada > 0
    ) {
      novaConstrucoes.muralhaReforcada -= 1;
      estadoAtual.novaConstrucoes.muralhaReforcada -= 1;
    }

    // Aqui criamos um novo objeto de estado (sem mutar o antigo)
    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
      construcoes: novaConstrucoes,
    };

    onEstadoChange(novoEstado); // Dispara re-render do HUD

    atualizarEstado(
      {
        energia: novaEnergia,
        populacao: novaPopulacao,
        construcoes: novaConstrucoes,
      },
      true
    );

    setTropaSelecionada(null);
  };

  const energyCSS = `
@keyframes pulseEnergy {
  0%, 100% {
    color: #FCD34D;             /* amarelo (tailwind amber-300) */
    text-shadow: 0 0 0 rgba(250, 204, 21, 0);
  }
  50% {
    color: #FFEB3B;             /* amarelo vivo */
    text-shadow: 0 0 10px rgba(250, 204, 21, .85);
  }
}
.energyPulse {
  display: block;
  margin-bottom: 10px;
  font-weight: 800;
  animation: pulseEnergy 1.2s ease-in-out infinite;
}
`;

  const getTroopThumb = (tipo) => {
    const ani = troopAnimations?.[tipo] || {};
    const img = ani?.idle?.[0] || ani?.defense?.[0] || ani?.attack?.[0];
    return img?.src || null;
  };

  const stockMap = {
    colono: ["populacao", "colonos"], // plural no estado
    marine: ["populacao", "marines"], // plural no estado
    muralhaReforcada: ["construcoes", "muralhaReforcada"],
  };

  const getByPath = (obj, path) =>
    path.reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);

  const getDisponivel = (tipo) => {
    const path = stockMap[tipo];
    if (!path) return 0;
    const val = getByPath(estadoAtual, path);
    return typeof val === "number" ? val : 0;
  };

  const isDisabledTroop = (tipo, config) => {
    const disponivel = getDisponivel(tipo);
    return energia < config.preco || disponivel <= 0;
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      <style>{energyCSS}</style>

      <div style={{ marginRight: "16px", minWidth: "180px" }}>
        <strong className="energyPulse">⚡ Energia: {energia}</strong>

        <div
          className="w-24 bg-gray-800 border-r border-gray-700 p-3 overflow-y-auto flex flex-col items-center space-y-4"
          style={{ userSelect: "none" }} // evita seleção durante o arrasto
        >
          {Object.entries(troopTypes).map(([tipo, config]) => {
            const disabled = isDisabledTroop(tipo, config);
            const thumb = getTroopThumb(tipo);
            const disponivel = getDisponivel(tipo);
            const selected = draggedTroop === tipo || tropaSelecionada === tipo;

            return (
              <button
                key={tipo}
                type="button"
                // previne drag nativo e já inicia seu arrasto custom
                onMouseDown={(e) => {
                  if (disabled) return;
                  e.preventDefault(); // evita iniciar drag nativo / seleção
                  handleMouseDown(tipo);
                }}
                onDragStart={(e) => e.preventDefault()} // desativa DnD HTML5
                disabled={disabled}
                title={`${tipo} (${config.preco})`}
                className={[
                  "relative w-16 h-24 rounded-lg flex flex-col items-center justify-center p-2 transition",
                  disabled
                    ? "bg-gray-700 opacity-40 cursor-not-allowed"
                    : "bg-gray-700 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
                  selected ? "ring-2 ring-blue-400" : "",
                ].join(" ")}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={tipo}
                    draggable={false} // impede DnD nativo
                    onDragStart={(e) => e.preventDefault()}
                    className="w-12 h-12 object-contain rounded mb-1 border-2 border-blue-500 bg-gray-900/30"
                    style={{
                      WebkitUserDrag: "none",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded mb-1 bg-gray-600" />
                )}

                <span className="text-[10px] leading-tight text-center capitalize">
                  {tipo}
                </span>

                {/* Preço */}
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {config.preco}
                </div>

                {/* Quantidade disponível */}
                <div className="absolute -bottom-2 -right-2 bg-gray-900 text-white text-[10px] font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  x{disponivel}
                </div>
              </button>
            );
          })}

          {/* Remover tropa */}
          <button
            type="button"
            onClick={() => {
              setModoRemocao(true);
              setTropaSelecionada(null);
            }}
            className="mt-2 w-16 h-24 bg-gray-700 hover:bg-gray-600 text-red-300 rounded-lg flex flex-col items-center justify-center p-2 transition"
            title="Remover Tropa"
          >
            <span className="text-xl mb-1">💥</span>
            <span className="text-[10px] text-center">Remover</span>
          </button>
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
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle
          style={{
            backgroundColor: "#4CAF50",
            color: "#FFF",
            textAlign: "center",
            fontFamily: "Press Start 2P, cursive",
          }}
        >
          🏆 Vitória Épica! 🎮
        </DialogTitle>

        <DialogContent>
          <Typography gutterBottom>
            Você sobreviveu a todas as ondas e derrotou{" "}
            <strong>{dadosVitoria.inimigosMortos}</strong> inimigos ferozes!
          </Typography>

          {dadosVitoria.tropasRetornadas &&
            Object.keys(dadosVitoria.tropasRetornadas).length > 0 && (
              <>
                <Typography gutterBottom>
                  As seguintes tropas conseguiram voltar para casa triunfantes:
                </Typography>
                <ul>
                  {Object.entries(dadosVitoria.tropasRetornadas).map(
                    ([tipo, qtd]) => (
                      <li key={tipo}>
                        <Typography>
                          {tipo.charAt(0).toUpperCase() + tipo.slice(1)}:{" "}
                          <strong>{qtd}</strong>
                        </Typography>
                      </li>
                    )
                  )}
                </ul>
              </>
            )}

          {/* NOVO: resumo de atendimento médico */}
          {dadosVitoria.feridos && dadosVitoria.feridos.total > 0 && (
            <>
              <Typography sx={{ mt: 2 }} gutterBottom>
                🏥 <strong>Atendimento médico</strong>
              </Typography>
              <Typography gutterBottom>
                Encaminhados ao hospital:{" "}
                <strong>{dadosVitoria.feridos.total}</strong>{" "}
                {`(leve: ${dadosVitoria.feridos.leve}, grave: ${dadosVitoria.feridos.grave})`}
              </Typography>

              {/* Opcional: detalhar por tipo (marine, colono, etc.) se houver */}
              {dadosVitoria.feridosPorTipo &&
                Object.keys(dadosVitoria.feridosPorTipo).length > 0 && (
                  <>
                    <Typography gutterBottom>Detalhe por tropa:</Typography>
                    <ul>
                      {Object.entries(dadosVitoria.feridosPorTipo).map(
                        ([tipo, stats]) => (
                          <li key={tipo}>
                            <Typography>
                              {tipo.charAt(0).toUpperCase() + tipo.slice(1)}:{" "}
                              <strong>{stats.total}</strong>{" "}
                              {`(leve: ${stats.leve}, grave: ${stats.grave})`}
                            </Typography>
                          </li>
                        )
                      )}
                    </ul>
                  </>
                )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => navigate("/jogo")}
            style={{ fontFamily: "Press Start 2P, cursive" }}
          >
            Voltar para o Jogo
          </Button>
        </DialogActions>
      </Dialog>
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
