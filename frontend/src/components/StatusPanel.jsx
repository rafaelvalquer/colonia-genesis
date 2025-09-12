import React, { useEffect, useState } from "react";
import {
  FaRegHeart,
  FaBolt,
  FaTint,
  FaDrumstickBite,
  FaHammer,
  FaUsers,
  FaLeaf,
  FaClock,
  FaShieldAlt,
  FaFlask,
} from "react-icons/fa";

// ⬇️ IMPORTS MUI p/ avatar + dialog
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Grid from "@mui/material/Grid";
import ButtonBase from "@mui/material/ButtonBase";

import coloniaService from "../services/coloniaService.js";

function StatusPanel({ estado, onEstadoChange }) {
  // ===== AVATAR =====
  const AVATAR_SIZE = 64;
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // pega do backend se vier; senão, localStorage; senão, 1
  const [avatarIndex, setAvatarIndex] = useState(() => {
    if (Number.isFinite(estado?.avatarIndex)) return estado.avatarIndex;
    const saved = Number(localStorage.getItem("avatarIndex"));
    return Number.isFinite(saved) && saved >= 1 && saved <= 10 ? saved : 1;
  });

  // se o backend mandar um valor novo depois, sincroniza
  useEffect(() => {
    if (
      Number.isFinite(estado?.avatarIndex) &&
      estado.avatarIndex !== avatarIndex
    ) {
      setAvatarIndex(estado.avatarIndex);
      localStorage.setItem("avatarIndex", String(estado.avatarIndex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.avatarIndex]);

  const avatarSrc = `/images/avatar/${avatarIndex}.png`;

  const handleSelectAvatar = async (idx) => {
    if (saving) return;
    const prev = avatarIndex;

    // optimistic update
    setAvatarIndex(idx);
    localStorage.setItem("avatarIndex", String(idx));
    setSaving(true);

    try {
      await coloniaService.atualizarColonia(estado._id, { avatarIndex: idx });
      // avisa o pai para re-renderizar com o novo estado (opcional, mas recomendado)
      onEstadoChange?.({ ...estado, avatarIndex: idx });
      setAvatarOpen(false);
    } catch (err) {
      console.error("Falha ao salvar avatar:", err);
      // rollback visual/local
      setAvatarIndex(prev);
      localStorage.setItem("avatarIndex", String(prev));
      // mantém o dialog aberto para tentar de novo
    } finally {
      setSaving(false);
    }
  };

  // ===== RESTO DO STATUS =====
  const somaPopulacao = Object.values(estado.populacao).reduce(
    (acc, valor) => acc + valor,
    0
  );

  // --- HOSPITAL: números para o tooltip ---
  const posto = estado?.construcoes?.postoMedico ?? 0;
  const hosp = estado?.construcoes?.hospitalCentral ?? 0;

  // mesma regra do engine: cada posto = 3, cada hospital = 8
  const capacidadeHospital = posto * 3 + hosp * 8;

  const internadosArr = estado?.hospital?.internados ?? [];
  const internados = internadosArr.length;

  const slotsOcupados = internadosArr.length;

  const filaHospital = estado?.hospital?.fila?.length ?? 0;

  const statusList = [
    { label: "Turno", value: estado.turno, icon: <FaClock /> },
    {
      label: "Integridade",
      value: `${estado.integridadeEstrutural}%`,
      icon: <FaShieldAlt />,
    },
    {
      label: "Água",
      value: `${estado.agua}/${estado.maxAgua}`,
      icon: <FaTint />,
      tooltip: (
        <div
          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
opacity-0 invisible group-hover:opacity-100 group-hover:visible 
transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
border border-gray-700 text-white"
        >
          {(() => {
            const agua = Math.max(0, Number(estado.agua || 0));
            const maxAgua = Math.max(1, Number(estado.maxAgua || 1));
            const pct = Math.min(100, Math.round((agua / maxAgua) * 100));

            return (
              <div className="text-sm space-y-2">
                {/* CSS local no mesmo arquivo */}
                <style>{`
              @keyframes aguaWave {
                from { background-position: 0 0, 0 0; }
                to   { background-position: 200px 0, -200px 0; }
              }
              .agua-fill {
                background: linear-gradient(to top, #0891b2 0%, #06b6d4 60%, #67e8f9 100%);
                transition: width .4s ease;
              }
              .agua-waves {
                background-image:
                  radial-gradient(circle at 25% 120%, rgba(255,255,255,.35) 22%, transparent 23%),
                  radial-gradient(circle at 75% 120%, rgba(255,255,255,.25) 22%, transparent 23%);
                background-size: 60px 40px, 60px 40px;
                background-repeat: repeat-x;
                animation: aguaWave 3s linear infinite;
                opacity: .5;
                mix-blend-mode: screen;
              }
            `}</style>

                <div className="flex items-center justify-between">
                  <span>Reservatório</span>
                  <span>
                    {agua}/{maxAgua} ({pct}%)
                  </span>
                </div>

                <div className="relative h-6 w-full rounded bg-slate-700 overflow-hidden border border-slate-600">
                  <div
                    className="relative h-full agua-fill"
                    style={{ width: `${pct}%` }}
                  >
                    <div className="absolute inset-0 agua-waves" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-100">
                    {pct}%
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },

    {
      label: "População",
      value: somaPopulacao,
      icon: <FaUsers />,
      tooltip: (
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🏠</span>
              <span>Colonos:</span>
            </div>
            <span>{estado.populacao.colonos}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🔍</span>
              <span>Exploradores:</span>
            </div>
            <span>{estado.populacao.exploradores}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">⚔️</span>
              <span>Marines:</span>
            </div>
            <span>{estado.populacao.marines}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🎯</span>
              <span>Snipers:</span>
            </div>
            <span>{estado.populacao.snipers}</span>
          </div>
          <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
            <span>Total:</span>
            <span>{somaPopulacao}</span>
          </div>
        </div>
      ),
    },
    {
      label: "Energia",
      value: estado.energia,
      icon: <FaBolt />,
      tooltip: (
        <div
          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
opacity-0 invisible group-hover:opacity-100 group-hover:visible 
transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
border border-gray-700 text-white"
        >
          {(() => {
            const sol = estado.construcoes?.geradorSolar || 0;
            const geo = estado.construcoes?.reatorGeotermico || 0;

            // Energia por construção
            const energiaSolar = sol * 12; // +12 por gerador
            const energiaGeo = geo * 30; // +30 por reator

            // Sustentabilidade por construção
            const sustSolar = Math.floor(sol / 2); // +1 a cada 2 geradores
            const sustGeo = -geo; // -1 por reator
            const sustTotal = sustSolar + sustGeo;

            return (
              <div className="text-sm space-y-2">
                <div className="font-semibold text-slate-200">Produção</div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">☀️</span>
                    <span>Geradores Solares (x{sol}):</span>
                  </div>
                  <span>+{energiaSolar}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🌋</span>
                    <span>Reatores Geotérmicos (x{geo}):</span>
                  </div>
                  <span>+{energiaGeo}</span>
                </div>

                <div className="border-t border-gray-600 pt-2 mt-1" />

                <div className="font-semibold text-slate-200">
                  Sustentabilidade
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">☀️</span>
                    <span>Solar (+1 a cada 2):</span>
                  </div>
                  <span>+{sustSolar}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🌋</span>
                    <span>Geotérmico (−1 por reator):</span>
                  </div>
                  <span>{sustGeo}</span>
                </div>

                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                  <span>Total/turno:</span>
                  <span
                    className={
                      sustTotal >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {sustTotal >= 0 ? "+" : ""}
                    {sustTotal}
                  </span>
                </div>

                <div className="text-xs text-slate-400 pt-1">
                  Reator: custo de manutenção −2 ⛏️ por reator/turno.
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },
    {
      label: "Comida",
      value: estado.comida,
      icon: <FaDrumstickBite />,
      tooltip: (
        <div
          className="absolute z-20 left-0 mt-2 w-64 p-3 bg-gray-800 rounded-lg shadow-xl 
    opacity-0 invisible group-hover:opacity-100 group-hover:visible 
    transition-all duration-300 transform -translate-y-1 group-hover:translate-y-0
    border border-gray-700 text-white"
        >
          {(() => {
            // --- cálculos para exibir no tooltip ---
            const colonos = estado.populacao?.colonos || 0;
            const exploradores = estado.populacao?.exploradores || 0;
            const marines = estado.populacao?.marines || 0;
            const snipers = estado.populacao?.snipers || 0;

            const consumoColonos = Math.floor((colonos || 0) * 0.5); // 0.5 por colono, arredonda p/ baixo
            const consumoExploradores = exploradores * 2;
            const consumoMarines = marines * 2;
            const consumoSnipers = snipers * 2;

            const consumoTotal =
              consumoColonos +
              consumoExploradores +
              consumoMarines +
              consumoSnipers;

            const fazendas = estado.construcoes?.fazenda || 0;
            const irrigadores = estado.construcoes?.sistemaDeIrrigacao || 0;

            const prodFazendas = fazendas * 5; // +5 por fazenda
            const prodIrrigacao = irrigadores * 15; // +15 por irrigador
            const energiaIrrigacao = irrigadores * 30; // -30 de energia

            return (
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🏭</span>
                    <span>Produção (fazendas):</span>
                  </div>
                  <span>+{prodFazendas}</span>
                </div>

                <div className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center">
                    <span className="w-6 text-center">💧</span>
                    <span>Produção irrigação:</span>
                  </div>
                  <span>+{prodIrrigacao}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <div className="flex items-center">
                    <span className="w-6 text-center">⚡</span>
                    <span>Consumo de energia:</span>
                  </div>
                  <span>-{energiaIrrigacao}</span>
                </div>

                <div className="border-t border-gray-600 pt-2 mt-1" />

                <div className="font-semibold text-slate-200">Consumo</div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🏠</span>
                    <span>Colonos:</span>
                  </div>
                  <span>-{consumoColonos}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🔍</span>
                    <span>Exploradores:</span>
                  </div>
                  <span>-{consumoExploradores}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">⚔️</span>
                    <span>Marines:</span>
                  </div>
                  <span>-{consumoMarines}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-6 text-center">🎯</span>
                    <span>Snipers:</span>
                  </div>
                  <span>-{consumoSnipers}</span>
                </div>

                <div className="border-t border-gray-600 mt-1 pt-1 flex justify-between">
                  <span>Total (consumo):</span>
                  <span>-{consumoTotal}</span>
                </div>
              </div>
            );
          })()}
        </div>
      ),
    },

    { label: "Minerais", value: estado.minerais, icon: <FaHammer /> },
    { label: "Ciência", value: estado.ciencia, icon: <FaFlask /> },
    {
      label: "Saúde",
      value: `${estado.saude}%`,
      icon: <FaRegHeart />,
      tooltip: (
        <div className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🏨</span>
              <span>Capacidade (slots):</span>
            </div>
            <span>
              {slotsOcupados}/{capacidadeHospital}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">🧑‍⚕️</span>
              <span>Internados:</span>
            </div>
            <span>{internados}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="w-6 text-center">⏳</span>
              <span>Fila:</span>
            </div>
            <span>{filaHospital}</span>
          </div>

          {/* Opcional: detalhar prédios que compõem a capacidade */}
          <div className="border-t border-gray-600 mt-1 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Postos Médicos:</span>
              <span>{posto}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Hospitais Centrais:</span>
              <span>{hosp}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      label: "Sustentabilidade",
      value: `${estado.sustentabilidade}%`,
      icon: <FaLeaf />,
    },
  ];

  const [turnoItem, ...restStatus] = statusList;

  return (
    <>
      {/* HEADER com avatar à esquerda + chips à direita */}
      <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-lg shadow-inner">
        <Tooltip title="Alterar avatar">
          <IconButton
            aria-label="Alterar avatar"
            // 👇 evita o warning “Blocked aria-hidden…”: tira o foco do botão antes de abrir
            onClick={(e) => {
              e.currentTarget.blur();
              setAvatarOpen(true);
            }}
            sx={{ p: 0 }}
          >
            <Avatar
              alt="Avatar"
              src={avatarSrc}
              sx={{ width: AVATAR_SIZE, height: AVATAR_SIZE, boxShadow: 2 }}
            />
          </IconButton>
        </Tooltip>

        {/* Direita: demais status, mantendo wrap/estilo atual */}
        <div className="flex flex-wrap gap-3 flex-1 justify-center">
          {statusList.map((item, index) => (
            <div
              key={index}
              className="relative flex items-center gap-1 bg-slate-700 text-white px-3 py-2 rounded-md shadow-sm text-sm hover:bg-slate-600 transition-all group"
            >
              <span className="text-blue-300">{item.icon}</span>
              <span className="font-medium">{item.value}</span>
              <span className="text-gray-400 text-xs">{item.label}</span>
              {item.tooltip && (
                <div
                  className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 w-56 p-3 bg-gray-800 rounded-lg shadow-xl 
                           opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                           transition-all duration-300 translate-y-0 group-hover:translate-y-1
                           border border-gray-700 text-white"
                >
                  {item.tooltip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* DIALOG de seleção de avatar */}
      <Dialog
        open={avatarOpen}
        onClose={(e, reason) => {
          if (saving) return; // evita fechar enquanto salva
          setAvatarOpen(false);
        }}
        fullWidth
        maxWidth="xs"
        disableRestoreFocus // 👈 não retorna foco para o botão ao fechar
      >
        <DialogTitle>Escolha seu Avatar</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} columns={12}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((idx) => {
              const src = `/images/avatar/${idx}.png`;
              const selected = idx === avatarIndex;
              return (
                <Grid key={idx} size={{ xs: 4, sm: 3 }}>
                  <ButtonBase
                    // 👇 primeiro item recebe auto-focus
                    data-autofocus={idx === 1 ? "true" : undefined}
                    onClick={() => handleSelectAvatar(idx)}
                    sx={{
                      borderRadius: "9999px",
                      display: "block",
                      opacity: saving ? 0.6 : 1,
                    }}
                    aria-label={`Selecionar avatar ${idx}`}
                    disabled={saving}
                  >
                    <Avatar
                      alt={`Avatar ${idx}`}
                      src={src}
                      sx={{
                        width: 72,
                        height: 72,
                        border: selected
                          ? "2px solid #38bdf8"
                          : "2px solid transparent",
                        boxShadow: selected ? 3 : 0,
                      }}
                    />
                  </ButtonBase>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StatusPanel;
