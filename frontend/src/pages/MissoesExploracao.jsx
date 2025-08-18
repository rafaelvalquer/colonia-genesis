import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props:
 * - estadoAtual: objeto global (contém exploradores: [])
 * - onEstadoChange: fn(prev => novoEstado) para atualizar no pai
 */
const MissoesExploracao = ({ estadoAtual, onEstadoChange }) => {
  // total de exploradores cadastrados no sistema (independe do status)
  const totalExploradores = estadoAtual?.exploradores?.length ?? 0;

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

  // Reconstroi a lista quando o estado global mudar
  useEffect(() => {
    setAvailable(buildAvailableFromState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoAtual?.exploradores]);

  const missions = useMemo(
    () => [
      {
        id: "templo",
        titulo: "Templo Perdido de Ankhor",
        cor: "bg-yellow-500",
        tagCor: "text-amber-400",
        dificuldade: "★★★★☆",
        diffBg: "bg-yellow-900 text-yellow-300",
        img: "/images/missoes/templo.png",
        descricao:
          "Explore as ruínas ancestrais em busca do artefato sagrado. Cuidado com armadilhas antigas.",
        tags: ["Arqueologia", "Perigo", "Artefatos"],
        turnos: 8, // 🔥 novo campo
        recompensas: [
          { label: "1500 Ouro", cor: "text-yellow-400" },
          { label: "+3 Relíquias", cor: "text-blue-400" },
          { label: "Mapa Secreto", cor: "text-purple-400" },
        ],
      },
      {
        id: "vulcao",
        titulo: "Cristais do Vulcão",
        cor: "bg-red-500",
        tagCor: "text-orange-400",
        dificuldade: "★★★★★",
        diffBg: "bg-red-900 text-red-300",
        img: "/images/missoes/vulcao.png",
        descricao:
          "Colete cristais de energia nas cavernas vulcânicas. Temperaturas extremas exigem preparo.",
        tags: ["Extremo", "Recursos", "Ciência"],
        turnos: 12, // 🔥 novo campo
        recompensas: [
          { label: "3500 Ouro", cor: "text-yellow-400" },
          { label: "Cristais Energéticos", cor: "text-pink-400" },
          { label: "+5 Nível Base", cor: "text-green-400" },
        ],
      },
      {
        id: "floresta",
        titulo: "A Floresta Assombrada",
        cor: "bg-green-500",
        tagCor: "text-green-400",
        dificuldade: "★★★☆☆",
        diffBg: "bg-green-900 text-green-300",
        img: "/images/missoes/floresta.png",
        descricao:
          "Investigue fenômenos misteriosos na floresta proibida. Encontre a fonte dos eventos.",
        tags: ["Mistério", "Investigação", "Sobrenatural"],
        turnos: 6, // 🔥 novo campo
        recompensas: [
          { label: "1200 Ouro", cor: "text-yellow-400" },
          { label: "Amuleto Protetor", cor: "text-purple-400" },
          { label: "Novas Habilidades", cor: "text-blue-400" },
        ],
      },
    ],
    []
  );


  const [assignments, setAssignments] = useState({
    templo: [],
    vulcao: [],
    floresta: [],
  });

  const assignedTotal =
    assignments.templo.length +
    assignments.vulcao.length +
    assignments.floresta.length;

  // UI/Modal
  const [overMission, setOverMission] = useState(null); // id da missão com dragover
  const [pending, setPending] = useState(null); // { explorerId, missionId }
  const [showModal, setShowModal] = useState(false);

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
    e.preventDefault();
    setOverMission(missionId);
  };

  const handleDrop = (e, missionId) => {
    e.preventDefault();
    const explorerId = e.dataTransfer.getData("text/plain");
    if (!explorerId) return;
    setOverMission(null);
    setPending({ explorerId, missionId });
    setShowModal(true);
  };

  // dentro de MissoesExploracao.jsx (no confirmAssign)
  const confirmAssign = async () => {
    if (!pending) return;
    const { explorerId, missionId } = pending;

    const idx = available.findIndex((x) => x.id === explorerId);
    if (idx === -1) {
      setPending(null);
      setShowModal(false);
      return;
    }

    const explorer = available[idx];
    const miss = missions.find((x) => x.id === missionId);

    // Remove da lista local disponível…
    setAvailable((prev) => prev.filter((x) => x.id !== explorerId));
    // …e adiciona na missão escolhida
    setAssignments((prev) => ({
      ...prev,
      [missionId]: [...prev[missionId], explorer],
    }));

    // Atualiza o estado global + FILA DE MISSÕES (em turnos)
    onEstadoChange?.((prev) => {
      const novosExploradores = (prev.exploradores || []).map((ex) =>
        ex.id === explorer.id
          ? {
            ...ex,
            status: "emMissao",
            missionId: missionId,
            updatedAt: Date.now(),
          }
          : ex
      );

      const novaFilaMissoes = [
        ...(prev.filaMissoes || []),
        {
          id: `miss_${Date.now()}`,     // id único da missão na fila
          explorerId: explorer.id,      // quem está na missão
          nome: explorer.nome,          // nome do explorador
          missionId,                    // id da missão base (templo, vulcao…)
          titulo: miss?.titulo || missionId,
          turnosTotais: miss?.turnos ?? 1,
          tempoRestante: miss?.turnos ?? 1,  // 🔴 importante: em turnos!
          status: "emAndamento",
        },
      ];

      return {
        ...prev,
        exploradores: novosExploradores,
        populacao: {
          ...prev.populacao,
          // se "exploradores" representa livres, decrementa:
          exploradores: Math.max(0, (prev.populacao?.exploradores ?? 0) - 1),
        },
        filaMissoes: novaFilaMissoes,
      };
    });

    setPending(null);
    setShowModal(false);
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
      <div className="mb-6 text-center">
        <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 to-orange-600">
          Comando de Missões — Exploração
        </h3>
        <p className="text-sm text-slate-500">
          Aloque exploradores para missões estratégicas e colete recompensas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Exploradores disponíveis */}
        <div className="bg-slate-100 rounded-xl p-5 shadow-inner">
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
                  {/* Apenas Nível (sem perícia) */}
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

          {missions.map((m) => (
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
                    <h5 className="text-xl font-bold text-slate-900">{m.titulo}</h5>

                    <div className="flex gap-2">
                      <span className={`${m.diffBg} text-xs px-2 py-1 rounded-full`}>
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
                      className={`drop-zone rounded-lg p-4 border border-dashed transition
                        ${overMission === m.id
                          ? "bg-green-50 border-green-300"
                          : "bg-slate-100 border-slate-300"
                        }`}
                    >
                      {assignments[m.id].length === 0 ? (
                        <p className="text-slate-500 text-sm">
                          Arraste exploradores até aqui
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {assignments[m.id].map((exp) => (
                            <div
                              key={exp.id}
                              className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2"
                            >
                              <img
                                src={exp.avatar}
                                alt={exp.nome}
                                className="w-8 h-8 rounded-full border-2 border-blue-500 object-cover"
                              />
                              <div>
                                <div className="text-xs font-medium text-slate-800">
                                  {exp.nome}
                                </div>
                                {/* Apenas Nível */}
                                <div className="text-[10px] text-slate-500">
                                  Nível {exp.nivel}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                  className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 transition text-white"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MissoesExploracao;
