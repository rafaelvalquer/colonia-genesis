// src/hooks/useMainTour.js
import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export default function useMainTour() {
  const run = useCallback(() => {
    // helper: troca de aba quando necessário
    const ensure = (fn) =>
      new Promise((r) =>
        setTimeout(() => {
          fn?.();
          r();
        }, 0)
      );

    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.6,
      nextBtnText: "Próximo",
      prevBtnText: "Voltar",
      doneBtnText: "Começar!",
      showButtons: ["next", "previous", "close"],
      steps: [
        {
          element: '[data-tour="status"]',
          popover: {
            title: "Painel de Status",
            description:
              "Acompanhe turno, integridade, água, população, energia, comida, minerais, ciência e saúde. Passe o mouse para ver detalhes.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="central-comandos"]',
          popover: {
            title: "Central de Comando",
            description: "Visão rápida e consolidada dos seus recursos.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: '[data-tour="aba-parametros"]',
          popover: {
            title: "Parâmetros do turno",
            description:
              "Ajuste skill points, consumo de água e a alocação de colonos antes de passar o turno.",
            side: "right",
          },
          // garante que a aba Parâmetros esteja aberta
          onHighlightStarted: () =>
            ensure(() =>
              document.querySelector('[data-tab="parametros"]')?.click()
            ),
        },
        {
          element: '[data-tour="skill"]',
          popover: {
            title: "Skill Points",
            description:
              "Ative até 3 áreas para impulsionar a produção neste turno.",
            side: "top",
          },
        },
        {
          element: '[data-tour="agua"]',
          popover: {
            title: "Consumo de água",
            description:
              "Escolha entre Reduzido (50%), Normal (100%) ou Exagerado (150%). Afeta a produção e o custo do turno.",
            side: "top",
          },
          onHighlightStarted: () =>
            ensure(() => document.querySelector('[data-tour="agua"]')?.click()),
        },
        {
          element: '[data-tour="alocacao"]',
          popover: {
            title: "Alocação de colonos",
            description:
              "Distribua 100% dos colonos entre os setores. A prévia estima a produção resultante.",
            side: "top",
          },
          onHighlightStarted: () =>
            ensure(() =>
              document.querySelector('[data-tour="alocacao"]')?.click()
            ),
        },
        {
          element: '[data-tour="apply"]',
          popover: {
            title: "Aplicar Parâmetros",
            description:
              "Executa a simulação e abre o resumo do turno. Se faltar água, você será avisado.",
            side: "top",
          },
        },
        {
          element: '[data-tour="aba-construcoes"]',
          popover: {
            title: "Construções",
            description:
              "Gerencie prédios: veja custos, efeitos e inicie novas obras.",
            side: "right",
          },
          onHighlightStarted: () =>
            ensure(() =>
              document.querySelector('[data-tab="construcoes"]')?.click()
            ),
        },
        {
          element: '[data-tour="fila"]',
          popover: {
            title: "Fila de construção",
            description:
              "Veja o progresso e o tempo restante das obras em andamento.",
            side: "left",
          },
          onHighlightStarted: () =>
            ensure(() => {
              // garante que está na tela de Construções
              document.querySelector('[data-tab="construcoes"]')?.click();
              // abre o Drawer se ainda não estiver aberto
              if (!document.querySelector('[data-tour="fila"]')) {
                document.querySelector('[data-tour="btn-fila"]')?.click();
              }
            }),
        },
      ],
    });

    d.drive();
  }, []);

  return { run };
}
