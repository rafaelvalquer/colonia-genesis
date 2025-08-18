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

  const { distribuicao, agua: consumoAgua, alocacaoColonos } = parametros;

  const quantidadePorSetor = Object.fromEntries(
    Object.entries(alocacaoColonos).map(([setor, porcentagem]) => [
      setor,
      Math.ceil((porcentagem / 100) * populacao.colonos),
    ])
  );

  console.log("pesquisa = " + pesquisa);
  // -------------------
  // 1. Produções básicas com base nos pontos
  // -------------------

  const pontos = distribuicao;

  console.log("##########construcoes######## = " + JSON.stringify(construcoes));

  //#region Comida

  var comidaProduzida = quantidadePorSetor.fazenda * 2 * consumoAgua;

  if (pontos.agricultura == 1) {
    comidaProduzida = comidaProduzida * 2;
  }

  if (construcoes.fazenda > 0) {
    comidaProduzida = comidaProduzida + construcoes.fazenda * 5;
  }

  if (construcoes.sistemaDeIrrigacao > 0) {
    comidaProduzida = comidaProduzida + construcoes.sistemaDeIrrigacao * 10;
  }

  comidaProduzida = comidaProduzida - populacao.colonos;
  comida = comida + comidaProduzida;
  console.log("comidaProduzida = " + comidaProduzida);

  /* Defesa

  var defesaBase = alocacaoColonos.defesa;

  if (pontos.defesa == 1) {
    defesaBase = defesaBase + 15; // Aumenta a defesaBase em 15%
  }
  console.log("defesaBase = " + defesaBase); */

  //Minas

  var mineraisProduzidos = quantidadePorSetor.minas * 10 * consumoAgua;

  if (pontos.minas == 1) {
    mineraisProduzidos = mineraisProduzidos * 2;
  }

  console.log("Produção de Minas = " + mineraisProduzidos);

  //Laboratorio

  var cienciaProduzida = Math.floor(quantidadePorSetor.laboratorio / 2);

  if (pontos.laboratorio == 1) {
    cienciaProduzida = cienciaProduzida * 2;
  }

  ciencia = ciencia + cienciaProduzida;
  console.log("cienciaProduzida = " + cienciaProduzida);

  //Construção

  var reparo = Math.floor(quantidadePorSetor.construcao / 10); // cada 10% = +1
  if (pontos.construcao == 1) {
    reparo = reparo * 2;
  }
  integridadeEstrutural += reparo;

  console.log("Reparo em % = " + reparo);
  log.push(`Oficina de Construção restaurou ${reparo} de integridade.`);

  //Saude

  var ganhoSaude = Math.floor(quantidadePorSetor.saude / 10) * consumoAgua; // cada 10% = +1

  // Dobrar se ponto de saúde ativo
  if (pontos.saude === 1) {
    ganhoSaude *= 2;
  }

  // Penalidades
  if (agua <= 0) {
    ganhoSaude -= 2;
    log.push("Falta de água reduziu o ganho de saúde.");
  }

  if (energia <= 0) {
    ganhoSaude -= 2;
    log.push("Falta de energia reduziu o ganho de saúde.");
  }

  // Sustentabilidade
  if (sustentabilidade <= 25) {
    ganhoSaude -= 2;
    log.push("Baixa sustentabilidade (<= 25) reduziu muito a saúde.");
  } else if (sustentabilidade <= 50) {
    ganhoSaude -= 1;
    log.push("Sustentabilidade moderada (<= 50) reduziu um pouco a saúde.");
  }

  // Impedir que saúde seja negativa
  ganhoSaude = Math.max(0, ganhoSaude);

  // Aplicar à saúde atual
  saude = Math.min(100, saude + ganhoSaude);
  log.push(`Saúde melhorada em ${ganhoSaude}.`);

  // Sustentabilidade

  var ganhoSustentabilidade = 1;

  // Penalidades
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

  // -------------------
  // Sustentabilidade impacta a eficiência da colônia
  // -------------------

  if (sustentabilidade <= 25) {
    comidaProduzida = Math.floor(comidaProduzida * 0.9); // -10%
    //defesaBase = Math.floor(defesaBase * 0.9);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.9);
    reparo = Math.floor(reparo * 0.9);
    agua = Math.floor(agua * 0.9);
    energia = Math.floor(energia * 0.9);
    saude = Math.floor(saude * 0.9);

    log.push("Baixa sustentabilidade (<= 25): Eficiência reduzida em 10%");
  } else if (sustentabilidade <= 50) {
    comidaProduzida = Math.floor(comidaProduzida * 0.95); // -5%
    //defesaBase = Math.floor(defesaBase * 0.95);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.95);
    reparo = Math.floor(reparo * 0.95);
    energia = Math.floor(energia * 0.95);
    saude = Math.floor(saude * 0.95);

    log.push("Sustentabilidade moderada (<= 50): Eficiência reduzida em 5%");
  } else if (sustentabilidade < 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.05); // +5%
    //defesaBase = Math.floor(defesaBase * 1.05);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 1.05);
    reparo = Math.floor(reparo * 1.05);
    energia = Math.floor(energia * 1.05);
    saude = Math.floor(saude * 1.05);

    log.push("Boa sustentabilidade (51 a 99): Eficiência aumentada em 5%");
  } else if (sustentabilidade === 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.1); // +10%
    //defesaBase = Math.floor(defesaBase * 1.1);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 1.1);
    reparo = Math.floor(reparo * 1.1);
    energia = Math.floor(energia * 1.1);
    saude = Math.floor(saude * 1.1);

    log.push("Sustentabilidade máxima (100): Eficiência aumentada em 10%");
  }

  sustentabilidade = Math.min(100, sustentabilidade + ganhoSustentabilidade);
  log.push(`Sustentabilidade aumentada em ${ganhoSustentabilidade}.`);

  //Energia

  var energiaGerada = quantidadePorSetor.energia * 3;

  if (pontos.energia == 1) {
    energiaGerada = Math.floor((energiaGerada *= 1.15)); // Aumenta a energiaGerada em 15%
  }

  energia = energia + energiaGerada;
  console.log("energiaGerada = " + energiaGerada);

  ////////////////////////

  // -------------------
  // 2. Eventos aleatórios
  // -------------------

  const eventosOcorridos = [];

  scenario.eventosProvaveis.forEach((evento) => {
    const chanceBase = evento.chance;
    const chanceReduzida = chanceBase;
    const sorte = Math.random() * 100;

    if (sorte < chanceReduzida) {
      eventosOcorridos.push(evento.nome);
      log.push(`Evento: ${evento.nome}`);

      if (evento.efeito === "quebra_estruturas") {
        let dano = 10;

        // Impede dano negativo
        dano = Math.max(0, dano);

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

  // 4. Atualizar fila e aplicar efeitos
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

  // -------------------
  // 4b. FILA DE MISSÕES (novo — por turnos)
  // -------------------
  // mapa de recompensas simples (ajuste conforme seu design real)
  const missionRewards = {
    templo:   { ouro: 1500, reliquias: 3, ciencia: 0, comida: 0, minerais: 0 },
    vulcao:   { ouro: 3500, cristaisEnergeticos: 1, ciencia: 0, comida: 0, minerais: 0 },
    floresta: { ouro: 1200, amuleto: 1, ciencia: 0, comida: 0, minerais: 0 },
  };

  const filaMissoesAtual = Array.isArray(currentState.filaMissoes)
    ? currentState.filaMissoes.map((f) => ({ ...f }))
    : [];

  const missoesConcluidas = [];
  const filaMissoesNova = [];

  for (const item of filaMissoesAtual) {
    const rest = Math.max(0, (item.tempoRestante ?? item.turnosTotais ?? 1) - 1);
    if (rest === 0) {
      missoesConcluidas.push({ ...item, tempoRestante: 0, status: "concluida" });
    } else {
      filaMissoesNova.push({ ...item, tempoRestante: rest, status: "emAndamento" });
    }
  }

  // -------------------
  // 5. Montar novo estado base antes de aplicar efeitos
  // -------------------
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
    construcoes: { ...currentState.construcoes }, // Inicializa corretamente
    pesquisa,
    filaConstrucoes: novaFila,
    filaMissoes: filaMissoesNova,       // 🔥 mantém a fila atualizada
    exploradores: [...(currentState.exploradores || [])], // para liberar depois
    relatoriosMissoes: [...(currentState.relatoriosMissoes || [])],
  };

  construcoesFinalizadas.forEach((c) => {
    const tipo = c.id;

    const dadosConstrucao = buildings[tipo];
    if (!dadosConstrucao) {
      log.push(`Erro: construção com id "${tipo}" não encontrada.`);
      return;
    }

    if (!novoEstado.construcoes[tipo]) {
      novoEstado.construcoes[tipo] = 0;
    }

    novoEstado.construcoes[tipo] += 1;

    if (dadosConstrucao.efeitos?.bonusComida) {
      novoEstado.comida += dadosConstrucao.efeitos.bonusComida;
    }

    log.push(`🏗️ ${dadosConstrucao.nome} finalizada!`);
  });

  // -------------------
  // 6. Finalização de MISSÕES: liberar exploradores + recompensas
  // -------------------
  if (missoesConcluidas.length > 0) {
    // liberar exploradores
    novoEstado.exploradores = (novoEstado.exploradores || []).map((ex) => {
      const terminou = missoesConcluidas.find((m) => m.explorerId === ex.id);
      if (!terminou) return ex;
      return {
        ...ex,
        status: "disponivel",
        missionId: null,
        updatedAt: Date.now(),
        // aqui daria para aplicar xp/stamina etc.
      };
    });

    // recalc livres em populacao.exploradores (conta “disponivel”)
    const livres = (novoEstado.exploradores || []).filter((e) => e.status === "disponivel").length;
    novoEstado.populacao = {
      ...novoEstado.populacao,
      exploradores: livres,
    };

    // recompensas
    for (const fin of missoesConcluidas) {
      const r = missionRewards[fin.missionId] || {};
      Object.entries(r).forEach(([recurso, qtd]) => {
        if (qtd == null) return;
        if (typeof novoEstado[recurso] === "number") {
          novoEstado[recurso] += qtd;
        } else if (novoEstado[recurso] == null) {
          // cria o campo se não existir (ex.: ouro, reliquias etc.)
          novoEstado[recurso] = qtd;
        } else {
          // se for um tipo diferente, ignora silenciosamente
        }
      });

      // relatório
      novoEstado.relatoriosMissoes.push({
        id: `rel_${fin.id}`,
        explorerId: fin.explorerId,
        missionId: fin.missionId,
        titulo: fin.titulo,
        concluidaEm: Date.now(),
        resultado: "sucesso",
      });

      log.push(`🧭 Missão concluída: ${fin.titulo} (Explorador ${fin.nome}).`);
    }
  }

  return {
    novoEstado,
    eventosOcorridos,
    log,
    novaFila,
  };
}
