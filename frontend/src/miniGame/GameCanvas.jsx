// GameCanvas.jsx
import { useRef, useEffect, useState } from "react";
import { Troop, troopTypes, troopAnimations } from "./entities/Troop";
import { Enemy } from "./entities/Enemy";
import { waveConfig } from "./entities/WaveConfig";
import { tileCols, tileRows } from "./entities/Tiles";
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

// tiles
import centro1 from "./assets/tiles/groundCentro1.png";
import centro2 from "./assets/tiles/groundCentro2.png";
import teto from "./assets/tiles/groundTeto.png";
import tetoD from "./assets/tiles/groundSuperiorD.png";
import tetoE from "./assets/tiles/groundSuperiorE.png";
import CantoD from "./assets/tiles/groundDireito.png";
import CantoE from "./assets/tiles/groundEsquerdo.png";
import chao from "./assets/tiles/groundInferior.png";
import chaoD from "./assets/tiles/groundInferiorD.png";
import chaoE from "./assets/tiles/groundInferiorE.png";

import { groundMap, estaNaAreaDeCombate } from "./entities/mapData";

// ===== imagens dos tiles
const tileImages = {
  teto: new Image(),
  centro1: new Image(),
  centro2: new Image(),
  tetoD: new Image(),
  tetoE: new Image(),
  CantoD: new Image(),
  CantoE: new Image(),
  chao: new Image(),
  chaoD: new Image(),
  chaoE: new Image(),
};
tileImages.teto.src = teto;
tileImages.centro1.src = centro1;
tileImages.centro2.src = centro2;
tileImages.tetoD.src = tetoD;
tileImages.tetoE.src = tetoE;
tileImages.CantoD.src = CantoD;
tileImages.CantoE.src = CantoE;
tileImages.chao.src = chao;
tileImages.chaoD.src = chaoD;
tileImages.chaoE.src = chaoE;

