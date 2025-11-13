import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Drawer,
  IconButton,
  Badge,
  LinearProgress,
  Typography,
  Box,
} from "@mui/material";
import ListIcon from "@mui/icons-material/List";
import CloseIcon from "@mui/icons-material/Close";
import coloniaService from "../services/coloniaService";
import missions from "../data/missions.json";
import { useNavigate } from "react-router-dom";

/**
 * Props:
 * - estadoAtual: objeto global (contém exploradores: [] e filaMissoes: [])
 * - onEstadoChange: fn(prev => novoEstado) para atualizar no pai
 */
const MissoesExploracao = ({ estadoAtual, onEstadoChange }) => {
  // total de exploradores cadastrados no sistema (independe do status)
  const totalExploradores = estadoAtual?.exploradores?.length ?? 0;
  const navigate = useNavigate();

  // Fila de missões do estado global
  const filaMissoes = estadoAtual?.filaMissoes ?? [];

  console.log(estadoAtual.filaMissoes);
  console.log(estadoAtual.exploradores);

  // Constrói a lista de disponíveis (status === "disponivel")
  const buildAvailableFromState = () => {
    const lista = estadoAtual?.exploradores || [];
    return lista
      .filter((exp) => exp?.status === "disponivel")
      .map((exp) => ({
        id: exp.id || String(Math.random()),
        nome: exp.nickname || exp.name || "Explorador",
        nivel: exp.level ?? 1,
        avatar: exp.portrait || "/images/exploradores/default.png",
      }));
  };

  const [available, setAvailable] = useState(buildAvailableFromState);
  const [saving, setSaving] = useState(false); // opcional: trava UI enquanto salva

  // Reconstroi a lista quando o estado global mudar
  useEffect(() => {
    setAvailable(buildAvailableFromState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoAtual?.exploradores]);

  // Mapa: id da missão base -> definição
  const missionById = useMemo(() => {
    const map = {};
    missions.forEach((m) => (map[m.id] = m));
    return map;
  }, [missions]);

  // Mapa: missão base -> item ativo na fila (se houver)
  // Considera itens com tempoRestante > 0 como "ocupando" a missão
  const activeMissionItemById = useMemo(() => {
    const map = {};
    for (const item of filaMissoes) {
      const rest = Number.isFinite(item?.tempoRestante)
        ? item.tempoRestante
        : 0;
      if (rest > 0 && !map[item.id]) {
        map[item.id] = item; // 1 por missão
      }
    }
    return map;
  }, [filaMissoes]);

  // util pra pegar dados do explorador alocado (para mostrar na card)
  const explorerById = useMemo(() => {
    const map = {};
    (estadoAtual?.exploradores || []).forEach((e) => (map[e.id] = e));
    return map;
  }, [estadoAtual?.exploradores]);

  // UI/Modal
  const [overMission, setOverMission] = useState(null); // id da missão com dragover
  const [pending, setPending] = useState(null); // { explorerId, missionId }
  const [showModal, setShowModal] = useState(false);

  // Drawer da fila de missões
  const [drawerAberto, setDrawerAberto] = useState(false);

  // Drag & Drop handlers
  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      const el = e.target.closest(".explorer-item");
      if (el) el.classList.add("opacity-0");
    }, 0);
  };

  const handleDragEnd = (e) => {
    const el = e.target.closest(".explorer-item");
    if (el) el.classList.remove("opacity-0");
  };

  const allowDrop = (e, missionId) => {
    // Só permite o drop se a missão NÃO estiver ocupada
    const ocupada = !!activeMissionItemById[missionId];
    if (!ocupada) {
      e.preventDefault(); // habilita drop
      setOverMission(missionId);
    } else {
      setOverMission(null);
    }
  };

  const handleDrop = (e, missionId) => {
    e.preventDefault();
    // Double-check: se já está ocupada, ignora
    if (activeMissionItemById[missionId]) return;

    const explorerId = e.dataTransfer.getData("text/plain");
    if (!explorerId) return;
    setOverMission(null);
    setPending({ explorerId, missionId });
    setShowModal(true);
  };

  // Confirmar alocação
  const confirmAssign = async () => {
    if (!pending) return;
    const { explorerId, missionId } = pending;

    // Bloqueia se a missão ficou ocupada nesse meio tempo
    if (activeMissionItemById[missionId]) {
      setPending(null);
      setShowModal(false);
      return;
    }

    const idx = available.findIndex((x) => x.id === explorerId);
    if (idx === -1) {
      setPending(null);
      setShowModal(false);
      return;
    }

    const explorer = available[idx];
    const miss = missions.find((x) => x.id === missionId);

    // Otimista: tira o explorador da lista local já
    setAvailable((prev) => prev.filter((x) => x.id !== explorerId));

    // Monta nextState a partir do estadoAtual (props)
    const now = Date.now();
    const novosExploradores = (estadoAtual.exploradores || []).map((ex) =>
      ex.id === explorer.id
        ? { ...ex, status: "emMissao", missionId, updatedAt: now }
        : ex
    );

    const novoItemFila = {
      id: missionId, // id da missão base
      nome: miss?.titulo || missionId,
      tempoRestante: Number(miss?.turnos ?? 1),
      turnosTotais: Number(miss?.turnos ?? 1),
      explorerId: explorer.id, // vínculo com explorador
      explorerNome: explorer.nome,
      status: "emAndamento",
      // 👇 leve as recompensas cruas do JSON p/ a fila
      recompensasRaw: Array.isArray(miss?.recompensas) ? miss.recompensas : [],
    };

    const nextState = {
      ...estadoAtual,
      exploradores: novosExploradores,
      populacao: {
        ...estadoAtual.populacao,
        exploradores: Math.max(
          0,
          (estadoAtual.populacao?.exploradores ?? 0) - 1
        ),
      },
      filaMissoes: [...(estadoAtual.filaMissoes || []), novoItemFila],
    };

    // Reflete na UI imediatamente
    onEstadoChange?.(nextState);

    // Persiste no backend
    try {
      setSaving(true);
      await coloniaService.atualizarColonia(estadoAtual._id, nextState);
    } catch (err) {
      console.error("Falha ao salvar no backend:", err);
      // Rollback: volta UI ao estado anterior
      onEstadoChange?.(estadoAtual);
      // recoloca o explorador no disponível local
      setAvailable((prev) => [...prev, explorer]);
      // opcional: alerta/snackbar
      alert("Não foi possível enviar a missão. Tente novamente.");
    } finally {
      setSaving(false);
      setPending(null);
      setShowModal(false);
    }
  };

  return (
    <motion.div
      key="missoes-exploracao"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-lg p-6 text-slate-800"
    >
      {/* Header */}
      <div className="mb-6 text-center relative">
        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-600">
          Comando de Missões — Exploração
        </h3>
        <p className="text-sm text-slate-500">
          Aloque exploradores para missões estratégicas e colete recompensas.
        </p>

        {/* Botão Drawer (canto superior direito) */}
        <div className="absolute right-0 top-0">
          <Badge badgeContent={filaMissoes.length} color="error" showZero>
            <IconButton
              size="small"
              onClick={() => setDrawerAberto(true)}
              sx={{ color: "#334155", bgcolor: "rgba(148,163,184,.15)" }}
            >
              <ListIcon fontSize="small" />
            </IconButton>
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Exploradores disponíveis */}
        <div
          className="bg-slate-100 rounded-xl p-5 shadow-inner"
          style={{
            position: "sticky",
            top: 12,
            maxHeight: "calc(100vh - 24px)",
            overflow: "auto",
          }}
        >
          <h4 className="text-lg font-semibold mb-4 flex items-center">
            <span className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            Exploradores Disponíveis
            <span className="ml-auto bg-slate-200 text-green-600 text-xs px-3 py-1 rounded-full">
              {available.length}/{totalExploradores}
            </span>
          </h4>

          <div id="available-explorers" className="space-y-3">
            {available.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum explorador disponível.
              </p>
            )}
            {available.map((exp) => (
              <div
                key={exp.id}
                className="explorer-item bg-white border border-slate-200 p-3 rounded-lg flex items-center draggable transition-transform"
                draggable
                onDragStart={(e) => handleDragStart(e, exp.id)}
                onDragEnd={handleDragEnd}
              >
                <img
                  src={exp.avatar}
                  alt={exp.nome}
                  className="w-12 h-12 rounded-full mr-4 border-2 border-green-500 object-cover"
                  onError={(ev) => {
                    ev.currentTarget.src =
                      "data:image/svg+xml;utf8," +
                      encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='100%' height='100%' fill='#e2e8f0'/><text x='50%' y='54%' text-anchor='middle' font-size='12' fill='#475569'>Explorador</text></svg>`
                      );
                  }}
                />
                <div>
                  <h5 className="font-medium text-slate-800">{exp.nome}</h5>
                  <p className="text-xs text-slate-500">Nível {exp.nivel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Missões */}
        <div className="lg:col-span-2 space-y-6">
          <h4 className="text-lg font-semibold mb-2 flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            Missões Disponíveis
            <span className="ml-auto bg-slate-100 text-blue-600 text-xs px-3 py-1 rounded-full">
              {missions.length} missões
            </span>
          </h4>

          {missions.map((m) => {
            const ativo = activeMissionItemById[m.id]; // item da fila ocupando a missão (ou undefined)
            const ocupado = !!ativo;
            const expAlocado = ativo ? explorerById[ativo.explorerId] : null;

            return (
              <div
                key={m.id}
                className="mission-card bg-slate-50 rounded-xl p-5 shadow relative overflow-hidden border border-slate-200"
              >
                <div className={`absolute top-0 left-0 w-2 h-full ${m.cor}`} />
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <img
                      src={m.img}
                      alt={m.titulo}
                      className="w-full md:w-48 h-32 object-cover rounded-lg shadow"
                      onError={(ev) => {
                        ev.currentTarget.src =
                          "data:image/svg+xml;utf8," +
                          encodeURIComponent(
                            `<svg xmlns='http://www.w3.org/2000/svg' width='256' height='128'><rect width='100%' height='100%' fill='#e2e8f0'/><text x='50%' y='54%' text-anchor='middle' font-size='12' fill='#475569'>Imagem da missão</text></svg>`
                          );
                      }}
                    />
                  </div>

                  <div className="flex-grow">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="text-xl font-bold text-slate-900">
                        {m.titulo}
                      </h5>

                      <div className="flex gap-2">
                        <span
                          className={`${m.diffBg} text-xs px-2 py-1 rounded-full`}
                        >
                          Dificuldade: {m.dificuldade}
                        </span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {m.turnos} turnos
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-600 mb-3">{m.descricao}</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {m.tags.map((t) => (
                        <span
                          key={t}
                          className={`bg-slate-100 ${m.tagCor} text-xs px-2 py-1 rounded`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="md:flex items-center justify-between gap-3">
                      <div className="mb-3 md:mb-0">
                        <p className="text-xs text-slate-500">Recompensas:</p>
                        <div className="flex items-center flex-wrap gap-3">
                          {m.recompensas.map((r) => (
                            <span key={r.label} className={r.cor}>
                              {r.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Drop Zone */}
                      <div
                        onDragOver={(e) => allowDrop(e, m.id)}
                        onDragEnter={() => setOverMission(m.id)}
                        onDragLeave={() => setOverMission(null)}
                        onDrop={(e) => handleDrop(e, m.id)}
                        className={`drop-zone rounded-lg p-4 border border-dashed transition ${
                          overMission === m.id && !ocupado
                            ? "bg-green-50 border-green-300"
                            : "bg-slate-100 border-slate-300"
                        }`}
                        title={
                          ocupado
                            ? "Missão já em andamento"
                            : "Arraste exploradores até aqui"
                        }
                        style={{ opacity: ocupado ? 0.6 : 1 }}
                      >
                        {!ocupado ? (
                          <p className="text-slate-500 text-sm">
                            Arraste exploradores até aqui
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
                              <img
                                src={
                                  expAlocado?.portrait ||
                                  "/images/exploradores/default.png"
                                }
                                alt={
                                  expAlocado?.nickname ||
                                  expAlocado?.name ||
                                  "Explorador"
                                }
                                className="w-8 h-8 rounded-full border-2 border-blue-500 object-cover"
                              />
                              <div>
                                <div className="text-xs font-medium text-slate-800">
                                  {expAlocado?.nickname ||
                                    expAlocado?.name ||
                                    "Explorador"}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Nível {expAlocado?.level ?? 1}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de confirmação */}
      <AnimatePresence>
        {showModal && pending && (
          <motion.div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 max-w-md w-full mx-4 text-slate-800"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              {(() => {
                const exp = available.find((x) => x.id === pending.explorerId);
                const m = missions.find((x) => x.id === pending.missionId);
                return (
                  <>
                    <h3 className="text-xl font-bold mb-2">Confirmar Missão</h3>
                    <p className="mb-6 text-slate-600">
                      Deseja alocar <strong>{exp?.nome}</strong> na missão{" "}
                      <strong>"{m?.titulo}"</strong>?
                    </p>
                  </>
                );
              })()}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setPending(null);
                  }}
                  className="px-4 py-2 bg-slate-200 rounded-lg hover:bg-slate-300 transition text-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAssign}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 transition text-white disabled:opacity-60"
                >
                  {saving ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawer - Fila de Missões */}
      <Drawer
        anchor="right"
        open={drawerAberto}
        onClose={() => setDrawerAberto(false)}
      >
        <div className="w-80 p-4 bg-white h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-800">
              Fila de Missões
            </h2>
            <IconButton onClick={() => setDrawerAberto(false)}>
              <CloseIcon />
            </IconButton>
          </div>

          {filaMissoes.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhuma missão em andamento.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filaMissoes.map((item, index) => {
                const tempoTotal =
                  item.turnosTotais ??
                  missionById[item.id]?.turnos ??
                  item.tempoRestante ??
                  1;

                const progresso = Math.max(
                  0,
                  Math.min(
                    100,
                    ((tempoTotal - item.tempoRestante) / tempoTotal) * 100
                  )
                );
                return (
                  <li
                    key={`${item.id}-${index}`}
                    className="border p-3 rounded shadow bg-white"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <p className="font-semibold text-gray-800">
                          {item.titulo || item.nome}
                        </p>
                        <p className="text-sm text-gray-600">
                          ⏱️ {item.tempoRestante} turno(s)
                        </p>
                      </div>
                      {/* 👇 Nome do explorador em missão */}
                      <p className="text-xs text-slate-500">
                        👨‍🚀 Explorador:{" "}
                        <span className="font-medium text-slate-700">
                          {item.explorerNome}
                        </span>
                      </p>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Box sx={{ flexGrow: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progresso}
                          />
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary", minWidth: 30 }}
                        >
                          {`${Math.round(progresso)}%`}
                        </Typography>
                      </Box>
                      + {/* ...dentro do <li> da fila... */}
                      <p className="text-xs text-slate-500">
                        Status:{" "}
                        <strong>
                          {item.status ??
                            (item.tempoRestante > 0 ? "emAndamento" : "pronta")}
                        </strong>
                      </p>
                      {(item.status === "aguardandoInicio" ||
                        item.readyToStart) && (
                        <div className="mt-2 flex justify-end">
                          <button
                            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 text-sm"
                            onClick={() => {
                              const explorer =
                                explorerById[item.explorerId] || null;
                              const missionDef = missionById[item.id] || null;

                              navigate("/explorador", {
                                state: {
                                  missionId: item.id,
                                  explorerId: item.explorerId,
                                  explorer, // 👈 objeto completo do explorador
                                  mission: missionDef, // opcional: definição da missão (JSON)
                                  filaItem: item, // opcional: o item da fila
                                  estadoAtual, // estado global
                                },
                              });
                            }}
                          >
                            Iniciar missão
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Drawer>
    </motion.div>
  );
};

export default MissoesExploracao;
