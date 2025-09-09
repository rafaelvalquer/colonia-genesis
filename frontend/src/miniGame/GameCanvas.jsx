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
import { Projectile } from "./entities/Projectile";
import { enemyAnimations } from "./entities/EnemyTypes";

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

const GameCanvasWithLoader = (props) => {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ done: 0, total: 0 });

  // crossfade
  const [showLoader, setShowLoader] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const [gameOpacity, setGameOpacity] = useState(0);

  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // evita dupla execução no Strict Mode
    ranRef.current = true;

    // 1) tiles do próprio arquivo
    const tileImgs = Object.values(tileImages);

    // 2) sprites das tropas
    const troopImgs = collectTroopImages();

    // 3) sprites dos inimigos
    const enemyImgs = collectEnemyImages();

    const all = [...tileImgs, ...troopImgs, ...enemyImgs];

    preloadImagesWithGPUUpload(all, ({ done, total, percent }) => {
      setProgress(percent);
      setCounts({ done, total });
    }).then(() => {
      // monta o jogo e inicia crossfade
      setReady(true); // monta o GameCanvas
      requestAnimationFrame(() => setGameOpacity(1)); // fade-in do game
      setFadingOut(true); // fade-out do loader
      setTimeout(() => setShowLoader(false), 350); // remove loader após a transição
    });
  }, []);

  return (
    <>
      {ready && (
        <div style={{ opacity: gameOpacity, transition: "opacity 300ms ease" }}>
          <GameCanvas {...props} />
        </div>
      )}

      {showLoader && (
        <LoadingScreen
          progress={progress}
          done={counts.done}
          total={counts.total}
          fadingOut={fadingOut}
        />
      )}
    </>
  );
};

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

  // alturas básicas
  const titleH = 26;
  const energyH = 30;

  // áreas fixas do topo
  const title = { x: panel.x + 10, y: panel.y + 8, w: panel.w - 20, h: titleH };
  const energy = {
    x: title.x,
    y: title.y + titleH + 6,
    w: title.w,
    h: energyH,
  };

  // slots responsivos
  const compact = panel.w < 170; // modo compacto em painéis estreitos

  const waveBtnH = 52;
  const removeBtnH = 42;

  const slotsArea = {
    x: panel.x + 10,
    y: energy.y + energy.h + 10, // imediatamente abaixo da energia
    w: panel.w - 20,
    h:
      panel.y +
      panel.h -
      (energy.y + energy.h + 10) -
      (removeBtnH + 8 + waveBtnH + 10),
  };

  const slotH = compact ? 64 : 80;
  const slotGap = 8;
  const slotW = slotsArea.w;

  const slots = [];
  const entries = Object.keys(troopTypes);
  for (let i = 0; i < entries.length; i++) {
    const sy = slotsArea.y + i * (slotH + slotGap);
    if (sy + slotH > slotsArea.y + slotsArea.h) break;
    slots.push({ x: slotsArea.x, y: sy, w: slotW, h: slotH, tipo: entries[i] });
  }

  // botões fixos no rodapé do painel
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
    compact,
    title,
    energy,
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
  // efeitos visuais do HUD (pulses por tipo + textos flutuantes)
  const hudFxRef = useRef({
    pulses: {}, // { [tipo]: { t0, dur, delta } }
    floats: [], // [{ tipo, t0, dur, delta }]
    // energia:
    energyPulse: null, // { t0, dur, delta }
    energyTween: null, // { from, to, t0, dur }
    energyFloat: null, // { t0, dur, delta }
  });

  // ✅ Deixe AQUI (escopo do componente), não dentro do drawHUD
  const triggerCounterFX = (tipo, delta = -1) => {
    const now = performance.now();
    hudFxRef.current.pulses[tipo] = { t0: now, dur: 550, delta }; // pulse no badge
    hudFxRef.current.floats.push({ tipo, t0: now, dur: 900, delta }); // texto flutuante (+1/-1)
  };

  // ✅ fora do drawHUD: anima energia ao mudar
  const triggerEnergyFX = (delta) => {
    if (!delta) return;
    const now = performance.now();
    // pulse e flash
    hudFxRef.current.energyPulse = { t0: now, dur: 650, delta };
    // interpolação do número (old -> new)
    hudFxRef.current.energyTween = {
      from: energiaRef.current,
      to: energiaRef.current + delta,
      t0: now,
      dur: 600,
    };
    // texto flutuante +X / -X
    hudFxRef.current.energyFloat = { t0: now, dur: 900, delta };
  };

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

  // derrota
  const [openDialogDerrota, setOpenDialogDerrota] = useState(false);
  const [dadosDerrota, setDadosDerrota] = useState({
    tropasRetornadas: {},
    feridos: { total: 0, leve: 0, grave: 0 },
    feridosPorTipo: {},
  });
  const gameOverBtnRef = useRef(null); // área clicável do botão "GAME OVER"

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

  // Pré-alocação da pool de projéteis
  useEffect(() => {
    // evita rodar 2x no StrictMode/dev
    if (gameRef.current.__preallocDone) return;
    gameRef.current.__preallocDone = true;

    const pool = gameRef.current.projectilePool;
    const bounds = { minX: 0, maxX: Infinity, minY: 0, maxY: Infinity };
    const BASE_PREALLOC = 48; // ajuste conforme seu jogo

    for (let i = 0; i < BASE_PREALLOC; i++) {
      // valores neutros; active=false
      pool.push(
        new Projectile({
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          row: 0,
          tipo: "prealloc",
          dano: 0,
          bounds,
          active: false,
        })
      );
    }
  }, []);

  // ===== helpers do overlay =====

  const finalizarRodada = async (tipo = "derrota") => {
    // coleta tropas em campo
    const tropasEmCampo = gameRef.current.tropas || [];
    const tropasParaRetornar = {};
    const novosPacientes = [];

    tropasEmCampo.forEach((tropa, idx) => {
      const tipoT = tropa.tipo;
      const cfg = troopTypes[tipoT];
      if (!cfg?.retornaAoFinal) return;

      const hpAtual = Number.isFinite(tropa.hp)
        ? tropa.hp
        : tropa.hp?.current ?? 0;
      const hpMax = Number.isFinite(tropa.maxHp)
        ? tropa.maxHp
        : tropa.hp?.max ?? tropa.config?.hp ?? 1;
      const ratio = hpMax > 0 ? hpAtual / hpMax : 1;

      tropasParaRetornar[tipoT] = (tropasParaRetornar[tipoT] || 0) + 1;

      if (ratio < 1) {
        const severidade = ratio >= 0.5 ? "leve" : "grave";
        novosPacientes.push({
          id: `pac_${estadoAtual.turno}_${Date.now()}_${idx}`,
          tipo: "colono",
          refId: null,
          severidade,
          entrouEm: Date.now(),
          turnosRestantes: severidade === "grave" ? 3 : 1,
          origem: `combate_${tipoT}`,
          status: "fila",
        });
      }
    });

    // hospital/população
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
      if (t === "sniper") novaPopulacao.snipers += qtd;
    });

    // ===== integridade estrutural (só em DERROTA)
    const perdaIntegridade = tipo === "derrota" ? 20 : 0;
    const integridadeAtual = Number.isFinite(estadoAtual.integridadeEstrutural)
      ? estadoAtual.integridadeEstrutural
      : 100;
    const novaIntegridade = Math.max(0, integridadeAtual - perdaIntegridade);

    // monta estado novo (energia/população/hospital + integridade)
    const novoEstado = {
      ...estadoAtual,
      energia: energiaRef.current,
      populacao: novaPopulacao,
      hospital: novoHospital,
      integridadeEstrutural: novaIntegridade,
    };

    await atualizarEstado(novoEstado, true); // sincroniza backend

    // resumo de feridos
    const feridosLeves = novosPacientes.filter(
      (p) => p.severidade === "leve"
    ).length;
    const feridosGraves = novosPacientes.filter(
      (p) => p.severidade === "grave"
    ).length;
    const feridosPorTipo = novosPacientes.reduce((acc, p) => {
      let t = "desconhecido";
      if (typeof p.origem === "string" && p.origem.startsWith("combate_")) {
        t = p.origem.replace("combate_", "");
      }
      if (!acc[t]) acc[t] = { leve: 0, grave: 0, total: 0 };
      acc[t][p.severidade] += 1;
      acc[t].total += 1;
      return acc;
    }, {});

    // lembrete/dialog
    if (tipo === "derrota") {
      setDadosDerrota({
        inimigosMortos: inimigosTotaisRef.current,
        tropasRetornadas: tropasParaRetornar,
        feridos: {
          total: feridosLeves + feridosGraves,
          leve: feridosLeves,
          grave: feridosGraves,
        },
        feridosPorTipo,
        integridadePerdida: perdaIntegridade, // << novo
        integridadeFinal: novaIntegridade, // << novo
      });
      setOpenDialogDerrota(true);
    }
  };

  const getTroopThumb = (tipo) => {
    const ani = troopAnimations?.[tipo] || {};
    return ani?.idle?.[0] || ani?.defense?.[0] || ani?.attack?.[0] || null;
  };
  const stockMap = {
    colono: ["populacao", "colonos"],
    marine: ["populacao", "marines"],
    sniper: ["populacao", "snipers"],
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
  const COVER = 1.2;
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

      const now = performance.now();
      const easeOutBack = (x) => {
        const c1 = 1.70158,
          c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      };

      // Helpers locais
      const drawSeparator = (y) => {
        ctx.save();
        // linha dupla bem sutil
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(layout.panel.x + 8, y, layout.panel.w - 16, 1);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(layout.panel.x + 8, y + 1, layout.panel.w - 16, 1);
        ctx.restore();
      };

      const drawClampedText = (text, x, y, maxW, font) => {
        ctx.save();
        ctx.font = font;
        let t = text;
        while (t.length > 1 && ctx.measureText(t).width > maxW)
          t = t.slice(0, -1);
        if (t !== text) {
          while (t.length > 1 && ctx.measureText(t + "…").width > maxW)
            t = t.slice(0, -1);
          t = t + "…";
        }
        ctx.fillText(t, x, y);
        ctx.restore();
      };

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

      // Título topo
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial";
      ctx.fillText("Tropas Disponíveis", layout.title.x, layout.title.y + 18);
      ctx.restore();

      // Energia
      // Energia — glow amarelo + tween + pulse ao gastar/ganhar
      {
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

        // valor exibido (interpolado quando houver tween ativo)
        let energiaMostrada = energia;
        const tween = hudFxRef.current.energyTween;
        if (tween) {
          const p = Math.min(1, (now - tween.t0) / tween.dur);
          energiaMostrada = Math.round(
            tween.from + (tween.to - tween.from) * easeOutCubic(p)
          );
          if (p >= 1) hudFxRef.current.energyTween = null;
        }

        // glow “piscando” (mantém o brilho), sem variar tamanho continuamente
        const baseGlow = 0.25 + 0.2 * Math.sin(now / 220);

        let scale = 1; // remove a animação de “respirar” no tamanho
        let flash = 0;

        const ep = hudFxRef.current.energyPulse;
        if (ep) {
          const pp = Math.min(1, (now - ep.t0) / ep.dur);
          scale += 0.15 * (1 - pp); // dá um “pump”
          flash = 0.5 * (1 - pp); // flash branco rápido
          if (pp >= 1) hudFxRef.current.energyPulse = null;
        }

        // desenha o texto com glow e contorno
        const tx = layout.energy.x + 2;
        const ty = layout.energy.y + 22;

        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);

        ctx.font = "bold 20px Arial";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.65)";

        // brilho amarelo
        ctx.shadowColor = `rgba(255, 221, 87, ${0.35 + baseGlow})`;
        ctx.shadowBlur = 18;

        const energyText = `⚡ Energia: ${energiaMostrada}`;
        ctx.strokeText(energyText, 0, 0);
        ctx.fillStyle = "#ffd54f"; // amber-300
        ctx.fillText(energyText, 0, 0);

        // flash rápido ao gastar/ganhar
        if (flash > 0) {
          ctx.save();
          ctx.globalAlpha = flash;
          ctx.fillStyle = "#fff59d"; // amarelo mais claro
          ctx.fillText(energyText, 0, 0);
          ctx.restore();
        }

        ctx.restore();

        // texto flutuante +X / -X
        const ef = hudFxRef.current.energyFloat;
        if (ef) {
          const pf = Math.min(1, (now - ef.t0) / ef.dur);
          const dy = -20 * pf; // sobe
          const alpha = 1 - pf; // some
          const txt = `${ef.delta > 0 ? "+" : ""}${Math.abs(ef.delta)}`;
          const color = ef.delta > 0 ? "#10b981" : "#ef4444"; // verde/vermelho

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = "bold 14px Arial";
          ctx.textBaseline = "middle";
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";

          // aparece à direita do rótulo “Energia:”
          const floatX = tx + 140;
          const floatY = ty - 14 + dy;

          ctx.strokeText(txt, floatX, floatY);
          ctx.fillStyle = color;
          ctx.fillText(txt, floatX, floatY);
          ctx.restore();

          if (pf >= 1) hudFxRef.current.energyFloat = null;
        }
      }

      // --- separador antes dos slots ---
      drawSeparator(layout.slotsArea.y - 8);

      // Slots (com drop shadow)
      layout.slots.forEach((s) => {
        const cfg = troopTypes[s.tipo];
        const disabled = isDisabledTroop(s.tipo, cfg);

        const iconSize = layout.compact ? 44 : 56;
        const nameFont = layout.compact ? "bold 12px Arial" : "bold 14px Arial";
        const priceFont = "12px Arial";

        ctx.save();
        // sombra nos slots
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = disabled
          ? "rgba(65,65,65,0.95)"
          : "rgba(30,144,255,0.18)";
        ctx.fillRect(s.x, s.y, s.w, s.h);

        // borda (sem sombra)
        ctx.shadowColor = "transparent";
        ctx.lineWidth = 2;
        ctx.strokeStyle = disabled
          ? "rgba(140,140,140,0.9)"
          : "rgba(30,144,255,0.85)";
        ctx.strokeRect(s.x, s.y, s.w, s.h);

        const img = getTroopThumb(s.tipo);
        const textX = s.x + 10 + iconSize + 10;
        if (img && img.complete) {
          ctx.drawImage(
            img,
            s.x + 10,
            s.y + (s.h - iconSize) / 2,
            iconSize,
            iconSize
          );
        }

        // Badge arredondado com gradiente + stroke
        const drawBadge = (x, y, w, h, scheme) => {
          ctx.save();
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, scheme.bg1);
          g.addColorStop(1, scheme.bg2);
          ctx.fillStyle = g;

          // glow sutil
          ctx.shadowColor = scheme.glow || "transparent";
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 1;

          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 6);
            ctx.fill();
            ctx.shadowColor = "transparent";
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = scheme.stroke;
            ctx.stroke();
          } else {
            ctx.fillRect(x, y, w, h);
            ctx.shadowColor = "transparent";
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = scheme.stroke;
            ctx.strokeRect(x, y, w, h);
          }
          ctx.restore();
        };

        // >>> contador (direita) — badge com animação
        const count = getDisponivel(s.tipo);
        const countText = `x${count}`;
        ctx.font = layout.compact ? "bold 12px Arial" : "bold 13px Arial";
        const textW = ctx.measureText(countText).width;
        const badgeH = layout.compact ? 18 : 20;
        const badgeW = Math.ceil(textW) + 12; // padding horizontal
        const badgeX = s.x + s.w - badgeW - 10;
        const badgeY = s.y + 8;

        // esquema de cores por estado (igual ao que você já tem)
        let scheme;
        if (disabled) {
          scheme = {
            bg1: "rgba(75,85,99,0.95)", // slate-600
            bg2: "rgba(55,65,81,0.95)", // slate-700
            stroke: "rgba(148,163,184,0.9)", // slate-400
            glow: "rgba(0,0,0,0.2)",
          };
        } else if (count <= 2) {
          scheme = {
            bg1: "rgba(220,38,38,0.95)", // red-600
            bg2: "rgba(234,88,12,0.95)", // orange-600
            stroke: "rgba(248,113,113,1)", // red-400
            glow: "rgba(248,113,113,0.6)",
          };
        } else if (count <= 5) {
          scheme = {
            bg1: "rgba(234,179,8,0.95)", // amber-500
            bg2: "rgba(245,158,11,0.95)", // amber-600
            stroke: "rgba(250,204,21,1)", // amber-400
            glow: "rgba(250,204,21,0.5)",
          };
        } else {
          scheme = {
            bg1: "rgba(59,130,246,0.95)", // blue-500
            bg2: "rgba(14,165,233,0.95)", // sky-500
            stroke: "rgba(96,165,250,1)", // blue-400
            glow: "rgba(96,165,250,0.6)",
          };
        }

        // ---- animação de pulse/flash
        const pulse = (hudFxRef.current.pulses || {})[s.tipo];
        let scale = 1,
          flash = 0;
        if (pulse) {
          const p = Math.min(1, (now - pulse.t0) / pulse.dur); // 0..1
          const x = 1 - p; // reverte pro easeOut
          scale = 1 + 0.25 * easeOutBack(x); // 1 → 1.25 com leve overshoot
          flash = 0.35 * (1 - p); // flash branco que se dissipa
          if (p >= 1) delete hudFxRef.current.pulses[s.tipo];
        }

        // desenha badge + texto com escala no centro
        const cx = badgeX + badgeW / 2;
        const cy = badgeY + badgeH / 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);

        // badge
        drawBadge(badgeX, badgeY, badgeW, badgeH, scheme);

        // flash branco por cima (rapidamente)
        if (flash > 0) {
          ctx.save();
          ctx.globalAlpha = flash;
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
            ctx.fillStyle = "#ffffff";
            ctx.fill();
          } else {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
          }
          ctx.restore();
        }

        // texto central
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.strokeText(countText, cx, cy + 0.5);
        ctx.fillStyle = "#fff";
        ctx.fillText(countText, cx, cy + 0.5);

        ctx.restore();

        // <<< fim do contador (direita)

        // ==== texto flutuante (+1 / -1) para ESTE tipo ====
        const floats = hudFxRef.current.floats || [];
        for (let i = floats.length - 1; i >= 0; i--) {
          const f = floats[i];
          if (f.tipo !== s.tipo) continue;

          const pf = (now - f.t0) / f.dur; // 0..1
          if (pf >= 1) {
            floats.splice(i, 1);
            continue;
          }

          const dy = -18 * pf; // sobe
          const alpha = 1 - pf; // some
          const txt = f.delta > 0 ? "+1" : "-1";
          const color = f.delta > 0 ? "#10b981" : "#ef4444"; // verde / vermelho

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = layout.compact ? "bold 12px Arial" : "bold 13px Arial";
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(0,0,0,0.55)";
          ctx.strokeText(txt, cx, badgeY - 6 + dy);
          ctx.fillStyle = color;
          ctx.fillText(txt, cx, badgeY - 6 + dy);
          ctx.restore();
        }

        // <<< fim do contador (direita)

        // nome (truncado) — agora usa o começo do badge como limite direito
        const nameY = s.y + (layout.compact ? 26 : 28);
        const rightPadding = 12;
        const maxNameW = Math.max(24, badgeX - rightPadding - textX);
        ctx.fillStyle = "#fff";
        drawClampedText(s.tipo, textX, nameY, maxNameW, nameFont);

        // preço
        const priceY = s.y + (layout.compact ? s.h - 12 : 48);
        ctx.fillStyle = "#fff";
        ctx.font = priceFont;
        ctx.fillText(`💰 ${cfg.preco}`, textX, priceY);

        ctx.restore();
      });

      // --- separador antes dos botões ---
      drawSeparator(layout.removeBtn.y - 10);

      // Remover
      ctx.save();
      ctx.fillStyle = modoRemocao
        ? "rgba(220,38,38,0.85)"
        : "rgba(220,38,38,0.25)";
      ctx.strokeStyle = "rgba(220,38,38,0.95)";
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
        ? "rgba(34,197,94,0.85)"
        : "rgba(250,204,21,0.85)";
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

        ctx.save();
        ctx.globalAlpha = 0.9 * (t.opacity ?? 1);

        // truque: desenha um círculo com gradiente e “achata” no X pra virar elipse
        const rx = tileWidth * 0.32;
        const ry = tileHeight * 0.12;
        ctx.translate(baseX, baseY - 3);
        ctx.scale(rx / ry, 1);

        const r = ry;
        const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
        g.addColorStop(0, "rgba(0,0,0,0.28)");
        g.addColorStop(1, "rgba(0,0,0,0.00)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

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

        const escala = 0.25;
        const larguraDesejada = 217 * escala;
        const alturaDesejada = 425 * escala;
        const y = e.row * tileHeight + tileHeight / 2;

        // ====== SOMBRA (antes de desenhar o inimigo) ======
        {
          // centro X do inimigo e “pé” em Y (base do sprite)
          const baseX = e.x;
          const feetY = y + alturaDesejada / 2 - 2; // -2 pra não encostar no limite

          const rx = tileWidth * 0.34; // raio horizontal (ajuste fino)
          const ry = tileHeight * 0.14; // raio vertical   (ajuste fino)

          const alphaBase = (e.opacity != null ? e.opacity : 1) * 0.9; // se tiver fade
          ctx.save();
          ctx.globalAlpha = alphaBase;

          // desenha um círculo e “achata” no X pra virar elipse
          ctx.translate(baseX, feetY);
          ctx.scale(rx / ry, 1);

          const r = ry;
          const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
          g.addColorStop(0, "rgba(0,0,0,0.28)");
          g.addColorStop(1, "rgba(0,0,0,0.00)");

          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // ================================================

        // SPRITE DO INIMIGO
        ctx.save();

        const src = img.__bmp || img; // se você estiver usando ImageBitmap no preload
        const iw = src.width ?? img.naturalWidth ?? img.width ?? 1;
        const ih = src.height ?? img.naturalHeight ?? img.height ?? 1;

        // use a altura que você já calcula (alturaDesejada) e derive a largura
        const scale = alturaDesejada / ih;
        const w = iw * scale;
        const h = ih * scale;

        ctx.drawImage(src, e.x - w / 2, y - h / 2, w, h);

        ctx.restore();

        // barra de vida...
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
      // dentro do draw(), no final:
      if (jogoEncerrado) {
        const W = canvas.clientWidth,
          H = canvas.clientHeight;
        const t = performance.now() / 1000;

        // escurece o mundo
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, W, H);

        // vinheta
        const vg = ctx.createRadialGradient(
          W / 2,
          H / 2,
          Math.min(W, H) * 0.15,
          W / 2,
          H / 2,
          Math.max(W, H) * 0.65
        );
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);

        // parâmetros do efeito
        const text = "GAME OVER";
        const baseFont = Math.floor(Math.min(W, H) * 0.1);
        const pulse = 1 + 0.03 * Math.sin(t * 4);
        const shakeX = Math.sin(t * 20) * 2;
        const shakeY = Math.cos(t * 22) * 2;

        // mede o texto para criar a "caixa" clicável
        ctx.save();
        ctx.font = `900 ${baseFont}px "Arial Black", Arial, sans-serif`;
        const tw = ctx.measureText(text).width;
        ctx.restore();

        const btnW = tw + baseFont * 1.2;
        const btnH = baseFont * 1.6;
        const btnX = (W - btnW) / 2;
        const btnY = H * 0.5 - btnH / 2;

        // guarda para hit-test no clique/mousemove
        gameOverBtnRef.current = { x: btnX, y: btnY, w: btnW, h: btnH };

        // desenha um fundo de "botão" sutil
        ctx.save();
        ctx.globalAlpha = 0.25;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(btnX, btnY, btnW, btnH, 16);
          ctx.fillStyle = "#111";
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(17,17,17,0.9)";
          ctx.fillRect(btnX, btnY, btnW, btnH);
        }
        ctx.restore();

        // posiciona e anima
        ctx.translate(W / 2 + shakeX, H * 0.5 + shakeY);
        ctx.scale(pulse, pulse);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // fonte principal
        ctx.font = `900 ${baseFont}px "Arial Black", Arial, sans-serif`;

        // glow em camadas + contorno
        const layers = [
          { color: "rgba(255, 0, 60, 0.35)", blur: 30, lw: 12 },
          { color: "rgba(255, 70, 70, 0.6)", blur: 14, lw: 8 },
          { color: "rgba(0,0,0,0.85)", blur: 0, lw: 10 }, // contorno escuro
        ];
        layers.forEach((l) => {
          ctx.save();
          ctx.lineWidth = l.lw;
          ctx.shadowBlur = l.blur;
          ctx.shadowColor = l.color;
          ctx.strokeStyle = l.color;
          ctx.strokeText(text, 0, 0);
          ctx.restore();
        });

        // aberração cromática (RGB offsets)
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(0,255,255,0.9)"; // ciano
        ctx.fillText(text, -2, 0);
        ctx.fillStyle = "rgba(255,0,0,0.9)"; // vermelho
        ctx.fillText(text, 2, 0);
        ctx.restore();

        // preenchimento principal
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, 0, 0);

        // subtítulo
        ctx.font = `600 ${Math.floor(baseFont * 0.28)}px Arial, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("Clique para voltar para a colónia", 0, baseFont * 0.9);

        ctx.restore();

        // scanlines finas
        ctx.save();
        ctx.globalAlpha = 0.08;
        for (let y = 0; y < H; y += 3) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, y, W, 1);
        }
        ctx.restore();
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
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;

    // cursor no botão de game over
    if (jogoEncerrado && gameOverBtnRef.current) {
      const r = gameOverBtnRef.current;
      const inside = x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
      canvas.style.cursor = inside ? "pointer" : "default";
    } else if (!isDragging) {
      canvas.style.cursor = "default";
    }

    if (!isDragging) return;
    setDragPosition({ x, y });
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
    } else if (draggedTroop === "sniper" && novaPopulacao.snipers > 0) {
      novaPopulacao.snipers -= 1;
      estadoAtual.populacao.snipers -= 1;
    } else if (
      draggedTroop === "muralhaReforcada" &&
      novaConstrucoes.muralhaReforcada > 0
    ) {
      novaConstrucoes.muralhaReforcada -= 1;
      estadoAtual.construcoes.muralhaReforcada -= 1;
    }

    triggerEnergyFX(novaEnergia - energiaRef.current); // delta negativo (gasto)

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

    triggerCounterFX(draggedTroop, -1);

    setIsDragging(false);
    setDraggedTroop(null);
  };

  const handleClick = (e) => {
    if (jogoEncerrado) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const r = gameOverBtnRef.current;
      if (r && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) {
        // dispara rotina igual ao fim de onda, mas como DERROTA
        finalizarRodada("derrota");
      }
      return;
    }

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

        // 1) calcule primeiro
        const credit = Math.floor(troopTypes[tipo].preco / 2);

        // 2) anima a energia (delta positivo)
        triggerEnergyFX(credit);

        // 3) devolve unidade ao estoque
        const novaPopulacao = { ...estadoAtual.populacao };
        const novaConstrucoes = { ...estadoAtual.construcoes };
        if (tipo === "colono") {
          novaPopulacao.colonos += 1;
          estadoAtual.populacao.colonos += 1;
        } else if (tipo === "marine") {
          novaPopulacao.marines += 1;
          estadoAtual.populacao.marines += 1;
        } else if (tipo === "sniper") {
          novaPopulacao.snipers += 1;
          estadoAtual.populacao.snipers += 1;
        } else if (tipo === "muralhaReforcada") {
          novaConstrucoes.muralhaReforcada += 1;
          estadoAtual.construcoes.muralhaReforcada += 1;
        }

        // 4) atualiza estado com a energia restaurada
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

        // badge +1 no slot correspondente
        triggerCounterFX(tipo, +1);
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
    } else if (tropaSelecionada === "sniper" && novaPopulacao.snipers > 0) {
      novaPopulacao.snipers -= 1;
      estadoAtual.populacao.snipers -= 1;
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

    triggerCounterFX(tropaSelecionada, -1);
    triggerEnergyFX(novaEnergia - energiaRef.current);
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
            const tiposDisponiveis = [/*"alienVermelho",*/ "medu"];
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
              if (t === "sniper") novaPopulacao.snipers += qtd;
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
      {/* Dialog de DERROTA */}
      <Dialog
        open={openDialogDerrota}
        onClose={() => setOpenDialogDerrota(false)}
      >
        <DialogTitle
          style={{
            backgroundColor: "#ef4444",
            color: "#FFF",
            textAlign: "center",
            fontFamily: "Press Start 2P, cursive",
          }}
        >
          💀 Você perdeu a rodada
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom sx={{ mb: 1.5 }}>
            🛡️ <strong>Integridade estrutural</strong>:{" "}
            {dadosDerrota.integridadePerdida
              ? `-${dadosDerrota.integridadePerdida}`
              : "0"}
            {typeof dadosDerrota.integridadeFinal === "number" && (
              <>
                {" "}
                • Atual: <strong>{dadosDerrota.integridadeFinal}</strong>
              </>
            )}
          </Typography>

          <Typography gutterBottom>
            As forças recuaram. Estas tropas conseguiram retornar:
          </Typography>

          {dadosDerrota.tropasRetornadas &&
          Object.keys(dadosDerrota.tropasRetornadas).length > 0 ? (
            <ul>
              {Object.entries(dadosDerrota.tropasRetornadas).map(
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
          ) : (
            <Typography>Nenhuma tropa apta a retornar.</Typography>
          )}

          {dadosDerrota.feridos && dadosDerrota.feridos.total > 0 && (
            <>
              <Typography sx={{ mt: 2 }} gutterBottom>
                🏥 <strong>Encaminhados ao hospital</strong>
              </Typography>
              <Typography gutterBottom>
                Total: <strong>{dadosDerrota.feridos.total}</strong>
                {` (leve: ${dadosDerrota.feridos.leve}, grave: ${dadosDerrota.feridos.grave})`}
              </Typography>
              {dadosDerrota.feridosPorTipo &&
                Object.keys(dadosDerrota.feridosPorTipo).length > 0 && (
                  <>
                    <Typography gutterBottom>Detalhe por tropa:</Typography>
                    <ul>
                      {Object.entries(dadosDerrota.feridosPorTipo).map(
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
            Voltar para a Colônia
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// === Helpers de carregamento ===

// Coleta todas as imagens das tropas que já estão no troopAnimations
function collectTroopImages() {
  const imgs = [];
  for (const tipo in troopAnimations) {
    const byState = troopAnimations[tipo] || {};
    for (const st in byState) {
      const arr = byState[st] || [];
      for (const img of arr) if (img) imgs.push(img);
    }
  }
  return imgs;
}

// Coleta todas as imagens dos inimigos que já estão no troopAnimations
function collectEnemyImages() {
  const imgs = [];
  for (const tipo in enemyAnimations) {
    const byState = enemyAnimations[tipo] || {};
    for (const st in byState) {
      const arr = byState[st] || [];
      for (const img of arr) if (img) imgs.push(img);
    }
  }
  return imgs;
}

// Se você tiver um mapa/estrutura de frames dos inimigos, faça algo parecido:
// function collectEnemyImages() { ...return [Image, Image, ...]; }

async function preloadImagesWithGPUUpload(images, onProgress) {
  const total = images.length || 1;
  let done = 0;

  const off = document.createElement("canvas");
  off.width = off.height = 1;
  const octx = off.getContext("2d");

  const decodeOne = (img) =>
    img && img.decode
      ? img.decode().catch(() => {})
      : new Promise((resolve) => {
          if (!img) return resolve();
          if (img.complete && img.naturalWidth) return resolve();
          const clean = () => {
            img.onload = null;
            img.onerror = null;
          };
          img.onload = () => {
            clean();
            resolve();
          };
          img.onerror = () => {
            clean();
            resolve();
          };
        });

  const bump = () => {
    done++;
    const percent = Math.round((done / total) * 100);
    onProgress && onProgress({ done, total, percent });
  };

  await Promise.all(
    images.map((img) =>
      decodeOne(img).then(() => {
        try {
          octx.drawImage(img, 0, 0, 1, 1);
        } catch {}
        bump();
      })
    )
  );
}

// UI simples da barra de progresso
function LoadingScreen({ progress, done, total, fadingOut }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0b0b",
        color: "#fff",
        flexDirection: "column",
        gap: 16,
        fontFamily: "Arial, sans-serif",
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 300ms ease",
        pointerEvents: fadingOut ? "none" : "auto",
        zIndex: 9999,
      }}
    >
      <div style={{ fontSize: 18, opacity: 0.9 }}>Carregando assets…</div>

      <div
        style={{
          width: 360,
          height: 14,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 999,
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.15) inset",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "linear-gradient(90deg, #22c55e, #16a34a)",
            transition: "width 120ms ease",
          }}
        />
      </div>

      <div style={{ fontSize: 13, opacity: 0.75 }}>
        {done}/{total} • {progress}%
      </div>
    </div>
  );
}

export { GameCanvas as GameCanvasInner }; // opcional: exporta a versão “pura”
export default GameCanvasWithLoader; // default agora é com loading
