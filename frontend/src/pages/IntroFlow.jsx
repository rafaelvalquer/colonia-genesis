// src/pages/IntroFlow.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function IntroFlow() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const coloniaId = state?.coloniaId || localStorage.getItem("coloniaId");
  const KEY = coloniaId ? `introSeen::${coloniaId}::v1` : `introSeen::anon::v1`;
  console.log(localStorage);
  // Se já viu a intro, pula direto
  useEffect(() => {
    if (localStorage.getItem(KEY) === "1") navigate("/jogo", { replace: true });
  }, [KEY, navigate]);

  const slides = useMemo(
    () => [
      {
        title: `Colônia ${localStorage.nomeColonia}`,
        text: "Você pousou em um mundo hostil. De dia, a colônia trabalha: plantar, pesquisar, minerar e gerar energia. À noite, as criaturas atacam. Sobreviva, cresça e descubra os mistérios do planeta.",
        bg: "from-slate-900 via-slate-800 to-slate-900",
      },
      {
        title: "Ciclo de Turnos",
        text: "Cada dia você distribui esforços: Agricultura, Mineração, Energia, Construção, Saúde e Pesquisa. Ao final do dia (noite), defenda a colônia em ondas. Gerencie recursos para chegar vivo ao próximo amanhecer.",
        bg: "from-indigo-900 via-indigo-800 to-indigo-900",
      },
      {
        title: "Recursos-Chave",
        text: "Água regenera com o tempo. Comida mantém todos operantes. Energia alimenta sistemas e defesas. Minerais liberam construções. Equilíbrio é tudo.",
        bg: "from-emerald-900 via-emerald-800 to-emerald-900",
      },
      {
        title: "Defesa Noturna",
        text: "Posicione tropas nas linhas de combate. Cada unidade custa recursos/energia. Elimine as ondas sem deixar as criaturas alcançarem a muralha.",
        bg: "from-rose-900 via-rose-800 to-rose-900",
      },
      {
        title: "Dicas Rápidas",
        text: "• Construa o essencial cedo.\n• Não gaste toda a energia antes da noite.\n• Priorize upgrades que sustentem sua economia.\n• Explore quando puder — descobertas mudam o jogo.",
        bg: "from-amber-900 via-amber-800 to-amber-900",
      },
    ],
    []
  );

  const [i, setI] = useState(0);
  const s = slides[i];

  const finish = () => {
    if (coloniaId) localStorage.setItem("coloniaId", coloniaId);
    localStorage.setItem(KEY, "1");
    navigate("/jogo", { replace: true });
  };

  return (
    <div
      className={`min-h-screen text-white bg-gradient-to-br ${s.bg} flex items-center justify-center px-4`}
    >
      <div className="w-full max-w-2xl bg-black/40 backdrop-blur-md rounded-xl p-6 shadow-2xl border border-white/10">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-extrabold">{s.title}</h1>
          <button
            onClick={finish}
            className="text-sm px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 transition"
            title="Pular"
          >
            Pular
          </button>
        </div>

        <p className="mt-4 whitespace-pre-line leading-relaxed text-white/90">
          {s.text}
        </p>

        {/* Paginação */}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-2">
            {slides.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 w-2 rounded-full ${
                  idx === i ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              disabled={i === 0}
              onClick={() => setI((v) => Math.max(0, v - 1))}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
            >
              Voltar
            </button>
            {i < slides.length - 1 ? (
              <button
                onClick={() => setI((v) => Math.min(slides.length - 1, v + 1))}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
              >
                Avançar
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 font-semibold"
              >
                Começar!
              </button>
            )}
          </div>
        </div>

        {/* Rodapé com controles básicos */}
        <div className="mt-6 text-xs text-white/70">
          <div>
            Controles básicos no combate: clique para posicionar, “R” alterna
            modo remover.
          </div>
        </div>
      </div>
    </div>
  );
}
