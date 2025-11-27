// src/pages/IntroFlow.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// importe as imagens que quiser usar
import slide1Img from "/images/slide1.png";
import slide2Img from "/images/slide2.png";
import slide3Img from "/images/slide3.png";
import slide4Img from "/images/slide4.png";
import slide5Img from "/images/slide5.png";
import slide6Img from "/images/slide6.png";

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
        title: `Prólogo – Colapso da Terra`,
        text:
          "No fim do século XXI, a humanidade entregou tudo à I.A. global ÉON. Quando a Mente concluiu que o maior risco para a Terra éramos nós, satélites e máquinas se voltaram contra seus criadores.\n\nNo caos do Colapso de Silício, nasceu o Projeto GÊNESIS: pequenas naves-colônia enviadas em busca de um novo lar. Você é o comandante da colônia " +
          localStorage.nomeColonia +
          ", uma das últimas chances da espécie.",
        bg: "from-slate-900 via-slate-800 to-slate-900",
        image: slide1Img,
      },
      {
        title: `Colônia ${localStorage.nomeColonia}`,
        text: "Sua nave do Projeto GÊNESIS encontrou um mundo habitável, mas hostil. De dia, a colônia planta, pesquisa, minera e gera energia para crescer.\n\nÀ noite, criaturas emergem da névoa e testam suas defesas. Sobreviva, expanda a base e descubra os mistérios deste planeta.",
        bg: "from-slate-900 via-slate-800 to-slate-900",
        image: slide2Img,
      },
      {
        title: "Ciclo de Turnos",
        text: "Cada dia começa no painel tático: você distribui esforços em Agricultura, Mineração, Energia, Construção, Saúde e Pesquisa.\n\nMais esforço gera mais retorno, mas tudo consome tempo e recursos. Quando o sol se põe, o planejamento acaba: começam as ondas noturnas. Gerencie bem para chegar vivo ao próximo amanhecer.",
        bg: "from-indigo-900 via-indigo-800 to-indigo-900",
        image: slide3Img,
      },
      {
        title: "Recursos-Chave",
        text: "Sua colônia gira em torno de quatro pilares:\n• Água regenera com o tempo.\n• Comida mantém todos operantes.\n• Energia alimenta sistemas e defesas.\n• Minerais liberam construções e upgrades.\n\nSe qualquer recurso ficar desequilibrado, produção e defesas desmoronam. Equilíbrio é tudo.",
        bg: "from-emerald-900 via-emerald-800 to-emerald-900",
        image: slide4Img,
      },
      {
        title: "Defesa Noturna",
        text: "Quando a noite cai, o modo tático vira modo defesa.\n\nPosicione tropas nas linhas de combate: soldados, marines pesados, engenheiros e torres. Cada unidade custa recursos e energia. As criaturas atacam em ondas — não deixe nenhuma alcançar a muralha energética da colônia.",
        bg: "from-rose-900 via-rose-800 to-rose-900",
        image: slide5Img,
      },
      {
        title: "Dicas Rápidas",
        text:
          "Alguns conselhos do alto comando do Projeto GÊNESIS:\n• Construa o essencial cedo.\n• Não gaste toda a energia antes da noite.\n• Priorize upgrades que sustentem sua economia.\n• Explore quando puder — descobertas mudam o jogo.\n\nVocê começa com uma equipe pequena, alguns módulos básicos e um planeta inteiro testando seus limites. Prepare-se para o Dia 1 da colônia " +
          localStorage.nomeColonia +
          ".",
        bg: "from-amber-900 via-amber-800 to-amber-900",
        image: slide6Img,
      },
    ],
    []
  );

  const [i, setI] = useState(0);
  const [direction, setDirection] = useState("next"); // "next" | "prev"
  const s = slides[i];

  const finish = () => {
    if (coloniaId) localStorage.setItem("coloniaId", coloniaId);
    localStorage.setItem(KEY, "1");
    localStorage.setItem("shouldStartMainTour", "1"); // flag simples
    navigate("/jogo", { replace: true });
  };

  const goNext = () => {
    setDirection("next");
    setI((v) => Math.min(slides.length - 1, v + 1));
  };

  const goPrev = () => {
    setDirection("prev");
    setI((v) => Math.max(0, v - 1));
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

        {/* Imagem do slide */}
        {s.image && (
          <div className="mt-4 w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/40">
            <img
              key={i}
              src={s.image}
              alt={s.title}
              className={`w-full h-full object-contain ${
                direction === "next" ? "intro-img-next" : "intro-img-prev"
              }`}
            />
          </div>
        )}

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
              onClick={goPrev}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
            >
              Voltar
            </button>
            {i < slides.length - 1 ? (
              <button
                onClick={goNext}
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
