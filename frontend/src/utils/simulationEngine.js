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
    battleCampaign,
    landingModifiers,
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

  let prodPenalty = 0;

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
    return postoMedico * 3 + hospitalCentral * 8;
  }

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
      turnosNaFila: 0,
    };
  }

  /** move da fila para internados respeitando capacidade (1 slot por paciente) */
  function admitFromQueue(hospital, capacidade) {
    const internados = [...(hospital.internados || [])];
    const fila = [...(hospital.fila || [])];

    const used = internados.length;
    let free = Math.max(0, capacidade - used);

    const admitted = [];
    const keptQueue = [];

    for (const p of fila) {
      const cost = 1; // grave e leve ocupam 1 slot agora
      if (free >= cost) {
        p.status = "internado";
        p.turnosRestantes = turnosPorSeveridade(p.severidade); // (re)garante duração ao internar
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

  /** Incrementa 1 turno de espera para quem continua na fila.
   *  Se passar de 3 turnos esperando, vai a óbito por "esperaFila".
   */
  function tickQueueWait(hospital, maxWait = 3) {
    const survivors = [];
    const obitosFilaTempo = [];

    for (const p of hospital.fila || []) {
      const tnf = (p.turnosNaFila ?? 0) + 1; // incrementa
      const next = { ...p, turnosNaFila: tnf };

      // "mais de 3 turnos" => morre no 4º turno de espera
      if (tnf > maxWait) {
        obitosFilaTempo.push({
          ...next,
          status: "obito",
          origem: p.origem ? `${p.origem}_fila` : "fila",
          obitoEm: Date.now(),
          motivoObito: "esperaFila",
        });
      } else {
        survivors.push(next);
      }
    }

    hospital.fila = survivors;
    return { obitosFilaTempo };
  }

  /** processa 1 turno de tratamento: decrementa 1 para QUEM JÁ ESTAVA internado */
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
        // chance de óbito no fim do tratamento (grave 5%, leve 0%)
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

  /** aplica risco de óbito em fila SE hospital estiver lotado (5%) */
  function applyQueueDeathRisk(hospital, capacidade, chance = 0.05) {
    const internadosCount = (hospital.internados || []).length;
    if (internadosCount < capacidade) return { obitosFila: [] };

    const survivors = [];
    const obitosFila = [];
    for (const p of hospital.fila || []) {
      if (Math.random() < chance) {
        obitosFila.push({
          ...p,
          status: "obito",
          origem: "filaLotada",
          obitoEm: Date.now(),
        });
      } else {
        survivors.push(p);
      }
    }
    hospital.fila = survivors;
    return { obitosFila };
  }

  // ====== HOSPITAL: integração no turno ======
  const hospital = JSON.parse(
    JSON.stringify(
      currentState.hospital || { fila: [], internados: [], historicoAltas: [] }
    )
  );

  // helper para acrescentar no histórico e manter apenas as últimas N entradas
  function pushHistoricoAltas(items, max = 200) {
    if (!Array.isArray(items) || items.length === 0) return;
    if (!Array.isArray(hospital.historicoAltas)) hospital.historicoAltas = [];
    hospital.historicoAltas.push(...items);

    // se exceder o limite, remove as mais antigas (começo do array)
    const excedente = hospital.historicoAltas.length - max;
    if (excedente > 0) {
      hospital.historicoAltas.splice(0, excedente);
    }
  }

  // (1) Primeiro: processar altas/óbito de QUEM JÁ ESTAVA internado
  const { internados: internadosTick, altas, obitos } = tickHospital(hospital);
  hospital.internados = internadosTick;
  pushHistoricoAltas([...altas, ...obitos]);

  // (2) Chegam novos pacientes neste turno (até 10% dos colonos; mais graves se saúde baixa)
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

  // (3) Admitir da fila até ocupar a capacidade
  const capacidade = calcHospitalCapacity(construcoes);
  const {
    internados: internadosAposAdmissao,
    fila: filaAposAdmissao,
    admittedCount,
  } = admitFromQueue(hospital, capacidade);
  hospital.internados = internadosAposAdmissao;
  hospital.fila = filaAposAdmissao;

  // (3.1) Tic da fila: quem exceder 3 turnos esperando morre
  const { obitosFilaTempo } = tickQueueWait(hospital, 3);
  if (obitosFilaTempo.length > 0) {
    pushHistoricoAltas(obitosFilaTempo); // mantém seu histórico aparado a 200
    log.push(
      `☠️ ${obitosFilaTempo.length} paciente(s) faleceram por excesso de espera na fila (> 3 turnos).`
    );
  }

  // (4) Risco de morte NA FILA se hospital estiver lotado (5%)
  const { obitosFila } = applyQueueDeathRisk(hospital, capacidade, 0.05);
  if (obitosFila.length > 0) {
    pushHistoricoAltas(obitosFila);
    log.push(
      `⚠️ ${obitosFila.length} paciente(s) faleceram aguardando vaga no hospital.`
    );
  }

  // (5) Impacto produtivo opcional (internados tiram gente da produção)
  // >>> Só calcula a penalidade aqui; aplicamos mais tarde,
  const internadosColonos = (hospital.internados || []).filter(
    (p) => p.tipo === "colono"
  ).length;
  prodPenalty = Math.min(0.2, internadosColonos * 0.005);

  // (6) Report do hospital (inclui óbitos na fila)
  const hospitalReport = {
    capacidade,
    fila: hospital.fila.length,
    internados: hospital.internados.length,
    novosPacientes: quantidadeNovos,
    admitidos: admittedCount,
    altas: altas.length,
    obitos: obitos.length + obitosFila.length, // total do turno
    obitosFila: obitosFila.length, // detalhado
  };

  // -------------------
  // 1. Produções básicas (calcular valores brutos SEM somar ainda)
  // -------------------
  const pontos = normalizeDistribuicao(distribuicao);

  // COMIDA (cálculo base)
  const workersFarm = quantidadePorSetor.fazenda;

  // 1) Produção dos colonos na fazenda
  let farmWorkersProd = workersFarm * 2 * consumoAgua;
  if (pontos.agricultura === 1) {
    // dobra apenas a parte dos trabalhadores
    farmWorkersProd *= 2;
  }

  // 2) Bônus fixo por fazendas construídas (mantém como está)
  const bonusFazendas = (construcoes.fazenda || 0) * 5;

  // 3) Irrigação: +15 de comida por irrigador (flat)
  const irrigadores = construcoes.sistemaDeIrrigacao || 0;
  const bonusIrrigacaoFlat = irrigadores * 15;

  // 4) Custo de energia dos irrigadores (30 por unidade)
  const custoEnergiaIrrigacao = irrigadores * 30;
  energia -= custoEnergiaIrrigacao;

  // 5) Total bruto de comida
  const comidaBruta = farmWorkersProd + bonusFazendas + bonusIrrigacaoFlat;

  // 6) Consumo da população
  const consumoColonos = Math.floor((populacao.colonos || 0) * 0.5); // 0.5 por colono, arredonda p/ baixo
  const consumoExploradores = (populacao.exploradores || 0) * 2;
  const consumoGuardas = (populacao.guardas || 0) * 2;
  const consumoMarines = (populacao.marines || 0) * 2;
  const consumoSnipers = (populacao.snipers || 0) * 2;
  const consumoRangers = (populacao.rangers || 0) * 2;

  const consumoPop =
    consumoColonos +
    consumoExploradores +
    consumoGuardas +
    consumoMarines +
    consumoSnipers +
    consumoRangers;

  // 7) Resultado líquido deste turno
  let comidaProduzida = Math.floor(comidaBruta - consumoPop);

  // 8) Logs úteis
  log.push(
    `🌾 Comida — trab:${farmWorkersProd} | fazendas:+${bonusFazendas} | irrigação:+${bonusIrrigacaoFlat} (${irrigadores}×15) | consumo:-${consumoPop} ⇒ líquido:${comidaProduzida}.`
  );
  if (custoEnergiaIrrigacao > 0) {
    log.push(
      `💡 Irrigação consumiu ${custoEnergiaIrrigacao} de energia (${irrigadores}×30).`
    );
  }

  // MINERAIS
  const baseMineracaoWorkers = quantidadePorSetor.minas * consumoAgua;
  let mineraisProduzidos =
    pontos.mineracao === 1 ? baseMineracaoWorkers * 2 : baseMineracaoWorkers;

  const minasCarvao = construcoes.minaDeCarvao || 0;
  const minasProfundas = construcoes.minaProfunda || 0;
  const geoSolar = construcoes.geoSolar || 0;

  const extraCarvao = minasCarvao * 15; // +15 minerais por minaDeCarvao
  const extraProfunda = minasProfundas * 40; // +40 minerais por minaProfunda
  const extraGeoSolar = geoSolar * 30; // +40 minerais por minaProfunda
  const extraEnergiaGeoSolar = geoSolar * 10; // +10 de energia por geoSolar

  mineraisProduzidos += extraCarvao + extraProfunda + extraGeoSolar;

  // energia: custo/ganhos de construções ligadas à mineração
  const custoEnergiaMinasProfundas = minasProfundas * 20; // -20 por minaProfunda
  if (custoEnergiaMinasProfundas > 0) energia -= custoEnergiaMinasProfundas;

  // ganho de energia do geoSolar
  if (extraEnergiaGeoSolar > 0) energia += extraEnergiaGeoSolar;

  log.push(
    `⛏️ Minerais — workers:${baseMineracaoWorkers}${
      pontos.mineracao === 1 ? "→" + baseMineracaoWorkers * 2 : ""
    } | carvão:+${extraCarvao} (x${minasCarvao}) | profunda:+${extraProfunda} (x${minasProfundas}) ⇒ total:+${mineraisProduzidos}.`
  );
  if (custoEnergiaMinasProfundas > 0) {
    log.push(
      `🔋 Minas profundas consumiram ${custoEnergiaMinasProfundas} de energia (${minasProfundas}×20).`
    );
  }
  if (extraEnergiaGeoSolar > 0) {
    log.push(
      `⚡ geoSolar gerou ${extraEnergiaGeoSolar} de energia (${geoSolar}×10).`
    );
  }

  // CIÊNCIA
  let cienciaProduzida = Math.floor(quantidadePorSetor.laboratorio / 2);
  if (pontos.laboratorio === 1) cienciaProduzida *= 2;

  // CONSTRUÇÃO
  let reparo = Math.floor(quantidadePorSetor.construcao / 10);
  if (pontos.construcao === 1) reparo *= 2;
  integridadeEstrutural += reparo;
  log.push(`Oficina de Construção restaurou ${reparo} de integridade.`);

  // SAÚDE (base; aplicar no estado depois de penalidades)
  let ganhoSaude = Math.floor(quantidadePorSetor.saude / 100) * consumoAgua;
  if (pontos.saude === 1) ganhoSaude *= 2;

  // === ENERGIA  ===
  // 1) Trabalhadores: 5 energia por colono alocado
  let energiaTrabalhadores = (quantidadePorSetor.energia || 0) * 5;
  if (pontos.energia === 1) {
    energiaTrabalhadores = Math.floor(energiaTrabalhadores * 2); // x2 só nos workers
  }

  // 2) Geradores Solares: +12 cada e +⌊solares/2⌋ de ganho de sustentabilidade (calculado depois)
  const solares = construcoes.geradorSolar || 0;
  const energiaSolar = solares * 12;
  const bonusSustentabilidadeSolar = Math.floor(solares / 2);

  // 3) Reatores Geotérmicos: +30 cada, –2 minerais/unidade, –1 sustentabilidade/unidade
  const reatores = construcoes.reatorGeotermico || 0;
  const energiaGeo = reatores * 30;
  const custoManutencaoGeo = reatores * 2;
  minerais -= custoManutencaoGeo; // manutenção em minerais
  const penaltySustentabilidadeGeo = reatores; // –1 por reator

  // 3b) Microvazamentos: 10% de chance por reator; cada ocorrência tira –3 de integridade
  let vazamentos = 0;
  for (let i = 0; i < reatores; i++) {
    if (Math.random() < 0.1) vazamentos++;
  }
  if (vazamentos > 0) {
    const dano = 3 * vazamentos;
    integridadeEstrutural -= dano;
    log.push(
      `⚠️ Microvazamento térmico em ${vazamentos} reator(es): Integridade −${dano}.`
    );
  }

  // 4) Energia total gerada no turno (antes de custos como irrigação)
  let energiaGerada = energiaTrabalhadores + energiaSolar + energiaGeo;

  // Logs
  log.push(
    `⚡ Energia — workers:${energiaTrabalhadores} | solar:+${energiaSolar} (x${solares}) | geo:+${energiaGeo} (x${reatores}) ⇒ total:+${energiaGerada}.`
  );
  if (custoManutencaoGeo > 0) {
    log.push(`🛠️ Manutenção geotérmica: −${custoManutencaoGeo} minerais.`);
  }

  // Penalidades para ganhoSaude
  if (comida <= 0) {
    ganhoSaude -= 2;
    log.push("Falta de comida reduziu o ganho de saúde.");
  }
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

  ganhoSustentabilidade += bonusSustentabilidadeSolar; // +⌊solares/2⌋
  ganhoSustentabilidade -= penaltySustentabilidadeGeo; // −reatores

  if (bonusSustentabilidadeSolar > 0) {
    log.push(
      `🌞 Sustentabilidade: +${bonusSustentabilidadeSolar} (geradores solares).`
    );
  }
  if (penaltySustentabilidadeGeo > 0) {
    log.push(
      `🌋 Sustentabilidade: −${penaltySustentabilidadeGeo} (reatores geotérmicos).`
    );
  }

  if (agua <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Falta de água reduziu o ganho de Sustentabilidade.");
  }
  if (energia <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Falta de energia reduziu o ganho de Sustentabilidade.");
  }
  if (comida <= 0) {
    ganhoSustentabilidade -= 5;
    log.push("Falta de comida reduziu o ganho de Sustentabilidade.");
  }
  if (saude <= 0) {
    ganhoSustentabilidade -= 2;
    log.push("Saúde precária reduziu o ganho de Sustentabilidade.");
  }

  // --- Sustentabilidade impacta eficiência (como você já tinha) ---
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

  const lm = landingModifiers || {};
  const applyLM = (base, key, label) => {
    const m = Number(lm?.[key] ?? 0);
    if (!Number.isFinite(m) || m === 0) return base;
    const out = Math.floor(base * (1 + m));
    log.push(
      `🪐 ${label}: ${m > 0 ? "+" : ""}${(m * 100).toFixed(
        0
      )}% ⇒ ${base}→${out}.`
    );
    return out;
  };

  comidaProduzida = applyLM(
    comidaProduzida,
    "agricultura",
    "Agricultura (landing)"
  );
  mineraisProduzidos = applyLM(
    mineraisProduzidos,
    "mineracao",
    "Mineração (landing)"
  );
  energiaGerada = applyLM(energiaGerada, "energia", "Energia (landing)");
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
    saude -= 5;
    log.push("Fome! A população e saúde caíram.");
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

  function to01(v) {
    return v ? 1 : 0;
  }

  function normalizeDistribuicao(d = {}) {
    return {
      agricultura: to01(d.agricultura),
      mineracao: to01(d.mineracao ?? d.minas ?? d["mineração"]),
      laboratorio: to01(d.laboratorio ?? d["laboratório"]),
      construcao: to01(d.construcao ?? d["construção"]),
      saude: to01(d.saude ?? d["saúde"]),
      energia: to01(d.energia),
    };
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
    skillsDistribuicao: pontos, // 👈 persistente, sem acentos
    parametrosSnapshot: {
      // (opcional) útil pra auditoria/UX
      ...parametros,
      distribuicao: pontos, // já normalizado
    },
    battleCampaign,
    landingModifiers,
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

  const construcoesFinalizadasResumo = construcoesFinalizadas.map((c) => {
    const meta = buildings?.[c.id];
    return {
      id: c.id,
      nome: c.nome || meta?.nome || c.id,
      categoria: meta?.categoria || null,
    };
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

  console.log(log);
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
    construcoesFinalizadas: construcoesFinalizadasResumo,
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