// ===== utilidade HiDPI
function setCanvasSize(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ===== HUD fixa (compacta) =====
const HUD_PAD = 4; // margem externa mínima
const HUD_GUTTER = 6; // espaço entre painel e mapa
const PANEL_PCT = 0.14; // % da largura do canvas
const PANEL_MIN = 150; // largura mínima do painel
const PANEL_MAX = 210; // largura máxima do painel

function clr(a) {
  return `rgba(20,20,20,${a})`;
}
function within(r, x, y) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

function buildHudLayout(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  const panelW = Math.max(PANEL_MIN, Math.min(W * PANEL_PCT, PANEL_MAX));
  const panel = { x: HUD_PAD, y: HUD_PAD, w: panelW, h: H - HUD_PAD * 2 };

  // título + energia + população
  const titleH = 26,
    energyH = 30,
    popH = 56;

  const title = { x: panel.x + 10, y: panel.y + 8, w: panel.w - 20, h: titleH };
  const energy = {
    x: title.x,
    y: title.y + title.h + 6,
    w: title.w,
    h: energyH,
  };

  const popRow = {
    x: energy.x,
    y: energy.y + energy.h + 6,
    w: energy.w,
    h: popH,
  };
  const gap = 8;
  const colonosBox = {
    x: popRow.x,
    y: popRow.y,
    w: Math.floor((popRow.w - gap) / 2),
    h: popRow.h,
  };
  const marinesBox = {
    x: colonosBox.x + colonosBox.w + gap,
    y: popRow.y,
    w: popRow.w - colonosBox.w - gap,
    h: popRow.h,
  };

  const waveBtnH = 52,
    removeBtnH = 42;

  const slotsArea = {
    x: panel.x + 10,
    y: popRow.y + popRow.h + 10,
    w: panel.w - 20,
    h:
      panel.y +
      panel.h -
      (popRow.y + popRow.h + 10) -
      (removeBtnH + 8 + waveBtnH + 10),
  };

  const slotH = 80,
    slotGap = 8,
    slotW = slotsArea.w;
  const slots = [];
  const entries = Object.keys(troopTypes);
  for (let i = 0; i < entries.length; i++) {
    const sy = slotsArea.y + i * (slotH + slotGap);
    if (sy + slotH > slotsArea.y + slotsArea.h) break;
    slots.push({ x: slotsArea.x, y: sy, w: slotW, h: slotH, tipo: entries[i] });
  }

  const waveBtn = {
    x: panel.x + 10,
    y: panel.y + panel.h - 10 - waveBtnH,
    w: panel.w - 20,
    h: waveBtnH,
  };
  const removeBtn = {
    x: panel.x + 10,
    y: waveBtn.y - 8 - removeBtnH,
    w: panel.w - 20,
    h: removeBtnH,
  };

  return {
    panel,
    title,
    energy,
    popRow,
    colonosBox,
    marinesBox,
    slotsArea,
    slots,
    removeBtn,
    waveBtn,
  };
}

// ===== Geometria do MAPA (lado a lado com o painel) =====
function getMapGeom(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  const layout = buildHudLayout(canvas);

  const mapAvailX = layout.panel.x + layout.panel.w + HUD_GUTTER;
  const mapAvailY = HUD_PAD;
  const mapAvailW = W - mapAvailX - HUD_PAD;
  const mapAvailH = H - HUD_PAD * 2;

  // tiles quadrados, 12x7 visível
  const tileSize = Math.min(mapAvailW / tileCols, mapAvailH / tileRows);
  const mapW = tileSize * tileCols;
  const mapH = tileSize * tileRows;

  // encosta no topo/esquerda da área útil (sem centralizar para sobrar espaço)
  const x = mapAvailX;
  const y = mapAvailY + (mapAvailH - mapH) / 2; // centra só verticalmente

  return { x, y, w: mapW, h: mapH, tileWidth: tileSize, tileHeight: tileSize };
}

const GameCanvas = ({ estadoAtual, onEstadoChange }) => {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const hudRectsRef = useRef(null);
  const gameRef = useRef({
    tropas: [],
    inimigos: [],
    projectilePool: [],
    particles: [],
  });

  const navigate = useNavigate();

  const atualizarEstado = async (novosDados, sincronizarBackend = false) => {
    const atual =
      typeof novosDados === "function"
        ? novosDados({ ...estadoAtual, energia: energiaRef.current })
        : novosDados;

    const atualizado = {
      ...estadoAtual,
      ...atual,
      populacao: { ...estadoAtual.populacao, ...(atual.populacao || {}) },
      construcoes: { ...estadoAtual.construcoes, ...(atual.construcoes ?? {}) },
    };

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
  const [dadosVitoria, setDadosVitoria] = useState({ inimigosMortos: 0 });

  // energia
  useEffect(() => {
    setEnergia(estadoAtual.energia);
    energiaRef.current = estadoAtual.energia;
  }, [estadoAtual.energia]);

  // redimensiona canvas — **sem travar aspecto** (usa toda a área disponível)
  useEffect(() => {
    const canvas = canvasRef.current,
      box = boxRef.current;
    if (!canvas || !box) return;
    function resize() {
      const r = box.getBoundingClientRect();
      const cssW = r.width;
      const cssH = Math.max(200, window.innerHeight - r.top - 24);
      setCanvasSize(canvas, Math.floor(cssW), Math.floor(cssH));
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // atalhos: R (toggle remover)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "r" || e.key === "R") setModoRemocao((m) => !m);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ===== helpers do overlay =====
  const getTroopThumb = (tipo) => {
    const ani = troopAnimations?.[tipo] || {};
    return ani?.idle?.[0] || ani?.defense?.[0] || ani?.attack?.[0] || null;
  };
  const stockMap = {
    colono: ["populacao", "colonos"],
    marine: ["populacao", "marines"],
    muralhaReforcada: ["construcoes", "muralhaReforcada"],
  };
  const getByPath = (obj, path) =>
    path.reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
  const getDisponivel = (tipo) => {
    const val = getByPath(estadoAtual, stockMap[tipo] || []);
    return typeof val === "number" ? val : 0;
  };
  const isDisabledTroop = (tipo, config) =>
    energia < config.preco || getDisponivel(tipo) <= 0;

  // use os mesmos fatores do desenho da tropa
  const COVER = 0.9;
  const SIZE_BOOST = 1.15;

  // escala do sprite na tela (mantém consistente com o desenho atual)
  function getTroopScaleForTile(t, tileHeight) {
    // usa o frame do estado atual; se não achar, cai no 1º frame de idle
    const ref =
      troopAnimations[t.tipo]?.[t.state]?.[t.frameIndex] ||
      troopAnimations[t.tipo]?.idle?.[0];
    if (!ref?.height) return 1;
    const targetH = tileHeight * COVER * SIZE_BOOST;
    return targetH / ref.height;
  }

  // converte offset do sprite (ou em tiles/px) para coordenadas do MAPA
  function getMuzzleWorldPos(t, view) {
    const baseX = t.col * view.tileWidth + view.tileWidth / 2;
    const baseY = (t.row + 1) * view.tileHeight;

    const conf = troopTypes[t.tipo]?.muzzle || {};
    const off = conf[t.state] || { x: 0, y: -0.3 }; // x,y “unitless” p/ caso tile
    const unit = conf.units ?? "px"; // << AQUI está a correção

    let dx = 0,
      dy = 0;
    if (unit === "spritePx") {
      const s = getTroopScaleForTile(t, view.tileHeight); // escala usada no draw do sprite
      dx = (off.x || 0) * s;
      dy = (off.y || 0) * s;
    } else if (unit === "tile") {
      dx = (off.x || 0) * view.tileWidth;
      dy = (off.y || 0) * view.tileHeight;
    } else {
      // "px" no espaço do mapa (não escala com tile/sprite)
      dx = off.x || 0;
      dy = off.y || 0;
    }

    return { x: baseX + dx, y: baseY + dy };
  }

  // ===== desenho
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationId;

    const drawHUD = () => {
      const layout = buildHudLayout(canvas);
      hudRectsRef.current = layout;

      // Painel
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = clr(0.8);
      ctx.fillRect(
        layout.panel.x,
        layout.panel.y,
        layout.panel.w,
        layout.panel.h
      );
      ctx.restore();

      // Título
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial";
      ctx.fillText("Tropas Disponíveis", layout.title.x, layout.title.y + 18);
      ctx.restore();

      // Energia
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial";
      ctx.fillText(
        `⚡ Energia: ${energia}`,
        layout.energy.x + 2,
        layout.energy.y + 22
      );
      ctx.restore();

      // População
      const { colonos = 0, marines = 0 } = estadoAtual?.populacao || {};
      const drawPopBox = (box, label, value) => {
        ctx.save();
        ctx.fillStyle = "rgba(60,60,60,0.85)";
        ctx.strokeStyle = "rgba(120,120,120,0.9)";
        ctx.lineWidth = 2;
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.strokeRect(box.x, box.y, box.w, box.h);
        ctx.fillStyle = "#cbd5e1";
        ctx.font = "12px Arial";
        ctx.fillText(label, box.x + 10, box.y + 18);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 22px monospace";
        ctx.fillText(String(value), box.x + 10, box.y + 44);
        ctx.restore();
      };
      drawPopBox(layout.colonosBox, "Colonos", colonos);
      drawPopBox(layout.marinesBox, "Marines", marines);

      // Slots
      layout.slots.forEach((s) => {
        const cfg = troopTypes[s.tipo];
        const disabled = isDisabledTroop(s.tipo, cfg);
        ctx.save();
        ctx.fillStyle = disabled
          ? "rgba(80,80,80,0.9)"
          : "rgba(30,144,255,0.15)";
        ctx.strokeStyle = disabled
          ? "rgba(130,130,130,0.9)"
          : "rgba(30,144,255,0.8)";
        ctx.lineWidth = 2;
        ctx.fillRect(s.x, s.y, s.w, s.h);
        ctx.strokeRect(s.x, s.y, s.w, s.h);

        const img = getTroopThumb(s.tipo);
        if (img && img.complete) {
          const icon = Math.min(56, s.h - 16);
          ctx.drawImage(img, s.x + 10, s.y + (s.h - icon) / 2, icon, icon);
        }
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Arial";
        ctx.fillText(s.tipo, s.x + 80, s.y + 28);
        ctx.font = "12px Arial";
        ctx.fillText(`💰 ${cfg.preco}`, s.x + 80, s.y + 48);
        ctx.fillText(`x${getDisponivel(s.tipo)}`, s.x + s.w - 36, s.y + 20);
        ctx.restore();
      });

      // Remover
      ctx.save();
      ctx.fillStyle = modoRemocao
        ? "rgba(220,38,38,0.8)"
        : "rgba(220,38,38,0.2)";
      ctx.strokeStyle = "rgba(220,38,38,0.9)";
      ctx.lineWidth = 2;
      ctx.fillRect(
        layout.removeBtn.x,
        layout.removeBtn.y,
        layout.removeBtn.w,
        layout.removeBtn.h
      );
      ctx.strokeRect(
        layout.removeBtn.x,
        layout.removeBtn.y,
        layout.removeBtn.w,
        layout.removeBtn.h
      );
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px Arial";
      ctx.fillText(
        "💥 Remover",
        layout.removeBtn.x + 12,
        layout.removeBtn.y + 28
      );
      ctx.restore();

      // Iniciar Onda
      ctx.save();
      const label = modoPreparacao
        ? `▶ Iniciar Onda ${onda}`
        : "⏸ Em andamento";
      ctx.fillStyle = modoPreparacao
        ? "rgba(34,197,94,0.8)"
        : "rgba(250,204,21,0.8)";
      ctx.strokeStyle = modoPreparacao
        ? "rgba(34,197,94,1)"
        : "rgba(234,179,8,1)";
      ctx.lineWidth = 2;
      ctx.fillRect(
        layout.waveBtn.x,
        layout.waveBtn.y,
        layout.waveBtn.w,
        layout.waveBtn.h
      );
      ctx.strokeRect(
        layout.waveBtn.x,
        layout.waveBtn.y,
        layout.waveBtn.w,
        layout.waveBtn.h
      );
      ctx.fillStyle = "#0b0b0b";
      ctx.font = "bold 18px Arial";
      ctx.fillText(label, layout.waveBtn.x + 12, layout.waveBtn.y + 32);
      ctx.restore();
    };

    const draw = () => {
      const map = getMapGeom(canvas);

      // disponibiliza geometria + função para quem cria projéteis
      gameRef.current.view = map;
      gameRef.current.getMuzzleWorldPos = (troop) =>
        getMuzzleWorldPos(troop, map);

      const { tileWidth, tileHeight } = map;

      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      // ======= MUNDO (mapa+entidades) à direita do painel =======
      ctx.save();
      ctx.translate(map.x, map.y);

      // MAPA
      for (let row = 0; row < tileRows; row++) {
        for (let col = 0; col < tileCols; col++) {
          const tipo = groundMap[row][col] || "grass";
          const img = tileImages[tipo];
          const x = col * tileWidth;
          const y = row * tileHeight;
          if (img.complete) ctx.drawImage(img, x, y, tileWidth, tileHeight);

          if (estaNaAreaDeCombate(row, col)) {
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 2;
            //ctx.strokeRect(x + 1, y + 1, tileWidth - 2, tileHeight - 2); // Colocar o traçado
          } else {
            ctx.fillStyle = "rgba(0,0,0,0.2)";
            //ctx.fillRect(x, y, tileWidth, tileHeight); //Escurece a parte de fora
          }
        }
      }

      // TROPAS
      const COVER = 0.9,
        SIZE_BOOST = 1.15;
      gameRef.current.tropas.forEach((t) => {
        t.updateAnimation?.();
        t.updateDeath?.();
        const frames = troopAnimations[t.tipo]?.[t.state];
        const img = frames?.[t.frameIndex || 0];
        if (!img?.complete) return;

        const alturaDesejada = tileHeight * COVER * SIZE_BOOST;
        const escala = alturaDesejada / img.height;
        const larguraDesejada = img.width * escala;

        const baseX = t.col * tileWidth + tileWidth / 2;
        const baseY = (t.row + 1) * tileHeight;

        ctx.save();
        ctx.globalAlpha = t.opacity ?? 1;
        ctx.drawImage(
          img,
          baseX - larguraDesejada / 2,
          baseY - alturaDesejada,
          larguraDesejada,
          alturaDesejada
        );
        ctx.restore();

        // barra de vida
        const maxHpTroop = t.maxHp ?? t.config.hp ?? 1;
        const hpRatio = Math.max(0, t.hp) / maxHpTroop;
        const barWidth = 30,
          barHeight = 4;
        const barX = baseX - barWidth / 2,
          barY = baseY - alturaDesejada / 2 - 10;
        ctx.save();
        ctx.fillStyle = "red";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = "lime";
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.restore();
      });

      // INIMIGOS
      gameRef.current.inimigos.forEach((e) => {
        const frames =
          (e.framesByState && e.state && e.framesByState[e.state]) ||
          e.frames ||
          [];
        const img = frames[e.frameIndex];
        if (!img?.complete) return;
        const escala = 0.2;
        const larguraDesejada = 217 * escala,
          alturaDesejada = 425 * escala;
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

        const barWidth = 30,
          barHeight = 4;
        const barX = e.x - barWidth / 2,
          barY = y - 30;
        ctx.fillStyle = "red";
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = "lime";
        ctx.fillRect(barX, barY, (barWidth * e.hp) / e.maxHp, barHeight);
        ctx.strokeStyle = "black";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
      });

      //************************************** */
      // PROJÉTEIS
      gameRef.current.projectilePool.forEach((p) => {
        if (!p.active) return;
        const cor = troopTypes[p.tipo]?.corProjetil || "white";
        ctx.save();
        ctx.shadowColor = cor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      });

      // PARTICULAS (faísca de impacto)
      const parts = gameRef.current.particles ?? [];
      gameRef.current.particles = parts.filter((pt) => {
        ctx.save();
        const a = 1 - pt.t / pt.max; // fade-out
        ctx.globalAlpha = Math.max(0, a);
        ctx.strokeStyle = pt.cor || "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2 + pt.t, 0, Math.PI * 2); // anel que cresce
        ctx.stroke();
        ctx.restore();

        pt.t++;
        return pt.t < pt.max; // mantém enquanto “vivo”
      });

      ctx.restore(); // sai do translate(map.x, map.y)

      // GHOST do drag
      if (isDragging && draggedTroop) {
        const frames = troopAnimations[draggedTroop]?.idle;
        const img = frames?.[0];
        if (img?.complete) {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(img, dragPosition.x - 25, dragPosition.y - 25, 50, 50);
          ctx.globalAlpha = 1;
        }
      }

      // HUD fixa
      drawHUD();

      // GAME OVER
      if (jogoEncerrado) {
        ctx.fillStyle = "red";
        ctx.font = "50px Arial";
        ctx.fillText(
          "GAME OVER",
          canvas.clientWidth / 2 - 150,
          canvas.clientHeight / 2
        );
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [
    jogoEncerrado,
    isDragging,
    dragPosition,
    modoPreparacao,
    onda,
    energia,
    modoRemocao,
  ]);

  // ====== eventos de ponteiro ======
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;

    // Interação com HUD
    const hud = hudRectsRef.current;
    if (hud) {
      if (within(hud.waveBtn, x, y)) {
        if (modoPreparacao) {
          setModoPreparacao(false);
          setContadorSpawn(0);
          inimigosCriadosRef.current = 0;
        }
        return;
      }
      if (within(hud.removeBtn, x, y)) {
        setModoRemocao((m) => !m);
        return;
      }
      for (const s of hud.slots) {
        if (within(s, x, y)) {
          const cfg = troopTypes[s.tipo];
          if (isDisabledTroop(s.tipo, cfg)) return;
          if (energia < cfg.preco) return;
          setIsDragging(true);
          setDraggedTroop(s.tipo);
          setTropaSelecionada(s.tipo);
          setDragPosition({ x, y });
          return;
        }
      }
      if (within(hud.panel, x, y)) return;
    }
  };

  const handleMouseUp = (e) => {
    if (!isDragging || !draggedTroop) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;

    const map = getMapGeom(canvas);
    if (x < map.x || y < map.y || x > map.x + map.w || y > map.y + map.h) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

    const col = Math.floor((x - map.x) / map.tileWidth);
    const row = Math.floor((y - map.y) / map.tileHeight);

    if (!estaNaAreaDeCombate(row, col)) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

    if (gameRef.current.tropas.some((t) => t.row === row && t.col === col)) {
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

    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
      construcoes: novaConstrucoes,
    };
    onEstadoChange(novoEstado);
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

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;

    const hud = hudRectsRef.current;
    if (hud && within(hud.panel, x, y)) return;

    const map = getMapGeom(canvas);
    if (x < map.x || y < map.y || x > map.x + map.w || y > map.y + map.h)
      return;

    const col = Math.floor((x - map.x) / map.tileWidth);
    const row = Math.floor((y - map.y) / map.tileHeight);
    if (!estaNaAreaDeCombate(row, col)) return;

    if (modoRemocao) {
      const index = gameRef.current.tropas.findIndex(
        (t) => t.row === row && t.col === col
      );
      if (index !== -1) {
        const tipo = gameRef.current.tropas[index].tipo;
        gameRef.current.tropas.splice(index, 1);
        const credit = Math.floor(troopTypes[tipo].preco / 2);

        const novaPopulacao = { ...estadoAtual.populacao };
        const novaConstrucoes = { ...estadoAtual.construcoes };
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

        const novoEstado = {
          ...estadoAtual,
          energia: energiaRef.current + credit,
          populacao: novaPopulacao,
          construcoes: novaConstrucoes,
        };
        onEstadoChange(novoEstado);
        atualizarEstado(
          {
            energia: energiaRef.current + credit,
            populacao: novaPopulacao,
            construcoes: novaConstrucoes,
          },
          true
        );
      }
      setModoRemocao(false);
      return;
    }

    if (!tropaSelecionada) return;
    if (gameRef.current.tropas.some((t) => t.row === row && t.col === col))
      return;
    if (energia < troopTypes[tropaSelecionada].preco) return;

    gameRef.current.tropas.push(new Troop(tropaSelecionada, row, col));
    const novaEnergia = energiaRef.current - troopTypes[tropaSelecionada].preco;
    const novaPopulacao = { ...estadoAtual.populacao };
    const novaConstrucoes = { ...estadoAtual.construcoes };

    if (tropaSelecionada === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (tropaSelecionada === "marine" && novaPopulacao.marines > 0) {
      novaPopulacao.marines -= 1;
      estadoAtual.populacao.marines -= 1;
    } else if (
      tropaSelecionada === "muralhaReforcada" &&
      novaConstrucoes.muralhaReforcada > 0
    ) {
      novaConstrucoes.muralhaReforcada -= 1;
      estadoAtual.construcoes.muralhaReforcada -= 1;
    }

    const novoEstado = {
      ...estadoAtual,
      energia: novaEnergia,
      populacao: novaPopulacao,
      construcoes: novaConstrucoes,
    };
    onEstadoChange(novoEstado);
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

  // ===== GAME LOOP (inalterado semânticamente)
  function obterLinhasDeCombateValidas() {
    const linhasValidas = [];
    for (let row = 0; row < tileRows; row++)
      if (estaNaAreaDeCombate(row, 1)) linhasValidas.push(row);
    return linhasValidas;
  }

  useEffect(() => {
    const linhasValidasParaSpawn = obterLinhasDeCombateValidas();
    const loopId = setInterval(() => {
      (async () => {
        if (jogoEncerrado || modoPreparacao) return;
        const { inimigos } = gameRef.current;

        gameRef.current.inimigos = inimigos
          .map((e) => {
            e.updatePosition();
            return e;
          })
          .filter((e) => !e.isDead());

        CollisionManager.inimigosAtacam(gameRef.current);
        if (gameRef.current.inimigos.some((e) => e.x <= 50)) {
          setJogoEncerrado(true);
          return;
        }
        CollisionManager.updateProjectilesAndCheckCollisions(gameRef.current);
        CollisionManager.inimigosAtacam(gameRef.current);
        CollisionManager.tropasAtacam(gameRef.current);

        setContadorSpawn((prev) => {
          const novo = prev + 1;
          const podeSpawnar =
            novo >= waveConfig.frequenciaSpawn &&
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

            // cria inimigo e posiciona no canto direito do MAPA
            const enemy = new Enemy(tipoAleatorio, row);
            const mapGeom = getMapGeom(canvasRef.current);

            // Opção A: nasce um pouco fora e entra andando
            enemy.x = mapGeom.w + 10;

            // (ou Opção B, dentro do último tile: enemy.x = mapGeom.w - mapGeom.tileWidth / 2;)

            gameRef.current.inimigos.push(enemy);

            // atualiza contadores UMA vez
            inimigosCriadosRef.current += 1;
            inimigosTotaisRef.current += 1;

            return 0;
          }
          return novo;
        });

        const todosInimigosMortos = gameRef.current.inimigos.length === 0;
        const todosInimigosGerados =
          inimigosCriadosRef.current >= waveConfig.quantidadePorOnda(onda);
        if (!modoPreparacao && todosInimigosMortos && todosInimigosGerados) {
          if (onda === 1) {
            setJogoEncerrado(true);
            clearInterval(loopId);
            const tropasEmCampo = gameRef.current.tropas;
            const tropasParaRetornar = {};
            const novosPacientes = [];
            tropasEmCampo.forEach((tropa, idx) => {
              const tipo = tropa.tipo,
                cfg = troopTypes[tipo];
              if (!cfg?.retornaAoFinal) return;
              const hpAtual = Number.isFinite(tropa.hp)
                ? tropa.hp
                : tropa.hp?.current ?? 0;
              const hpMax = Number.isFinite(tropa.maxHp)
                ? tropa.maxHp
                : tropa.hp?.max ?? tropa.config?.hp ?? 1;
              const ratio = hpMax > 0 ? hpAtual / hpMax : 1;
              tropasParaRetornar[tipo] = (tropasParaRetornar[tipo] || 0) + 1;
              if (ratio < 1) {
                const severidade = ratio >= 0.5 ? "leve" : "grave";
                novosPacientes.push({
                  id: `pac_${estadoAtual.turno}_${Date.now()}_${idx}`,
                  tipo: "colono",
                  refId: null,
                  severidade,
                  entrouEm: Date.now(),
                  turnosRestantes: severidade === "grave" ? 3 : 1,
                  origem: `combate_${tipo}`,
                  status: "fila",
                });
              }
            });

            const hospitalAtual = estadoAtual.hospital ?? {
              fila: [],
              internados: [],
              historicoAltas: [],
            };
            const novoHospital = {
              ...hospitalAtual,
              fila: [...(hospitalAtual.fila || []), ...novosPacientes],
            };
            const novaPopulacao = { ...estadoAtual.populacao };
            Object.entries(tropasParaRetornar).forEach(([t, qtd]) => {
              if (t === "colono") novaPopulacao.colonos += qtd;
              if (t === "marine") novaPopulacao.marines += qtd;
            });

            const novoEstado = {
              ...estadoAtual,
              energia: energiaRef.current,
              populacao: novaPopulacao,
              hospital: novoHospital,
            };
            await atualizarEstado(novoEstado, true);

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
              )
                t = p.origem.replace("combate_", "");
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
            setOpenDialog(true);
          } else {
            setModoPreparacao(true);
            setOnda((o) => o + 1);
          }
        }
      })();
    }, 32);
    return () => clearInterval(loopId);
  }, [jogoEncerrado, onda, modoPreparacao]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: 0,
        width: "100%",
      }}
    >
      {/* Canvas com HUD fixa à esquerda */}
      <div
        ref={boxRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            background: "#202020",
            border: "2px solid #fff",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleCanvasMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
        />
      </div>

      {/* Dialog de vitória */}
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
          {dadosVitoria.feridos && dadosVitoria.feridos.total > 0 && (
            <>
              <Typography sx={{ mt: 2 }} gutterBottom>
                🏥 <strong>Atendimento médico</strong>
              </Typography>
              <Typography gutterBottom>
                Encaminhados ao hospital:{" "}
                <strong>{dadosVitoria.feridos.total}</strong>
                {` (leve: ${dadosVitoria.feridos.leve}, grave: ${dadosVitoria.feridos.grave})`}
              </Typography>
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
                              <strong>{stats.total}</strong>
                              {` (leve: ${stats.leve}, grave: ${stats.grave})`}
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

export default GameCanvas;
