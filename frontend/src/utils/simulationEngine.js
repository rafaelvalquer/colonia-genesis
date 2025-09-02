//simulationEngine.js

export function runSimulationTurn(
  currentState,
  parametros,
  scenario,
  filaConstrucoes = [],
  buildings
) {
  const log = [];

  let {
    _id,
    nome,
    populacao,
    energia,
    agua,
    maxAgua,
    comida,
    minerais,
    saude,
    sustentabilidade,
    integridadeEstrutural,
    ciencia,
    turno,
    construcoes,
    pesquisa,
  } = currentState;

  // 👇 baseline para calcular deltas no fim
  const baseline = {
    comida,
    energia,
    minerais,
    ciencia,
    agua,
    saude,
    sustentabilidade,
    integridadeEstrutural,
    colonos: populacao.colonos,
  };

  const { distribuicao, agua: consumoAgua, alocacaoColonos } = parametros;

  const quantidadePorSetor = Object.fromEntries(
    Object.entries(alocacaoColonos).map(([setor, porcentagem]) => [
      setor,
      Math.ceil((porcentagem / 100) * populacao.colonos),
    ])
  );

  // ====== HOSPITAL: helpers ======
  function calcHospitalCapacity(construcoes) {
    const { postoMedico = 0, hospitalCentral = 0 } = construcoes || {};
    // ajuste os pesos como preferir
    return postoMedico * 3 + hospitalCentral * 8;
  }

  // turnos por severidade: leve = 1, grave = 3
  function turnosPorSeveridade(severidade) {
    return severidade === "grave" ? 3 : 1;
  }

  function makePaciente({
    id,
    tipo,
    refId = null,
    severidade = "leve",
    origem = "gerado",
  }) {
    return {
      id, // ex: `pac_${Date.now()}`
      tipo, // "colono" | "explorador"
      refId, // se explorador, id do explorador
      severidade, // "leve" | "grave"
      entrouEm: Date.now(),
      turnosRestantes: turnosPorSeveridade(severidade),
      origem,
      status: "fila", // "fila" | "internado" | "alta" | "obito"
    };
  }

  /** Processa 1 turno de tratamento: decrementa 1 para QUEM JÁ ESTAVA internado */
  function tickHospital(hospital) {
    const internados = [];
    const altas = [];
    const obitos = [];

    for (const p of hospital.internados || []) {
      const next = {
        ...p,
        turnosRestantes: Math.max(0, p.turnosRestantes - 1),
      };
      if (next.turnosRestantes <= 0) {
        // chance de óbito opcional (mantenha 0 se não quiser)
        const chanceObito = next.severidade === "grave" ? 0.05 : 0.0;
        if (Math.random() < chanceObito) {
          next.status = "obito";
          obitos.push(next);
        } else {
          next.status = "alta";
          altas.push(next);
        }
      } else {
        internados.push(next);
      }
    }

    return { internados, altas, obitos };
  }

  /** Admite da FILA para INTERNADOS respeitando a capacidade; TODO paciente ocupa 1 slot */
  function admitFromQueue(hospital, capacidade) {
    const internados = [...(hospital.internados || [])];
    const fila = [...(hospital.fila || [])];

    let free = Math.max(0, capacidade - internados.length);

    const admitted = [];
    const keptQueue = [];

    for (const p of fila) {
      const cost = 1; // leve e grave ocupam 1 slot
      if (free >= cost) {
        p.status = "internado";
        // quando entra, (re)inicializa a duração completa do tratamento
        p.turnosRestantes = turnosPorSeveridade(p.severidade);
        admitted.push(p);
        free -= cost;
      } else {
        keptQueue.push(p);
      }
    }

    return {
      internados: internados.concat(admitted),
      fila: keptQueue,
      admittedCount: admitted.length,
    };
  }

  // ====== HOSPITAL: integração no turno ======
  const hospital = JSON.parse(
    JSON.stringify(
      currentState.hospital || { fila: [], internados: [], historicoAltas: [] }
    )
  );

  // (1) Primeiro: trata quem JÁ estava internado (pode gerar altas/óbito neste turno)
  const { internados: internadosTick, altas, obitos } = tickHospital(hospital);
  hospital.internados = internadosTick;
  hospital.historicoAltas = [
    ...(hospital.historicoAltas || []),
    ...altas,
    ...obitos,
  ];

  // (2) Agora: gera NOVOS pacientes do turno e coloca NA FILA
  const maxNovos = Math.floor((populacao.colonos || 0) * 0.1);
  const severidadeBias = saude < 40 ? 0.5 : 0.25; // mais graves quando saúde baixa
  const quantidadeNovos = Math.max(
    0,
    Math.floor((maxNovos * Math.max(0, 100 - saude)) / 100)
  );

  for (let i = 0; i < quantidadeNovos; i++) {
    const grave = Math.random() < severidadeBias;
    hospital.fila.push(
      makePaciente({
        id: `pac_${turno}_${Date.now()}_${i}`,
        tipo: "colono",
        severidade: grave ? "grave" : "leve",
        origem: "saude_baixa",
      })
    );
  }

  // (3) Em seguida: ADMITIR da fila, respeitando a capacidade
  const capacidade = calcHospitalCapacity(construcoes);
  const {
    internados: internadosAposAdmissao,
    fila: filaAposAdmissao,
    admittedCount,
  } = admitFromQueue(hospital, capacidade);

  hospital.internados = internadosAposAdmissao;
  hospital.fila = filaAposAdmissao;

  // (4) Dados para UI / turnReport
  const hospitalReport = {
    capacidade,
    fila: hospital.fila.length,
    internados: hospital.internados.length,
    novosPacientes: quantidadeNovos,
    admitidos: admittedCount,
    altas: altas.length,
    obitos: obitos.length,
  };

  // (5) Fator de penalidade produtiva baseado nos COLONOS internados (aplique depois)
  const internadosColonos = hospital.internados.filter(
    (p) => p.tipo === "colono"
  ).length;
  const prodPenalty = Math.min(0.2, internadosColonos * 0.005); // máx -20%

  // -------------------
  // 1. Produções básicas (calcular valores brutos SEM somar ainda)
  // -------------------
  const pontos = distribuicao;

  // COMIDA (cálculo base)
  let comidaProduzida = quantidadePorSetor.fazenda * 2 * consumoAgua;
  if (pontos.agricultura === 1) comidaProduzida *= 2;
  if (construcoes.fazenda > 0) comidaProduzida += construcoes.fazenda * 5;
  if (construcoes.sistemaDeIrrigacao > 0)
    comidaProduzida += construcoes.sistemaDeIrrigacao * 10;
  comidaProduzida -= populacao.colonos;

  // MINERAIS
  let mineraisProduzidos = quantidadePorSetor.minas * 10 * consumoAgua;
  if (pontos.minas === 1) mineraisProduzidos *= 2;

  // CIÊNCIA
  let cienciaProduzida = Math.floor(quantidadePorSetor.laboratorio / 2);
  if (pontos.laboratorio === 1) cienciaProduzida *= 2;

  // CONSTRUÇÃO
  let reparo = Math.floor(quantidadePorSetor.construcao / 10);
  if (pontos.construcao === 1) reparo *= 2;
  integridadeEstrutural += reparo;
  log.push(`Oficina de Construção restaurou ${reparo} de integridade.`);

  // SAÚDE (base; aplicar no estado depois de penalidades)
  let ganhoSaude = Math.floor(quantidadePorSetor.saude / 10) * consumoAgua;
  if (pontos.saude === 1) ganhoSaude *= 2;

  // ENERGIA
  let energiaGerada = quantidadePorSetor.energia * 3;
  if (pontos.energia === 1) energiaGerada = Math.floor(energiaGerada * 1.15);

  // Penalidades para ganhoSaude
  if (agua <= 0) {
    ganhoSaude -= 2;
    log.push("Falta de água reduziu o ganho de saúde.");
  }
  if (energia <= 0) {
    ganhoSaude -= 2;
    log.push("Falta de energia reduziu o ganho de saúde.");
  }
  if (sustentabilidade <= 25) {
    ganhoSaude -= 2;
    log.push("Baixa sustentabilidade (<= 25) reduziu muito a saúde.");
  } else if (sustentabilidade <= 50) {
    ganhoSaude -= 1;
    log.push("Sustentabilidade moderada (<= 50) reduziu um pouco a saúde.");
  }
  ganhoSaude = Math.max(0, ganhoSaude); // clamp
  saude = Math.min(100, saude + ganhoSaude);
  log.push(`Saúde melhorada em ${ganhoSaude}.`);

  // SUSTENTABILIDADE (base + penalidades/bonificações)
  let ganhoSustentabilidade = 1;
  if (agua <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Falta de água reduziu o ganho de Sustentabilidade.");
  } else {
    ganhoSustentabilidade += 1;
  }
  if (energia <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Falta de energia reduziu o ganho de Sustentabilidade.");
  } else {
    ganhoSustentabilidade += 1;
  }
  if (comida <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Falta de comida reduziu o ganho de Sustentabilidade.");
  } else {
    ganhoSustentabilidade += 1;
  }
  if (saude <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Saúde precária reduziu o ganho de Sustentabilidade.");
  } else {
    ganhoSustentabilidade += 1;
  }

  // Sustentabilidade impacta a eficiência geral
  if (sustentabilidade <= 25) {
    comidaProduzida = Math.floor(comidaProduzida * 0.9);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.9);
    reparo = Math.floor(reparo * 0.9);
    agua = Math.floor(agua * 0.9);
    energia = Math.floor(energia * 0.9);
    saude = Math.floor(saude * 0.9);
    log.push("Baixa sustentabilidade (<= 25): Eficiência reduzida em 10%");
  } else if (sustentabilidade <= 50) {
    comidaProduzida = Math.floor(comidaProduzida * 0.95);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.95);
    reparo = Math.floor(reparo * 0.95);
    energia = Math.floor(energia * 0.95);
    saude = Math.floor(saude * 0.95);
    log.push("Sustentabilidade moderada (<= 50): Eficiência reduzida em 5%");
  } else if (sustentabilidade < 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.05);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 1.05);
    reparo = Math.floor(reparo * 1.05);
    energia = Math.floor(energia * 1.05);
    saude = Math.floor(saude * 1.05);
    log.push("Boa sustentabilidade (51 a 99): Eficiência aumentada em 5%");
  } else if (sustentabilidade === 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.1);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 1.1);
    reparo = Math.floor(reparo * 1.1);
    energia = Math.floor(energia * 1.1);
    saude = Math.floor(saude * 1.1);
    log.push("Sustentabilidade máxima (100): Eficiência aumentada em 10%");
  }

  sustentabilidade = Math.min(100, sustentabilidade + ganhoSustentabilidade);
  log.push(`Sustentabilidade aumentada em ${ganhoSustentabilidade}.`);

  // *** AQUI aplica o penal do hospital nas produções ***
  comidaProduzida = Math.floor(comidaProduzida * (1 - prodPenalty));
  mineraisProduzidos = Math.floor(mineraisProduzidos * (1 - prodPenalty));
  cienciaProduzida = Math.floor(cienciaProduzida * (1 - prodPenalty));
  // (se quiser, pode aplicar também a energiaGerada)

  // *** Só agora some as produções no estado ***
  comida += comidaProduzida;
  minerais += mineraisProduzidos;
  ciencia += cienciaProduzida;
  energia += energiaGerada;

  // -------------------
  // 2. Eventos aleatórios
  // -------------------
  const eventosOcorridos = [];
  scenario.eventosProvaveis.forEach((evento) => {
    const sorte = Math.random() * 100;
    if (sorte < evento.chance) {
      eventosOcorridos.push(evento.nome);
      log.push(`Evento: ${evento.nome}`);
      if (evento.efeito === "quebra_estruturas") {
        let dano = Math.max(0, 10);
        if (dano === 0) {
          log.push("Evento contido! Nenhum dano à estrutura.");
        } else {
          integridadeEstrutural -= dano;
          log.push(`Estrutura danificada em ${dano} pontos.`);
        }
      }
      if (evento.efeito === "ganha_pesquisa") {
        sustentabilidade += 5;
        log.push("Pesquisa acelerada! Sustentabilidade +5");
      }
    }
  });

  // -------------------
  // 3. Ajustes finais
  // -------------------
  integridadeEstrutural = Math.min(100, Math.max(0, integridadeEstrutural));

  if (comida < populacao.colonos) {
    populacao.colonos -= 5;
    saude -= 10;
    log.push("Fome! A população e saúde caíram.");
  } else {
    populacao.colonos += 2;
  }

  saude = Math.max(0, Math.min(100, saude));
  sustentabilidade = Math.max(0, Math.min(100, sustentabilidade));
  turno += 1;

  // 4. Atualizar fila e aplicar efeitos (construções)
  const novaFila = [];
  const construcoesFinalizadas = [];
  filaConstrucoes.forEach((construcao) => {
    if (construcao.tempoRestante <= 1) {
      construcoesFinalizadas.push(construcao);
    } else {
      novaFila.push({
        ...construcao,
        tempoRestante: construcao.tempoRestante - 1,
      });
    }
  });

  // 4b. Fila de missões (por turnos)
  const REWARD_KEY_TO_PATH = {
    colono: "populacao.colonos",
    comida: "comida",
    minerais: "minerais",
    energia: "energia",
    agua: "agua",
    ciencia: "ciencia",
    creditos: "creditos", // use "ouro" se for o seu campo
    ouro: "ouro", // deixe os dois, se quiser aceitar ambos
    saude: "saude",
    sustentabilidade: "sustentabilidade",
    reliquias: "reliquias",
    cristaisEnergeticos: "cristaisEnergeticos",
    amuleto: "amuletos",
  };

  // seta (ou cria) caminho aninhado tipo "populacao.colonos" somando delta
  function addToPath(obj, path, delta) {
    if (!path) return;
    const parts = path.split(".");
    let ref = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof ref[p] !== "object" || ref[p] === null) ref[p] = {};
      ref = ref[p];
    }
    const last = parts[parts.length - 1];
    const cur = Number(ref[last]) || 0;
    ref[last] = cur + (Number(delta) || 0);
  }

  // normaliza um item de recompensa em um map { chave: soma }
  function extractRewardsMap(recompensasRaw = []) {
    const acc = {};
    for (const it of recompensasRaw) {
      if (!it || typeof it !== "object") continue;
      for (const [k, v] of Object.entries(it)) {
        if (k === "label" || k === "cor") continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n === 0) continue;
        acc[k] = (acc[k] || 0) + n;
      }
    }
    return acc;
  }

  // aplica recompensas vindas de um array de objetos
  // ex.: [{ label: "+1 Colono", cor: "...", colono: 1 }, { comida: 200 }, ...]
  function applyMissionRewardsFromJson(novoEstado, recompensasRaw = []) {
    for (const item of recompensasRaw) {
      if (!item || typeof item !== "object") continue;
      for (const [k, v] of Object.entries(item)) {
        if (k === "label" || k === "cor") continue;
        const delta = Number(v);
        if (!Number.isFinite(delta) || delta === 0) continue;
        const path = REWARD_KEY_TO_PATH[k] || k;
        addToPath(novoEstado, path, delta);
      }
    }
  }

  const filaMissoesAtual = Array.isArray(currentState.filaMissoes)
    ? currentState.filaMissoes.map((f) => ({ ...f }))
    : [];

  const missoesConcluidas = [];
  const filaMissoesNova = [];

  // helper para garantir número inteiro seguro
  const toInt = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n)
      ? Math.trunc(n)
      : Math.trunc(Number(fallback) || 0);
  };

  for (const item of filaMissoesAtual) {
    // total de turnos da missão: prioriza o campo salvo; se não houver, usa o próprio tempoRestante; por último 1
    const total = toInt(item.turnosTotais, item.tempoRestante || 1);

    // turnos restantes atuais (coerção numérica)
    const atual = toInt(item.tempoRestante, total);

    // decrementa 1 turno inteiro por rodada
    const rest = atual - 1;

    if (rest <= 0) {
      // missão termina neste turno
      missoesConcluidas.push({
        ...item,
        missionId: item.id, // id da missão base (templo/vulcao/floresta)
        tempoRestante: 0,
        turnosTotais: total,
        status: "concluida",
      });
    } else {
      // permanece na fila com rest atualizado
      filaMissoesNova.push({
        ...item,
        missionId: item.id,
        tempoRestante: rest,
        turnosTotais: total,
        status: "emAndamento",
      });
    }
  }

  // 5. Novo estado base
  const novoEstado = {
    _id,
    nome,
    turno,
    populacao,
    energia,
    agua,
    maxAgua,
    comida,
    minerais,
    saude,
    sustentabilidade,
    integridadeEstrutural,
    ciencia,
    construcoes: { ...currentState.construcoes },
    pesquisa,
    filaConstrucoes: novaFila,
    filaMissoes: filaMissoesNova,
    exploradores: [...(currentState.exploradores || [])],
    relatoriosMissoes: [...(currentState.relatoriosMissoes || [])],
    hospital: { ...hospital },
  };

  // Aplicar construções finalizadas
  construcoesFinalizadas.forEach((c) => {
    const tipo = c.id;
    const dadosConstrucao = buildings[tipo];
    if (!dadosConstrucao) {
      log.push(`Erro: construção com id "${tipo}" não encontrada.`);
      return;
    }
    if (!novoEstado.construcoes[tipo]) novoEstado.construcoes[tipo] = 0;
    novoEstado.construcoes[tipo] += 1;
    if (dadosConstrucao.efeitos?.bonusComida) {
      novoEstado.comida += dadosConstrucao.efeitos.bonusComida;
    }
    log.push(`🏗️ ${dadosConstrucao.nome} finalizada!`);
  });

  // Resumo de produção deste turno
  const producaoResumo = {
    comidaLiquida: typeof comidaProduzida === "number" ? comidaProduzida : 0,
    energiaGerada: typeof energiaGerada === "number" ? energiaGerada : 0,
    mineraisProduzidos:
      typeof mineraisProduzidos === "number" ? mineraisProduzidos : 0,
    cienciaProduzida:
      typeof cienciaProduzida === "number" ? cienciaProduzida : 0,
    reparoAplicado: typeof reparo === "number" ? reparo : 0,
    ganhoSaude: typeof ganhoSaude === "number" ? ganhoSaude : 0,
    ganhoSustentabilidade:
      typeof ganhoSustentabilidade === "number" ? ganhoSustentabilidade : 0,
  };

  // Finalização de missões
  const rewardsSummary = [];
  if (missoesConcluidas.length > 0) {
    const concluidasPorExplorador = new Map();
    for (const m of missoesConcluidas) {
      if (m.explorerId) concluidasPorExplorador.set(m.explorerId, m);
    }

    novoEstado.exploradores = (novoEstado.exploradores || []).map((ex) => {
      const terminouPorId = concluidasPorExplorador.get(ex.id);
      const terminouPorMissao =
        !terminouPorId &&
        ex.missionId &&
        missoesConcluidas.some(
          (m) => m.id === ex.missionId || m.missionId === ex.missionId
        );
      if (!terminouPorId && !terminouPorMissao) return ex;
      return {
        ...ex,
        status: "disponivel",
        missionId: null,
        updatedAt: Date.now(),
      };
    });
    const livres = (novoEstado.exploradores || []).filter(
      (e) => e.status === "disponivel"
    ).length;
    novoEstado.populacao = { ...novoEstado.populacao, exploradores: livres };

    for (const fin of missoesConcluidas) {
      applyMissionRewardsFromJson(novoEstado, fin.recompensasRaw);
      const rewardsMap = extractRewardsMap(fin.recompensasRaw);

      rewardsSummary.push({
        missionId: fin.missionId || fin.id,
        titulo: fin.titulo || fin.nome || fin.id,
        explorerNome: fin.explorerNome || null,
        recompensas: rewardsMap,
        recompensasRaw: fin.recompensasRaw,
      });

      novoEstado.relatoriosMissoes.push({
        id: `rel_${fin.id}_${Date.now()}`,
        explorerId: fin.explorerId ?? null,
        missionId: fin.missionId || fin.id,
        titulo: fin.titulo || fin.nome || fin.id,
        concluidaEm: Date.now(),
        resultado: "sucesso",
      });

      log.push(
        `🧭 Missão concluída: ${fin.titulo || fin.id}${
          fin.explorerNome ? ` (Explorador ${fin.explorerNome})` : ""
        } — recompensas aplicadas.`
      );
    }
  }

  // ---- deltas finais (comparando com baseline) ----
  const deltas = {
    comida: (novoEstado.comida ?? comida) - baseline.comida,
    energia: (novoEstado.energia ?? energia) - baseline.energia,
    minerais: (novoEstado.minerais ?? minerais) - baseline.minerais,
    ciencia: (novoEstado.ciencia ?? ciencia) - baseline.ciencia,
    agua: (novoEstado.agua ?? agua) - baseline.agua,
    saude: (novoEstado.saude ?? saude) - baseline.saude,
    sustentabilidade:
      (novoEstado.sustentabilidade ?? sustentabilidade) -
      baseline.sustentabilidade,
    integridadeEstrutural:
      (novoEstado.integridadeEstrutural ?? integridadeEstrutural) -
      baseline.integridadeEstrutural,
  };

  // 👇 objeto que o front usará no Stepper
  const turnReport = {
    producao: producaoResumo,
    deltas,
    eventos: eventosOcorridos,
    missoesConcluidas: rewardsSummary,
    logs: log,
    hospital: hospitalReport,
  };

  return {
    novoEstado,
    eventosOcorridos,
    log,
    novaFila: /* sua novaFila */ [],
    turnReport, // 👈 NOVO
    hospital: hospitalReport,
  };
}
