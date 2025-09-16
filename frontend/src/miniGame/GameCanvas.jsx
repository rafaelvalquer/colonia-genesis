// GameCanvas.jsx
import { useRef, useEffect, useState, useMemo } from "react";
import { Troop, troopTypes, troopAnimations } from "./entities/Troop";
import { Enemy } from "./entities/Enemy";
import {
  getNextMissionId,
  getWaveConfigByMissionId,
} from "./entities/WaveConfig";
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
import Speed from "@mui/icons-material/Speed"; // ✅ ADICIONE ESTA LINHA
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

    const all = [...tileImgs, ...troopImgs, ...enemyImgs].filter(Boolean);

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
const HUD_GUTTER = 2; // espaço entre painel e mapa
const PANEL_PCT = 0.2; // % da largura do canvas
const PANEL_MIN = 180; // largura mínima do painel
const PANEL_MAX = 260; // largura máxima do painel
const SCROLL_COL_W = 24;

function clr(a) {
  return `rgba(20,20,20,${a})`;
}
function within(r, x, y) {
  return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function buildHudLayout(canvas, slotOffset = 0) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;

  const panelW = Math.max(PANEL_MIN, Math.min(W * PANEL_PCT, PANEL_MAX));
  const panel = { x: HUD_PAD, y: HUD_PAD, w: panelW, h: H - HUD_PAD * 2 };

  const titleH = 26;
  const energyH = 75;

  const title = { x: panel.x + 10, y: panel.y + 8, w: panel.w - 20, h: titleH };
  const energy = {
    x: title.x,
    y: title.y + titleH + 6,
    w: title.w,
    h: energyH,
  };

  const compact = panel.w < 170;

  const waveBtnH = 52;
  const removeBtnH = 42;

  const slotsArea = {
    x: panel.x + 10,
    y: energy.y + energy.h + 10,
    w: panel.w - 20,
    h:
      panel.y +
      panel.h -
      (energy.y + energy.h + 10) -
      (removeBtnH + 8 + waveBtnH + 10),
  };

  const slotH = compact ? 56 : 68;
  const slotGap = 8;
  const slotW = slotsArea.w - (SCROLL_COL_W + 6);

  const entries = Object.keys(troopTypes);
  const visibleCount = Math.max(
    1,
    Math.floor((slotsArea.h + slotGap) / (slotH + slotGap))
  );
  const maxOffset = Math.max(0, entries.length - visibleCount);
  const start = clamp(slotOffset, 0, maxOffset);
  const end = Math.min(entries.length, start + visibleCount);

  const slots = [];
  for (let i = start, j = 0; i < end; i++, j++) {
    const sy = slotsArea.y + j * (slotH + slotGap);
    slots.push({
      x: slotsArea.x,
      y: sy,
      w: slotW,
      h: slotH,
      tipo: entries[i],
      index: i,
    });
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

  // UI de scroll
  const btn = 26; // tamanho do botão (w/h)
  const btnPad = 6; // margem interna nos slots

  // agora os botões ficam DENTRO da área de slots — não encostam na barra de supply
  const scrollX = slotsArea.x + slotsArea.w - SCROLL_COL_W; // início da coluna
  const upBtn = {
    x: scrollX + Math.floor((SCROLL_COL_W - btn) / 2),
    y: slotsArea.y + btnPad,
    w: btn,
    h: btn,
  };
  const downBtn = {
    x: scrollX + Math.floor((SCROLL_COL_W - btn) / 2),
    y: slotsArea.y + slotsArea.h - btnPad - btn,
    w: btn,
    h: btn,
  };

  // trilho entre os botões
  const track = {
    x: scrollX + Math.floor((SCROLL_COL_W - 6) / 2),
    y: upBtn.y + upBtn.h + btnPad,
    w: 6,
    h: Math.max(0, downBtn.y - (upBtn.y + upBtn.h + btnPad) - btnPad),
  };

  let thumb = null;
  if (entries.length > visibleCount && track.h > 0) {
    const thumbH = Math.max(
      18,
      Math.round((track.h * visibleCount) / entries.length)
    );
    const frac = maxOffset === 0 ? 0 : start / maxOffset;
    const thumbY = Math.round(track.y + (track.h - thumbH) * frac);
    thumb = { x: track.x - 1, y: thumbY, w: track.w + 2, h: thumbH };
  }

  return {
    panel,
    compact,
    title,
    energy,
    slotsArea,
    slots,
    removeBtn,
    waveBtn,
    scroll: {
      total: entries.length,
      visibleCount,
      start,
      maxOffset,
      hasPrev: start > 0,
      hasNext: end < entries.length,
      upBtn,
      downBtn,
      track,
      thumb,
    },
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

// ====== SUPPLY (Capacidade) + Cooldown por tipo ======
const SUPPLY_CFG = {
  start: 20,
  max: 20,
  regenPerSec: 1,
  resetEveryWave: false,
};

//#region Game Canvas
const GameCanvas = ({ estadoAtual, onEstadoChange }) => {
  console.log(estadoAtual);
  const boxRef = useRef(null);
  const canvasRef = useRef(null);
  const hudRectsRef = useRef(null);
  const gameRef = useRef({
    tropas: [],
    inimigos: [],
    projectilePool: [],
    particles: [],
  });

  function tryPushEnemyBack(row, col) {
    const map = getMapGeom(canvasRef.current);
    const tileW = map.tileWidth,
      tileH = map.tileHeight;

    // procura inimigo exatamente no tile onde a tropa foi solta
    const e = gameRef.current.inimigos.find(
      (en) => !en.__death && en.row === row && Math.floor(en.x / tileW) === col
    );
    if (!e) return;

    const toCol = Math.min(tileCols - 1, col + 1);
    const toX = toCol * tileW + tileW / 2;

    // guarda animação de empurrão
    e.__knock = { fromX: e.x, toX, t0: performance.now(), dur: 260 };
    e.__stunUntil = gameTimeRef.current + 260;

    // estado lógico já no tile final (mantém a sua regra de "vai atrás")
    e.x = toX;

    // FX simples
    const cy = row * tileH + tileH / 2;
    gameRef.current.particles.push({
      kind: "ring",
      x: toX,
      y: cy,
      t: 0,
      max: 12,
      cor: "rgba(255,255,255,0.9)",
    });
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI - Math.PI / 2;
      const spd = 1 + Math.random() * 1.8;
      gameRef.current.particles.push({
        kind: "spark",
        x: toX,
        y: cy,
        vx: Math.abs(Math.cos(ang)) * spd,
        vy: Math.sin(ang) * spd * 0.4,
        g: 0.05,
        t: 0,
        max: (16 + Math.random() * 10) | 0,
        cor: "rgba(255,200,80,1)",
      });
    }
  }

  // FX: anéis/faíscas ao surgir tropa
  function emitTroopSpawnFX(row, col) {
    const map = getMapGeom(canvasRef.current);
    const tileW = map.tileWidth,
      tileH = map.tileHeight;
    const cx = col * tileW + tileW / 2;
    const cy = row * tileH + tileH / 2;

    // anéis (branco + azul)
    gameRef.current.particles.push({
      kind: "ring",
      x: cx,
      y: cy,
      t: 0,
      max: 12,
      cor: "rgba(255,255,255,0.95)",
    });
    gameRef.current.particles.push({
      kind: "ring",
      x: cx,
      y: cy,
      t: 0,
      max: 20,
      cor: "rgba(96,165,250,0.95)",
    });

    // faíscas
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 1.6;
      gameRef.current.particles.push({
        kind: "spark",
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd * 0.6 - 0.2,
        g: 0.04,
        t: 0,
        max: (16 + Math.random() * 10) | 0,
        cor: "rgba(96,165,250,1)",
      });
    }
  }

  const missionId = estadoAtual?.battleCampaign?.currentMissionId ?? "fase_01";

  const waveConfig = useMemo(
    () => getWaveConfigByMissionId(missionId),
    [missionId]
  );

  // efeitos visuais do HUD (pulses por tipo + textos flutuantes)
  const hudFxRef = useRef({
    pulses: {}, // { [tipo]: { t0, dur, delta } }
    floats: [], // [{ tipo, t0, dur, delta }]
    // energia:
    energyPulse: null, // { t0, dur, delta }
    energyTween: null, // { from, to, t0, dur }
    energyFloat: null, // { t0, dur, delta }
    supplyDisplay: null, // valor mostrado (anima de display -> target)
    supplyLastT: 0, // timestamp do último frame p/ lerp temporal
    supplyPulse: null, // { t0, dur } efeito de "shock" ao carregar
    supplyLastTarget: null,
  });

  // Barra de forças (HP Aliado vs Inimigo)
  const hpBarRef = useRef({
    pct: 1, // % suavizada do lado azul
    lastFriendly: 0, // último total de HP aliado
    lastEnemy: 0, // último total de HP inimigo
    fx: [], // fila de efeitos: {type:'allyGain'|'allyLoss', from, to, t0, dur}
  });

  const fpsRef = useRef({ ema: 0 }); // EMA = média exponencial p/ suavizar

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

  const triggerSupplyFX = (delta) => {
    // só aplica "shock" quando AUMENTA
    if (delta <= 0) return;
    const now = performance.now();
    hudFxRef.current.supplyPulse = { t0: now, dur: 650 };
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
  const inimigosTotaisRef = useRef(0); // total gerados
  const inimigosMortosRef = useRef(0); // ✅ total eliminados (uso nos diálogos)
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTroop, setDraggedTroop] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [modoRemocao, setModoRemocao] = useState(false);
  const [energia, setEnergia] = useState(estadoAtual?.energia ?? 0);
  const energiaRef = useRef(estadoAtual?.energia ?? 0);
  const [openDialog, setOpenDialog] = useState(false);
  const gameTimeRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const visibleRef = useRef(!document.hidden);
  const lastSupplyGTRef = useRef(0); // âncora do relógio de jogo p/ regen
  const waveBannerRef = useRef(null);
  const showWaveBanner = (text, opts = {}) => {
    waveBannerRef.current = {
      text,
      sub: opts.sub || "",
      color: opts.color || "#60a5fa",
      t0: performance.now(),
      dur: opts.dur || 1700, // ms
    };
  };

  const [timeScale, setTimeScale] = useState(1);
  const timeScaleRef = useRef(1);
  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  const [slotOffset, setSlotOffset] = useState(0);
  const slotOffsetRef = useRef(0);
  useEffect(() => {
    slotOffsetRef.current = slotOffset;
  }, [slotOffset]);

  // Relógio de jogo (ms) — só anda quando a aba está visível
  useEffect(() => {
    const onVis = () => {
      visibleRef.current = !document.hidden;
      // zera a medida do delta para não “acumular” o tempo escondido
      lastFrameRef.current = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // derrota
  const [openDialogDerrota, setOpenDialogDerrota] = useState(false);
  const [dadosDerrota, setDadosDerrota] = useState({
    tropasRetornadas: {},
    feridos: { total: 0, leve: 0, grave: 0 },
    feridosPorTipo: {},
  });
  const gameOverBtnRef = useRef(null); // área clicável do botão "GAME OVER"
  const pointerRef = useRef({ x: 0, y: 0 });
  const hoveredSlotRef = useRef(null); // guarda slot sob o mouse
  const dragStartRef = useRef(null); // início do drag para fade do ghost

  const [dadosVitoria, setDadosVitoria] = useState({ inimigosMortos: 0 });

  // energia
  useEffect(() => {
    setEnergia(estadoAtual?.energia ?? 0);
    energiaRef.current = estadoAtual?.energia ?? 0;
  }, [estadoAtual?.energia]);

  const [supply, setSupply] = useState({
    cur: SUPPLY_CFG.start,
    max: SUPPLY_CFG.max,
    regenPerSec: SUPPLY_CFG.regenPerSec,
  });
  const supplyRef = useRef(supply);
  useEffect(() => {
    supplyRef.current = supply;
  }, [supply]);

  const [deployCooldowns, setDeployCooldowns] = useState({});
  const deployCooldownsRef = useRef(deployCooldowns);
  useEffect(() => {
    deployCooldownsRef.current = deployCooldowns;
  }, [deployCooldowns]);

  const getDeployCooldownMs = (tipo) =>
    Math.max(0, troopTypes?.[tipo]?.deployCooldownMs ?? 0);
  const isOnDeployCooldown = (tipo) =>
    (deployCooldownsRef.current?.[tipo] || 0) > gameTimeRef.current;
  const startDeployCooldown = (tipo) => {
    const ms = getDeployCooldownMs(tipo);
    if (ms > 0) {
      const until = gameTimeRef.current + ms;
      setDeployCooldowns((c) => ({ ...c, [tipo]: until }));
    }
  };

  const getDeployCost = (tipo) =>
    Math.max(0, troopTypes?.[tipo]?.deployCost ?? 0);
  const canAffordSupply = (tipo) =>
    supplyRef.current.cur >= getDeployCost(tipo);
  const spendSupply = (tipo) => {
    const cost = getDeployCost(tipo);
    if (cost <= 0) return;
    setSupply((s) => ({ ...s, cur: Math.max(0, s.cur - cost) }));
  };

  // Regen da barra baseado em gameTime (só avança quando a aba está visível)
  const tickSupplyRegen = () => {
    // se estiver em preparação ou encerrado, apenas reposiciona a âncora
    if (modoPreparacao || jogoEncerrado) {
      lastSupplyGTRef.current = gameTimeRef.current;
      return;
    }

    const gt = gameTimeRef.current;
    const elapsed = gt - lastSupplyGTRef.current; // ms de jogo
    if (elapsed < 1000) return; // resolução de 1s

    const perSec = supplyRef.current.regenPerSec || 0;
    if (perSec <= 0) {
      lastSupplyGTRef.current = gt;
      return;
    }

    const units = Math.floor((elapsed / 1000) * perSec);
    if (units <= 0) return;

    // aplica uma única vez
    setSupply((s) => ({
      ...s,
      cur: Math.min(s.max, s.cur + units),
    }));

    // FX suave no HUD ao aumentar
    triggerSupplyFX(units);

    // avança a âncora apenas pelo tempo efetivamente aplicado
    const usedMs = (units / perSec) * 1000;
    lastSupplyGTRef.current += usedMs;
  };

  // Opcional: resetar a barra quando voltar para preparação
  useEffect(() => {
    if (modoPreparacao && SUPPLY_CFG.resetEveryWave) {
      setSupply((s) => ({ ...s, cur: SUPPLY_CFG.start }));
    }
  }, [modoPreparacao]);

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
    const hospitalAtual = estadoAtual?.hospital ?? {
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
      if (t === "guarda") novaPopulacao.guardas += qtd;
      if (t === "marine") novaPopulacao.marines += qtd;
      if (t === "sniper") novaPopulacao.snipers += qtd;
    });

    // ===== integridade estrutural (só em DERROTA)
    const perdaIntegridade = tipo === "derrota" ? 20 : 0;
    const integridadeAtual = Number.isFinite(estadoAtual.integridadeEstrutural)
      ? estadoAtual.integridadeEstrutural
      : 100;
    const novaIntegridade = Math.max(0, integridadeAtual - perdaIntegridade);

    // === atualizar campanha (battleCampaign) ===
    const bc = estadoAtual.battleCampaign ?? {
      attempts: 0,
      index: 0,
      currentMissionId: "fase_01",
      seed: Date.now(),
      lastOutcome: null,
      lastPlayedAt: null,
      history: {},
    };
    const now = Date.now();
    const currentId = bc.currentMissionId || "fase_01";

    // histórico da fase atual
    const faseHist = bc.history?.[currentId] || {
      attempts: 0,
      victories: 0,
      defeats: 0,
      lastOutcome: null,
      lastPlayedAt: null,
    };

    const updatedFaseHist = {
      ...faseHist,
      attempts: faseHist.attempts + 1,
      victories: faseHist.victories + (tipo === "vitoria" ? 1 : 0),
      defeats: faseHist.defeats + (tipo === "derrota" ? 1 : 0),
      lastOutcome: tipo === "vitoria" ? "victory" : "defeat",
      lastPlayedAt: now,
    };

    let updatedCampaign = {
      ...bc,
      attempts: (bc.attempts ?? 0) + 1,
      lastOutcome: tipo === "vitoria" ? "victory" : "defeat",
      lastPlayedAt: now,
      history: {
        ...bc.history,
        [currentId]: updatedFaseHist,
      },
    };

    if (tipo === "vitoria") {
      const nextId = getNextMissionId(bc.currentMissionId);
      if (nextId && nextId !== bc.currentMissionId) {
        updatedCampaign.currentMissionId = nextId;
        updatedCampaign.index = (bc.index ?? 0) + 1;

        // inicializa histórico da próxima fase se não existir
        if (!updatedCampaign.history[nextId]) {
          updatedCampaign.history[nextId] = {
            attempts: 0,
            victories: 0,
            defeats: 0,
            lastOutcome: null,
            lastPlayedAt: null,
          };
        }
      }
    }

    // montar estado final (inclui battleCampaign)
    const novoEstado = {
      ...estadoAtual,
      energia: energiaRef.current,
      populacao: novaPopulacao,
      hospital: novoHospital,
      integridadeEstrutural: novaIntegridade,
      battleCampaign: updatedCampaign, // <<< AQUI
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
        inimigosMortos: inimigosMortosRef.current,
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
    } else {
      // VITÓRIA
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
      setJogoEncerrado(true);
    }
  };

  const getTroopThumb = (tipo) => {
    const ani = troopAnimations?.[tipo] || {};
    return ani?.idle?.[0] || ani?.defense?.[0] || ani?.attack?.[0] || null;
  };
  const stockMap = {
    colono: ["populacao", "colonos"],
    guarda: ["populacao", "guardas"],
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

  // Bloqueio visual/funcional do slot
  const isDisabledTroop = (tipo, config) => {
    if (energia < config.preco) return true;
    if (getDisponivel(tipo) <= 0) return true;
    if (!canAffordSupply(tipo)) return true;
    if (!modoPreparacao && isOnDeployCooldown(tipo)) return true; // << só bloqueia na onda
    return false;
  };

  // use os mesmos fatores do desenho da tropa
  const COVER = 1.2; //ESCALA
  const SIZE_BOOST = 1.15;
  const TROOP_GROUND_OFFSET_PX = 6; // ↑ positivo desce o sprite (ajuste rápido)

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
    const baseY = (t.row + 1) * view.tileHeight + TROOP_GROUND_OFFSET_PX;

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

  const spawnOneEnemyNow = () => {
    const total = waveConfig.quantidadePorOnda(onda);
    if (inimigosCriadosRef.current >= total) return false;

    const linhas = obterLinhasDeCombateValidas();
    const row = linhas[Math.floor(Math.random() * linhas.length)];

    const tipos = waveConfig?.tiposPorOnda?.(onda) ?? ["medu"];
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];

    const enemy = new Enemy(tipo, row);
    const mapGeom = getMapGeom(canvasRef.current);

    enemy.x = mapGeom.w + 10;
    enemy.opacity = 0;
    enemy.__spawn = { t0: performance.now(), dur: 450 };

    gameRef.current.inimigos.push(enemy);
    inimigosCriadosRef.current += 1;
    inimigosTotaisRef.current += 1;
    return true;
  };

  //#region Desenho
  // ===== desenho
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationId;

    const drawHUD = () => {
      const layout = buildHudLayout(canvas, slotOffsetRef.current);

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

        // === Barra de Capacidade ===
        const s = supplyRef.current;

        // Detecta aumento do alvo (valor real) para disparar o "shock" uma única vez
        {
          const lastTarget = hudFxRef.current.supplyLastTarget;
          if (lastTarget == null) {
            hudFxRef.current.supplyLastTarget = s.cur;
          } else if (s.cur > lastTarget) {
            hudFxRef.current.supplyPulse = { t0: now, dur: 220 };
            hudFxRef.current.supplyLastTarget = s.cur;
          } else if (s.cur !== lastTarget) {
            // apenas atualiza quando muda (queda não faz pulse)
            hudFxRef.current.supplyLastTarget = s.cur;
          }
        }

        // -- LERP temporal p/ suavizar (independente do FPS)
        if (hudFxRef.current.supplyDisplay == null) {
          hudFxRef.current.supplyDisplay = s.cur;
          hudFxRef.current.supplyLastT = now;
        }
        const lastT = hudFxRef.current.supplyLastT || now;
        const dt = Math.max(0, (now - lastT) / 1000); // segundos
        const k = 8; // resposta (maior = mais rápido)
        const a = 1 - Math.exp(-k * dt); // aproximação time-based
        const target = s.cur;
        let disp =
          hudFxRef.current.supplyDisplay +
          (target - hudFxRef.current.supplyDisplay) * a;

        // ✅ SNAP: quando fica muito perto do alvo, fixa no valor final
        if (Math.abs(target - disp) < 0.02) disp = target;

        hudFxRef.current.supplyDisplay = disp;
        hudFxRef.current.supplyLastT = now;

        const visVal = Math.round(disp); // texto
        const pct = Math.max(0, Math.min(1, disp / s.max)); // largura

        // geometria
        const bx = layout.energy.x;
        const by = layout.energy.y + 56; // um pouco mais abaixo da energia
        const bw = layout.energy.w;
        const bh = 16;
        const r = bh / 2;

        // helpers (roundRect)
        const roundRectPath = (x, y, w, h, rad) => {
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, rad);
          } else {
            const rr = Math.min(rad, h / 2, w / 2);
            ctx.beginPath();
            ctx.moveTo(x + rr, y);
            ctx.lineTo(x + w - rr, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
            ctx.lineTo(x + w, y + h - rr);
            ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
            ctx.lineTo(x + rr, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
            ctx.lineTo(x, y + rr);
            ctx.quadraticCurveTo(x, y, x + rr, y);
            ctx.closePath();
          }
        };

        // --- trilho com cantos arredondados ---
        ctx.save();
        roundRectPath(bx, by, bw, bh, r);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.stroke();
        ctx.restore();

        // --- preenchimento (com gradiente) ---
        const fillW = Math.max(0, Math.min(bw, Math.round(bw * pct)));
        if (fillW > 0) {
          ctx.save();

          // clip no formato arredondado do preenchimento
          roundRectPath(bx, by, fillW, bh, r);
          ctx.clip();

          // gradiente vertical
          const gf = ctx.createLinearGradient(bx, by, bx, by + bh);
          gf.addColorStop(0, "rgba(59,130,246,1)"); // azul topo
          gf.addColorStop(1, "rgba(37,99,235,1)"); // azul base
          ctx.fillStyle = gf;
          ctx.fillRect(bx, by, fillW, bh);

          // brilho superior sutil
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(bx + 2, by + 2, Math.max(0, fillW - 4), 2);

          // --- efeito de "shock" ao carregar (só quando aumenta) ---
          const pulse = hudFxRef.current.supplyPulse;
          if (pulse) {
            const pp = Math.min(1, (now - pulse.t0) / pulse.dur);
            const alpha = 1 - pp; // desvanece
            if (alpha > 0) {
              ctx.globalCompositeOperation = "lighter";
              // faixa de luz que “varre” o final da barra
              const stripeW = 12 + 8 * Math.sin(pp * 10);
              const x0 = bx + fillW - stripeW;
              const sg = ctx.createLinearGradient(x0, 0, x0 + stripeW, 0);
              sg.addColorStop(0.0, "rgba(255,255,255,0.0)");
              sg.addColorStop(0.4, `rgba(255,255,255,${0.35 * alpha})`);
              sg.addColorStop(1.0, "rgba(255,255,255,0.0)");
              ctx.fillStyle = sg;
              ctx.fillRect(x0, by, stripeW, bh);

              // leve glow no contorno
              ctx.shadowColor = `rgba(255,255,255,${0.35 * alpha})`;
              ctx.shadowBlur = 14;
              ctx.strokeStyle = `rgba(255,255,255,${0.15 * alpha})`;
              roundRectPath(bx, by, fillW, bh, r);
              ctx.stroke();
            }
            if (pp >= 1) hudFxRef.current.supplyPulse = null;
          }

          ctx.restore();
        }

        // Texto (usa o valor ANIMADO para não “pular de 2 em 2”)
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px Arial";
        ctx.textBaseline = "top";
        ctx.fillText(`Capacidade: ${visVal}/${s.max}`, bx + 6, by - 16);
        ctx.restore();
      }

      // --- separador antes dos slots ---
      drawSeparator(layout.slotsArea.y - 8);

      // Slots (com drop shadow)
      layout.slots.forEach((s) => {
        const cfg = troopTypes[s.tipo];
        const disabled = isDisabledTroop(s.tipo, cfg);

        const iconSize = layout.compact ? 40 : 50;
        const nameFont = layout.compact ? "bold 12px Arial" : "bold 14px Arial";
        const priceFont = "12px Arial";

        ctx.save();
        const isHover = hoveredSlotRef.current?.index === s.index && !disabled;
        // sombra nos slots
        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = disabled
          ? "rgba(65,65,65,0.95)"
          : isHover
          ? "rgba(30,144,255,0.28)"
          : "rgba(30,144,255,0.18)";
        ctx.fillRect(s.x, s.y, s.w, s.h);

        // borda (sem sombra)
        ctx.shadowColor = "transparent";
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.strokeStyle = disabled
          ? "rgba(140,140,140,0.9)"
          : isHover
          ? "rgba(56,189,248,1)"
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

        // “ghost” do drag no slot de origem (fade 0.3s)
        if (isDragging && draggedTroop === s.tipo && dragStartRef.current) {
          const p = Math.min(1, (now - dragStartRef.current) / 300);
          const a = 1 - p;
          if (a > 0 && img && img.complete) {
            ctx.save();
            ctx.globalAlpha = 0.6 * a;
            const g = Math.min(iconSize * 1.2, s.h - 8);
            ctx.drawImage(img, s.x + (s.w - g) / 2, s.y + (s.h - g) / 2, g, g);
            ctx.restore();
          }
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

        // ==== overlay de cooldown (se ativo) ====
        if (!modoPreparacao) {
          const cdUntil = deployCooldownsRef.current?.[s.tipo] || 0;
          const cdLeftMs = Math.max(0, cdUntil - gameTimeRef.current);
          if (cdLeftMs > 0) {
            // semitransparente por cima do slot + texto do tempo
            ctx.save();
            ctx.fillStyle = "rgba(0,0,0,0.45)";
            ctx.fillRect(s.x, s.y, s.w, s.h);

            const sec = (cdLeftMs / 1000).toFixed(1);
            ctx.fillStyle = "#fff";
            ctx.font = layout.compact ? "bold 12px Arial" : "bold 13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`⏱ ${sec}s`, s.x + s.w / 2, s.y + s.h / 2);
            ctx.restore();
          }
        }

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
          ctx.strokeText(txt, cx, s.y + 2 + dy);
          ctx.fillStyle = color;
          ctx.fillText(txt, cx, s.y + 2 + dy);
          ctx.restore();
        }

        // <<< fim do contador (direita)

        // nome (truncado) — agora usa o começo do badge como limite direito
        const nameY = s.y + (layout.compact ? 26 : 28);
        const rightPadding = 12;
        const maxNameW = Math.max(24, badgeX - rightPadding - textX);
        ctx.fillStyle = "#fff";
        drawClampedText(s.tipo, textX, nameY, maxNameW, nameFont);

        // meta em UMA faixa: 💰 ⛽ ⏱ (cooldown só se houver)
        const metaY = s.y + (layout.compact ? s.h - 10 : s.h - 12);
        ctx.fillStyle = "#fff";
        ctx.font = priceFont;
        const capCost = getDeployCost(s.tipo);
        const cdMs = getDeployCooldownMs(s.tipo);
        const meta =
          `💰 ${cfg.preco}  ⛽ ${capCost}` +
          (cdMs > 0 ? `  ⏱ ${(cdMs / 1000) | 0}s` : "");
        drawClampedText(
          meta,
          textX,
          metaY,
          Math.max(24, s.x + s.w - 12 - textX),
          priceFont
        );

        ctx.restore();
      });

      // ---- Controles de rolagem (aparecem só quando necessário) ----
      if (layout.scroll && layout.scroll.total > layout.scroll.visibleCount) {
        const sc = layout.scroll;

        // trilho
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(sc.track.x, sc.track.y, sc.track.w, sc.track.h);
        ctx.restore();

        // thumb
        if (sc.thumb) {
          ctx.save();
          ctx.shadowColor = "rgba(96,165,250,0.6)";
          ctx.shadowBlur = 8;
          const th = sc.thumb;
          ctx.fillStyle = "rgba(96,165,250,0.9)"; // azul 400
          ctx.fillRect(th.x, th.y, th.w, th.h);
          ctx.restore();
        }

        // botões ▲ / ▼
        const drawArrowBtn = (r, dir, enabled) => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const rad = Math.min(r.w, r.h) / 2;

          ctx.save();
          ctx.globalAlpha = enabled ? 0.95 : 0.4;

          // sombra externa
          ctx.shadowColor = "rgba(0,0,0,0.35)";
          ctx.shadowBlur = 10;

          // corpo circular com gradiente
          const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
          g.addColorStop(0, "rgba(59,130,246,0.95)"); // azul 500
          g.addColorStop(1, "rgba(37,99,235,0.95)"); // azul 600
          ctx.fillStyle = g;

          ctx.beginPath();
          ctx.arc(cx, cy, rad - 1, 0, Math.PI * 2);
          ctx.fill();

          // borda leve
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.stroke();

          // brilho "gloss" superior
          ctx.globalAlpha *= 0.45;
          ctx.beginPath();
          ctx.arc(cx, cy - rad * 0.25, rad * 0.7, Math.PI, 0);
          ctx.fillStyle = "rgba(255,255,255,0.55)";
          ctx.fill();

          // seta
          ctx.globalAlpha = enabled ? 1 : 0.45;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          const s = 5.5;
          if (dir === "up") {
            ctx.moveTo(cx, cy - s);
            ctx.lineTo(cx - s, cy + s);
            ctx.lineTo(cx + s, cy + s);
          } else {
            ctx.moveTo(cx, cy + s);
            ctx.lineTo(cx - s, cy - s);
            ctx.lineTo(cx + s, cy - s);
          }
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        };

        drawArrowBtn(sc.upBtn, "up", sc.hasPrev);
        drawArrowBtn(sc.downBtn, "down", sc.hasNext);
      }

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

    function roundRectPath(ctx, x, y, w, h, r) {
      const rr = Math.min(r, h / 2, w / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    const draw = () => {
      // Avança relógio de jogo (só quando a aba está visível)
      {
        const now = performance.now();
        const dt = now - lastFrameRef.current;
        lastFrameRef.current = now;
        if (visibleRef.current)
          gameTimeRef.current += dt * timeScaleRef.current; // ver item 5
        const inst = dt > 0 ? 1000 / dt : 0;
        const alpha = 0.12;
        fpsRef.current.ema = fpsRef.current.ema
          ? fpsRef.current.ema * (1 - alpha) + inst * alpha
          : inst;
      }
      const map = getMapGeom(canvas);

      // disponibiliza geometria + função para quem cria projéteis
      gameRef.current.view = map;
      gameRef.current.getMuzzleWorldPos = (troop) =>
        getMuzzleWorldPos(troop, map);

      const { tileWidth, tileHeight } = map;

      const ctx = canvas.getContext("2d");
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
        // spawn: fade-in + “pop”
        let pop = 1;
        if (t.__spawn) {
          const p = Math.min(
            1,
            (performance.now() - t.__spawn.t0) / t.__spawn.dur
          );
          t.opacity = p; // 0 → 1
          const c1 = 1.70158,
            c3 = c1 + 1;
          const easeOutBack = (x) =>
            1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
          pop = 0.85 + 0.25 * easeOutBack(p);
          if (p >= 1) delete t.__spawn;
        }
        const escala = (alturaDesejada / img.height) * pop;
        const larguraDesejada = img.width * escala;

        const baseX = t.col * tileWidth + tileWidth / 2;
        const baseY = (t.row + 1) * tileHeight + TROOP_GROUND_OFFSET_PX;

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
        const now = performance.now();
        let drawX = e.x,
          squashX = 1,
          squashY = 1,
          tilt = 0;
        if (e.__knock) {
          const p = Math.min(1, (now - e.__knock.t0) / e.__knock.dur);
          const c1 = 1.70158,
            c3 = c1 + 1;
          const easeOutBack = (x) =>
            1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
          const eased = easeOutBack(p);
          drawX = e.__knock.fromX + (e.__knock.toX - e.__knock.fromX) * eased;
          const s = Math.sin(Math.PI * Math.min(1, p * 1.2)); // squash no começo
          squashX = 1 + 0.25 * s; // “achata” no Y e estica no X
          squashY = 1 - 0.2 * s;
          tilt = -0.15 * s; // leve inclinação
          if (p >= 1) delete e.__knock;
        }

        const frames =
          (e.framesByState && e.state && e.framesByState[e.state]) ||
          e.frames ||
          [];
        const img = frames[e.frameIndex];
        if (!img?.complete) return;

        const escalaBase = 0.27; // Escala do inimigo
        const alturaDesejada = 425 * escalaBase;
        const y = e.row * tileHeight + tileHeight / 2;

        // ====== SOMBRA ======
        {
          const baseX = drawX;
          const feetY = y + alturaDesejada / 2 - 2 + (e.__sink || 0);
          const rx = tileWidth * 0.34;
          const ry = tileHeight * 0.14;
          const alphaBase = (e.opacity != null ? e.opacity : 1) * 0.9;
          ctx.save();
          ctx.globalAlpha = alphaBase;
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

        // ====== SPRITE ======
        ctx.save();

        // >>> Fade-in + “pop” no spawn
        let pop = 1;
        if (e.__spawn) {
          const now = performance.now();
          const p = Math.min(1, (now - e.__spawn.t0) / e.__spawn.dur); // 0..1
          // opacidade cresce de 0 a 1
          e.opacity = p;
          // pop com leve overshoot (easeOutBack)
          const c1 = 1.70158,
            c3 = c1 + 1;
          const easeOutBack = (x) =>
            1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
          pop = 0.85 + 0.25 * easeOutBack(p);
          if (p >= 1) delete e.__spawn; // terminou a animação
        }

        // Fade-out/encolhe/afunda na morte
        if (e.__death) {
          const now = performance.now();
          const p = Math.min(1, (now - e.__death.t0) / e.__death.dur);
          const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic
          e.opacity = 1 - ease; // some
          pop *= 1 - 0.2 * ease; // encolhe um pouco
          e.__sink = 10 * ease; // afunda levemente
        }

        const src = img.__bmp || img;
        const iw = src.width ?? img.naturalWidth ?? img.width ?? 1;
        const ih = src.height ?? img.naturalHeight ?? img.height ?? 1;

        const scale = (alturaDesejada / ih) * pop;
        const w = iw * scale,
          h = ih * scale;

        ctx.globalAlpha = e.opacity ?? 1; // <<< usa opacidade
        ctx.translate(drawX, y + (e.__sink || 0));
        ctx.rotate(tilt);
        ctx.scale(squashX, squashY);
        ctx.drawImage(src, -w / 2, -h / 2, w, h);
        ctx.restore();

        // barra de vida...
        if (!e.__death) {
          const barWidth = 30;
          const barHeight = 4;
          const barX = drawX - barWidth / 2;
          const barY = y - 30;
          ctx.fillStyle = "red";
          ctx.fillRect(barX, barY, barWidth, barHeight);
          ctx.fillStyle = "lime";
          ctx.fillRect(barX, barY, (barWidth * e.hp) / e.maxHp, barHeight);
          ctx.strokeStyle = "black";
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
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

        if (!pt.kind || pt.kind === "ring") {
          // anel que cresce (seu comportamento original)
          ctx.strokeStyle = pt.cor || "#fff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2 + pt.t, 0, Math.PI * 2);
          ctx.stroke();
        } else if (pt.kind === "spark") {
          // faísca com leve gravidade
          ctx.fillStyle = pt.cor || "#fff";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
          pt.x += pt.vx || 0;
          pt.y += pt.vy || 0;
          pt.vy = (pt.vy || 0) + (pt.g || 0.05);
        } else if (pt.kind === "beam") {
          // Envelope temporal: afina -> engorda -> afina
          const life = pt.t / pt.max; // 0..1
          const easeInOut = (x) =>
            x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
          const k = easeInOut(life);
          const wMax = pt.w || 10;
          const w = Math.max(1.5, wMax * (0.35 + 0.65 * k)); // largura do “glow”
          const core = Math.max(1, w * 0.35); // núcleo branco

          // Vetores do feixe
          const dx = pt.x1 - pt.x0,
            dy = pt.y1 - pt.y0;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len,
            uy = dy / len; // direção
          const nx = -uy,
            ny = ux; // normal

          // Taper nas pontas: w0 (início) < wMid > w1 (fim)
          const w0 = Math.max(0.6, w * 0.45);
          const wMid = w;
          const w1 = Math.max(0.6, w * 0.45);

          // Pontos ao longo do feixe (0, 0.5, 1) com larguras diferentes
          const xMid = pt.x0 + dx * 0.5,
            yMid = pt.y0 + dy * 0.5;

          // Polígono do “glow” com taper
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.55 * (1 - life); // desvanece no fim

          const grad = ctx.createLinearGradient(pt.x0, pt.y0, pt.x1, pt.y1);
          grad.addColorStop(0, pt.cor || "#6cf");
          grad.addColorStop(0.5, pt.cor || "#6cf");
          grad.addColorStop(1, pt.cor || "#6cf");
          ctx.fillStyle = grad;

          ctx.beginPath();
          // lado esquerdo
          ctx.moveTo(pt.x0 + nx * w0, pt.y0 + ny * w0);
          ctx.lineTo(xMid + nx * wMid, yMid + ny * wMid);
          ctx.lineTo(pt.x1 + nx * w1, pt.y1 + ny * w1);
          // lado direito
          ctx.lineTo(pt.x1 - nx * w1, pt.y1 - ny * w1);
          ctx.lineTo(xMid - nx * wMid, yMid - ny * wMid);
          ctx.lineTo(pt.x0 - nx * w0, pt.y0 - ny * w0);
          ctx.closePath();
          ctx.fill();

          // Núcleo fino
          ctx.globalAlpha = 0.9 * (1 - life);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = core;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pt.x0, pt.y0);
          ctx.lineTo(pt.x1, pt.y1);
          ctx.stroke();

          // —— Raios laterais (zig-zag) com ruído seedado ——
          let s = (pt.seed | 0) >>> 0;
          const rnd = () => {
            // xorshift32
            s ^= s << 13;
            s >>>= 0;
            s ^= s >> 17;
            s >>>= 0;
            s ^= s << 5;
            s >>>= 0;
            return (s >>> 0) / 4294967296;
          };

          const branches = 2; // quantidade de raios
          const segs = 10; // segmentos por raio
          const ampBase = w * 0.55 * (0.4 + 0.6 * k); // amplitude cresce no meio

          ctx.lineJoin = "round";
          for (let b = 0; b < branches; b++) {
            const sign = rnd() < 0.5 ? -1 : 1;
            const alpha = 0.38 * (1 - life);
            const lw = Math.max(1, core * 0.55);

            ctx.globalAlpha = alpha;
            ctx.strokeStyle = pt.cor || "#6cf";
            ctx.lineWidth = lw;
            ctx.beginPath();

            for (let i = 0; i <= segs; i++) {
              const t = i / segs; // 0..1 ao longo do feixe
              const bx = pt.x0 + dx * t;
              const by = pt.y0 + dy * t;
              // envelope de jitter: 0 nas pontas, pico no meio
              const env = Math.sin(Math.PI * t);
              const j = (rnd() * 2 - 1) * ampBase * env;
              const x = bx + nx * j * sign;
              const y = by + ny * j * sign;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);

              // pequenas ramificações curtas
              if (rnd() < 0.12 && i > 1 && i < segs - 1) {
                const lenBr = 6 + rnd() * 10;
                const dir = sign * (rnd() < 0.5 ? 1 : -1);
                ctx.moveTo(x, y);
                ctx.lineTo(x + nx * lenBr * dir, y + ny * lenBr * dir);
              }
            }
            ctx.stroke();
          }

          ctx.restore();
        }

        ctx.restore();
        pt.t++;
        return pt.t < pt.max;
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

      // Banner de onda (start/sucesso)
      if (waveBannerRef.current) {
        const { text, sub, color, t0, dur } = waveBannerRef.current;
        const now = performance.now();
        const p = Math.min(1, (now - t0) / dur); // 0..1
        const fade = p < 0.5 ? p / 0.5 : (1 - p) / 0.5; // in/out
        const W = canvas.clientWidth,
          H = canvas.clientHeight;

        ctx.save();
        // fundo escuro suave
        ctx.globalAlpha = 0.45 * fade;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);

        // título com leve glow
        ctx.globalAlpha = fade;
        const baseFont = Math.floor(Math.min(W, H) * 0.075);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.font = `900 ${baseFont}px "Arial Black", Arial, sans-serif`;
        ctx.shadowColor = color;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 8;
        ctx.strokeStyle = color;
        ctx.strokeText(text, W / 2, H * 0.45);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, W / 2, H * 0.45);

        if (sub) {
          ctx.font = `600 ${Math.floor(baseFont * 0.35)}px Arial, sans-serif`;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fillText(sub, W / 2, H * 0.45 + baseFont * 0.9);
        }
        ctx.restore();

        if (p >= 1) waveBannerRef.current = null;
      }

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

      // ===== FPS OSD (canto superior direito) =====
      {
        const fps = fpsRef.current.ema || 0;
        const txt = `${fps.toFixed(0)} FPS`;
        ctx.save();
        ctx.font = "bold 12px Arial";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";

        // fundo semi-transparente para legibilidade
        const padX = 6,
          padY = 4;
        const textW = ctx.measureText(txt).width;
        const boxW = textW + padX * 2;
        const boxH = 18;
        const xRight = canvas.clientWidth - 10;
        const yTop = 8;

        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(xRight - boxW, yTop, boxW, boxH);

        // texto com leve sombra
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = "#fff";
        ctx.fillText(txt, xRight - padX, yTop + 2);
        ctx.restore();
      }

      // ===== BARRA DE FORÇAS (HP Aliado vs Inimigo) — canto direito =====
      {
        // --- 1) somatórios de HP em tempo real ---
        let friendly = 0,
          enemy = 0;
        for (const t of gameRef.current.tropas) {
          const cur = Number.isFinite(t.hp) ? t.hp : t.hp?.current ?? 0;
          if (cur > 0) friendly += cur;
        }
        for (const e of gameRef.current.inimigos) {
          if ((e.hp ?? 0) > 0) enemy += e.hp;
        }
        const tot = friendly + enemy;

        // alvo instântaneo (sem suavização)
        const target = tot > 0 ? friendly / tot : 1;

        // alvo anterior (pra detectar deltas e spawnar efeitos)
        const prevFriendly = hpBarRef.current.lastFriendly ?? 0;
        const prevEnemy = hpBarRef.current.lastEnemy ?? 0;
        const prevTot = prevFriendly + prevEnemy;
        const prevTarget = prevTot > 0 ? prevFriendly / prevTot : 1;

        // registra p/ próxima iteração
        hpBarRef.current.lastFriendly = friendly;
        hpBarRef.current.lastEnemy = enemy;

        // --- 2) suavização (EMA) p/ barra base (não “pulos” bruscos) ---
        const alpha = 0.18; // maior = reage mais rápido
        if (hpBarRef.current.pct == null) hpBarRef.current.pct = target;
        hpBarRef.current.pct =
          hpBarRef.current.pct * (1 - alpha) + target * alpha;
        if (Math.abs(hpBarRef.current.pct - target) < 0.005) {
          hpBarRef.current.pct = target; // snap quando muito perto
        }
        const pctSm = hpBarRef.current.pct;

        // --- 3) spawn de efeitos quando a *proporção* muda de modo perceptível ---
        const DIFF_EPS = 0.01; // evita ruído minúsculo
        if (
          Math.abs(target - prevTarget) > DIFF_EPS &&
          prevTot > 0 &&
          tot > 0
        ) {
          hpBarRef.current.fx.push({
            type: target > prevTarget ? "allyGain" : "allyLoss",
            from: prevTarget,
            to: target,
            t0: performance.now(),
            dur: 550, // ms
          });
          // Limita fila pra não acumular infinito
          if (hpBarRef.current.fx.length > 6) hpBarRef.current.fx.shift();
        }

        // --- 4) geometria/estilo da barra ---
        const barW = 18;
        const barH = 180;
        const radius = 9;
        const marginRight = 10;

        const x = canvas.clientWidth - marginRight - barW;
        // Se você desenha o FPS no topo direito ~18px de altura:
        const yTop = 8 + 18 + 8; // topo + FPS + margem
        // Se NÃO tiver FPS, use: const yTop = 8;

        const now = performance.now();

        // --- 5) fundo arredondado ---
        ctx.save();
        roundRectPath(ctx, x, yTop, barW, barH, radius);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.stroke();

        // clip dentro do corpo arredondado
        ctx.save();
        roundRectPath(ctx, x, yTop, barW, barH, radius);
        ctx.clip();

        // --- 6) preenchimentos base (azul em baixo, vermelho em cima) ---
        const blueH = Math.round(barH * pctSm);
        const redH = barH - blueH;

        // pequeno “breath” (pulso muito sutil)
        const breath = 0.02 * Math.sin(now / 650);
        const edgeY = yTop + barH - blueH;

        // vermelho (inimigo) — topo
        if (redH > 0) {
          const gr = ctx.createLinearGradient(x, yTop, x, yTop + redH);
          gr.addColorStop(0, "rgba(239,68,68,0.95)");
          gr.addColorStop(1, "rgba(220,38,38,0.90)");
          ctx.fillStyle = gr;
          ctx.fillRect(x, yTop, barW, redH);
        }

        // azul (aliado) — base
        if (blueH > 0) {
          const gb = ctx.createLinearGradient(x, edgeY, x, yTop + barH);
          gb.addColorStop(0, "rgba(59,130,246,0.98)");
          gb.addColorStop(1, "rgba(37,99,235,0.95)");
          ctx.fillStyle = gb;
          ctx.fillRect(x, edgeY, barW, blueH);
        }

        // --- 7) glow na divisória (linha de fronte) ---
        {
          const pulse = 0.5 + 0.5 * Math.sin(now / 220);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.shadowColor = "rgba(255,255,255,0.6)";
          ctx.shadowBlur = 10 + 4 * pulse;
          ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.04 * pulse})`;
          ctx.fillRect(x - 1, edgeY - 1, barW + 2, 2);
          ctx.restore();
        }

        // --- 8) efeitos de “consumo” (wipes) quando a proporção muda ---
        for (let i = hpBarRef.current.fx.length - 1; i >= 0; i--) {
          const fx = hpBarRef.current.fx[i];
          const t = (now - fx.t0) / fx.dur;
          const p = Math.min(1, Math.max(0, t));
          const ease = 1 - Math.pow(1 - p, 3); // easeOutCubic

          // bordas (em Y) que a troca percorre
          const fromY = yTop + barH * (1 - fx.from);
          const toY = yTop + barH * (1 - fx.to);
          const y0 = Math.min(fromY, toY);
          const y1 = Math.max(fromY, toY);

          // posição da “frente” do wipe
          const leadY = fromY + (toY - fromY) * ease;
          const stripeH = 12;

          if (fx.type === "allyGain") {
            // Você causou dano → azul ganhou espaço
            // 8a) pinta a faixa convertida com branco sutil (rastro)
            ctx.save();
            ctx.globalAlpha = 0.16 * (1 - p);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x, y0, barW, y1 - y0);
            ctx.restore();

            // 8b) linha branca móvel (efeito de “guilhotina”)
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createLinearGradient(
              0,
              leadY - stripeH / 2,
              0,
              leadY + stripeH / 2
            );
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(0.5, `rgba(255,255,255,${0.65 * (1 - p)})`);
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x, leadY - stripeH / 2, barW, stripeH);
            ctx.restore();
          } else {
            // Inimigos causaram dano → azul perdeu espaço (vermelho sobe)
            // 8c) preenche a faixa com vermelho translúcido
            ctx.save();
            ctx.globalAlpha = 0.22 * (1 - p);
            const gr = ctx.createLinearGradient(0, y0, 0, y1);
            gr.addColorStop(0, "rgba(239,68,68,0.9)");
            gr.addColorStop(1, "rgba(220,38,38,0.9)");
            ctx.fillStyle = gr;
            ctx.fillRect(x, y0, barW, y1 - y0);
            ctx.restore();

            // 8d) linha vermelha móvel
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const g = ctx.createLinearGradient(
              0,
              leadY - stripeH / 2,
              0,
              leadY + stripeH / 2
            );
            g.addColorStop(0, "rgba(239,68,68,0)");
            g.addColorStop(0.5, `rgba(239,68,68,${0.6 * (1 - p)})`);
            g.addColorStop(1, "rgba(239,68,68,0)");
            ctx.fillStyle = g;
            ctx.fillRect(x, leadY - stripeH / 2, barW, stripeH);
            ctx.restore();
          }

          if (p >= 1) hpBarRef.current.fx.splice(i, 1);
        }

        // --- 9) highlights e detalhes sutis ---
        // brilho superior sutil (gloss)
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 2, yTop + 2, barW - 4, 2);
        ctx.restore();

        // “respiração” muito leve nas extremidades (quase imperceptível)
        ctx.save();
        ctx.globalAlpha = 0.05 + 0.03 * Math.abs(breath);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, yTop, barW, 2);
        ctx.fillRect(x, yTop + barH - 2, barW, 2);
        ctx.restore();

        // sai do clip e do grupo
        ctx.restore(); // clip
        ctx.restore(); // caixa

        // --- 10) percentual textual opcional ao lado ---
        // --- 10) % no centro da divisória ---
        const pctNum = Math.round((tot > 0 ? friendly / tot : 1) * 100);
        const cx = x + barW / 2;
        ctx.save();
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(0,0,0,0.45)";
        ctx.strokeText(`${pctNum}%`, cx, edgeY);
        ctx.fillStyle = "#fff";
        ctx.fillText(`${pctNum}%`, cx, edgeY);
        ctx.restore();

        // rótulos pequenos
        ctx.save();
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillText("🟥 Inimigos", cx, yTop - 8);
        ctx.fillText("🟦 Aliados", cx, yTop + barH + 10);
        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    };

    //#region Final desenho

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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointerRef.current = { x, y };

    const hud = hudRectsRef.current;
    if (hud?.scroll) {
      if (
        (hud.scroll.hasPrev && within(hud.scroll.upBtn, x, y)) ||
        (hud.scroll.hasNext && within(hud.scroll.downBtn, x, y))
      ) {
        canvas.style.cursor = "pointer";
      } else if (!isDragging) {
        canvas.style.cursor = "default";
      }
    }

    // acha slot sob o mouse
    if (hud?.slots) {
      let hov = null;
      for (const s of hud.slots)
        if (within(s, x, y)) {
          hov = s;
          break;
        }
      hoveredSlotRef.current = hov;
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
    if (hud && hud.scroll) {
      if (within(hud.scroll.upBtn, x, y) && hud.scroll.hasPrev) {
        setSlotOffset((o) => Math.max(0, o - 1));
        return;
      }
      if (within(hud.scroll.downBtn, x, y) && hud.scroll.hasNext) {
        setSlotOffset((o) => Math.min(hud.scroll.maxOffset, o + 1));
        return;
      }
    }

    if (hud) {
      if (within(hud.waveBtn, x, y)) {
        if (modoPreparacao) {
          // 👇 banner no início da onda
          showWaveBanner(`📡 Horda ${onda} detectada!`, {
            color: "#60a5fa",
            dur: 2600,
          });

          setModoPreparacao(false);
          inimigosCriadosRef.current = 0;
          lastSupplyGTRef.current = gameTimeRef.current;

          spawnOneEnemyNow();
          setContadorSpawn(0);
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
          if (!canAffordSupply(s.tipo)) return;
          if (!modoPreparacao && isOnDeployCooldown(s.tipo)) return;

          setIsDragging(true);
          setDraggedTroop(s.tipo);
          dragStartRef.current = performance.now();
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
    if (
      !canAffordSupply(draggedTroop) ||
      (!modoPreparacao && isOnDeployCooldown(draggedTroop))
    ) {
      setIsDragging(false);
      setDraggedTroop(null);
      return;
    }

    {
      const troop = new Troop(draggedTroop, row, col);
      troop.opacity = 0;
      troop.__spawn = { t0: performance.now(), dur: 420 };
      gameRef.current.tropas.push(troop);
      emitTroopSpawnFX(row, col);
    }
    tryPushEnemyBack(row, col);

    const novaEnergia = energiaRef.current - troopTypes[draggedTroop].preco;
    const novaPopulacao = { ...estadoAtual.populacao };
    const novaConstrucoes = { ...estadoAtual.construcoes };

    if (draggedTroop === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (draggedTroop === "guarda" && novaPopulacao.guardas > 0) {
      novaPopulacao.guardas -= 1;
      estadoAtual.populacao.guardas -= 1;
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

    // desconta capacidade e inicia cooldown
    spendSupply(draggedTroop);
    if (!modoPreparacao) startDeployCooldown(draggedTroop);

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

  const handleWheel = (e) => {
    const hud = hudRectsRef.current;
    if (!hud) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    if (!within(hud.panel, x, y)) return; // só rola se o mouse estiver no painel
    const dir = Math.sign(e.deltaY);
    if (dir > 0 && hud.scroll?.hasNext)
      setSlotOffset((o) => Math.min(hud.scroll.maxOffset, o + 1));
    if (dir < 0 && hud.scroll?.hasPrev)
      setSlotOffset((o) => Math.max(0, o - 1));
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
        } else if (tipo === "guarda") {
          novaPopulacao.guardas += 1;
          estadoAtual.populacao.guardas += 1;
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
    if (!canAffordSupply(tropaSelecionada)) return;
    if (!modoPreparacao && isOnDeployCooldown(tropaSelecionada)) return;

    {
      const troop = new Troop(tropaSelecionada, row, col);
      troop.opacity = 0;
      troop.__spawn = { t0: performance.now(), dur: 420 };
      gameRef.current.tropas.push(troop);
      emitTroopSpawnFX(row, col);
    }

    const novaEnergia = energiaRef.current - troopTypes[tropaSelecionada].preco;
    const novaPopulacao = { ...estadoAtual.populacao };
    const novaConstrucoes = { ...estadoAtual.construcoes };

    if (tropaSelecionada === "colono" && novaPopulacao.colonos > 0) {
      novaPopulacao.colonos -= 1;
      estadoAtual.populacao.colonos -= 1;
    } else if (tropaSelecionada === "guarda" && novaPopulacao.guardas > 0) {
      novaPopulacao.guardas -= 1;
      estadoAtual.populacao.guardas -= 1;
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

    // desconta capacidade e inicia cooldown
    spendSupply(tropaSelecionada);
    if (!modoPreparacao) startDeployCooldown(tropaSelecionada);

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
        // Regen baseado em gameTime (que deve estar escalado por timeScaleRef)
        tickSupplyRegen();
        if (jogoEncerrado || modoPreparacao) return;

        // quantos "passos" de simulação por tick (1x/2x)
        const steps = Math.max(1, Math.floor(timeScaleRef.current));

        let encerrouAgora = false;

        // ===== simulação (movimento/colisões/mortes) =====
        for (let i = 0; i < steps; i++) {
          // Atualiza posição (não move quem está morrendo)
          {
            const { inimigos } = gameRef.current;
            gameRef.current.inimigos = inimigos.map((e) => {
              if (!e.__death) {
                const knocking =
                  e.__knock && performance.now() - e.__knock.t0 < e.__knock.dur;
                const stunned =
                  e.__stunUntil && gameTimeRef.current < e.__stunUntil;
                if (!knocking && !stunned) e.updatePosition?.();
              }
              return e;
            });
          }

          CollisionManager.inimigosAtacam(gameRef.current);
          if (gameRef.current.inimigos.some((e) => !e.__death && e.x <= 50)) {
            setJogoEncerrado(true);
            encerrouAgora = true;
            break;
          }
          CollisionManager.updateProjectilesAndCheckCollisions(gameRef.current);
          CollisionManager.tropasAtacam(gameRef.current);

          // Dispara animação de morte para quem morreu neste passo
          const mapGeom = getMapGeom(canvasRef.current);
          gameRef.current.inimigos.forEach((e) => {
            if ((e.hp ?? 0) <= 0 && !e.__death) {
              e.__death = { t0: performance.now(), dur: 520 };
              e.opacity = 1;

              const cy = e.row * mapGeom.tileHeight + mapGeom.tileHeight / 2;
              for (let i = 0; i < 3; i++) {
                gameRef.current.particles.push({
                  kind: "ring",
                  x: e.x,
                  y: cy,
                  t: 0,
                  max: 12 + i * 7,
                  cor: i === 0 ? "rgba(255,80,80,1)" : "rgba(255,255,255,0.9)",
                });
              }
              for (let i = 0; i < 14; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 1 + Math.random() * 2.2;
                gameRef.current.particles.push({
                  kind: "spark",
                  x: e.x,
                  y: cy,
                  vx: Math.cos(ang) * spd,
                  vy: Math.sin(ang) * spd * 0.7 - 0.2,
                  g: 0.06,
                  t: 0,
                  max: (18 + Math.random() * 14) | 0,
                  cor: "rgba(255,200,80,1)",
                });
              }
            }
          });

          // Remove só quando a animação de morte terminar
          gameRef.current.inimigos = gameRef.current.inimigos.filter((e) => {
            if (!e.__death) return true;
            const p = (performance.now() - e.__death.t0) / e.__death.dur;
            return p < 1;
          });
        }

        if (encerrouAgora) return;

        // ===== spawn (acumula por steps para permitir múltiplos spawns no mesmo tick) =====
        setContadorSpawn((prev) => {
          let acc = prev + steps;

          while (
            acc >= waveConfig.frequenciaSpawn &&
            inimigosCriadosRef.current < waveConfig.quantidadePorOnda(onda)
          ) {
            const row =
              linhasValidasParaSpawn[
                Math.floor(Math.random() * linhasValidasParaSpawn.length)
              ];

            const tiposDisponiveis = waveConfig?.tiposPorOnda?.(onda) ?? [
              "medu",
            ];
            const tipoAleatorio =
              tiposDisponiveis[
                Math.floor(Math.random() * tiposDisponiveis.length)
              ];

            // cria inimigo na borda direita do MAPA
            const enemy = new Enemy(tipoAleatorio, row);
            const mapGeom = getMapGeom(canvasRef.current);
            enemy.x = mapGeom.w + 10;

            // FX de spawn
            const cy = row * mapGeom.tileHeight + mapGeom.tileHeight / 2;
            enemy.opacity = 0;
            enemy.__spawn = { t0: performance.now(), dur: 450 };
            for (let i = 0; i < 3; i++) {
              gameRef.current.particles.push({
                kind: "ring",
                x: enemy.x,
                y: cy,
                t: 0,
                max: 14 + i * 7,
                cor: i === 0 ? "rgba(255,80,80,1)" : "rgba(255,255,255,0.9)",
              });
            }
            for (let i = 0; i < 12; i++) {
              const ang = Math.random() * Math.PI * 2;
              const spd = 1 + Math.random() * 2;
              gameRef.current.particles.push({
                kind: "spark",
                x: enemy.x,
                y: cy,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd * 0.6 - 0.4,
                g: 0.04,
                t: 0,
                max: (18 + Math.random() * 12) | 0,
                cor: "rgba(255,200,80,1)",
              });
            }

            gameRef.current.inimigos.push(enemy);
            inimigosCriadosRef.current += 1;
            inimigosTotaisRef.current += 1;

            acc -= waveConfig.frequenciaSpawn;
          }

          return acc;
        });

        // ===== checagem de fim de onda =====
        const todosInimigosMortos = gameRef.current.inimigos.length === 0;
        const todosInimigosGerados =
          inimigosCriadosRef.current >= waveConfig.quantidadePorOnda(onda);

        if (!modoPreparacao && todosInimigosMortos && todosInimigosGerados) {
          const totalOndas =
            waveConfig?.totalOndas ??
            (Array.isArray(waveConfig?.waves) ? waveConfig.waves.length : 1);
          const eUltimaOnda = onda >= totalOndas;

          if (eUltimaOnda) {
            await finalizarRodada("vitoria");
          } else {
            const ondaAtual = onda;
            showWaveBanner(`✅ Onda ${ondaAtual} concluída!`, {
              sub: `Prepare-se: Horda ${ondaAtual + 1} chegando…`,
              color: "#10b981",
              dur: 2600,
            });
            setModoPreparacao(true);
            setOnda((o) => o + 1);
          }
        }
      })();
    }, 32);

    return () => clearInterval(loopId);
  }, [jogoEncerrado, onda, modoPreparacao, waveConfig]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        minHeight: 0,
        width: "100%",
      }}
    >
      {/* Botão 1x/2x — canto sup. direito */}
      <Button
        variant="contained"
        size="small"
        disableElevation
        startIcon={<Speed fontSize="small" />}
        onClick={() => setTimeScale((v) => (v === 1 ? 2 : 1))}
        sx={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 10000,
          px: 1.6,
          minWidth: 72,
          borderRadius: "999px",
          textTransform: "none",
          fontWeight: 800,
          letterSpacing: 0.2,
          color: "#fff",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.18)",
          background:
            timeScale === 1
              ? "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)"
              : "linear-gradient(135deg, #10b981 0%, #22c55e 100%)",
          boxShadow:
            timeScale === 1
              ? "0 8px 20px rgba(59,130,246,0.35)"
              : "0 8px 20px rgba(16,185,129,0.35)",
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow:
              timeScale === 1
                ? "0 12px 28px rgba(59,130,246,0.45)"
                : "0 12px 28px rgba(16,185,129,0.45)",
          },
          "&:active": { transform: "translateY(0px) scale(0.98)" },
        }}
      >
        {timeScale}x
      </Button>

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
