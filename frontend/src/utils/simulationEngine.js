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
      Math.ceil((porcentagem / 100) * populacao),
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

  comidaProduzida = comidaProduzida - populacao;
  comida = comida + comidaProduzida;
  console.log("comidaProduzida = " + comidaProduzida);

  //#region Defesa

  var defesaBase = alocacaoColonos.defesa;

  if (pontos.defesa == 1) {
    defesaBase = defesaBase + 15; // Aumenta a defesaBase em 15%
  }
  console.log("defesaBase = " + defesaBase);

  //Minas

  var mineraisProduzidos = quantidadePorSetor.minas * 10;

  if (pontos.minas == 1) {
    mineraisProduzidos = mineraisProduzidos * 2;
  }

  console.log("Produção de Minas = " + mineraisProduzidos);

  //Laboratorio

  var cienciaProduzida = quantidadePorSetor.laboratorio / 2;

  if (pontos.laboratorio == 1) {
    cienciaProduzida = cienciaProduzida * 2;
  }

  ciencia = ciencia + cienciaProduzida;
  console.log("cienciaProduzida = " + cienciaProduzida);

  //Construção

  var reparo = Math.floor(quantidadePorSetor.construcao / 10); // cada 10% = +1
  integridadeEstrutural += reparo;

  console.log("Reparo em % = " + reparo);
  log.push(`Oficina de Construção restaurou ${reparo} de integridade.`);

  //Saude

  var ganhoSaude = Math.floor(quantidadePorSetor.saude / 10); // cada 10% = +1

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
    defesaBase = Math.floor(defesaBase * 0.9);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.9);
    reparo = Math.floor(reparo * 0.9);
    agua = Math.floor(agua * 0.9);
    energia = Math.floor(energia * 0.9);
    saude = Math.floor(saude * 0.9);

    log.push("Baixa sustentabilidade (<= 25): Eficiência reduzida em 10%");
  } else if (sustentabilidade <= 50) {
    comidaProduzida = Math.floor(comidaProduzida * 0.95); // -5%
    defesaBase = Math.floor(defesaBase * 0.95);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 0.95);
    reparo = Math.floor(reparo * 0.95);
    energia = Math.floor(energia * 0.95);
    saude = Math.floor(saude * 0.95);

    log.push("Sustentabilidade moderada (<= 50): Eficiência reduzida em 5%");
  } else if (sustentabilidade < 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.05); // +5%
    defesaBase = Math.floor(defesaBase * 1.05);
    mineraisProduzidos = Math.floor(mineraisProduzidos * 1.05);
    reparo = Math.floor(reparo * 1.05);
    energia = Math.floor(energia * 1.05);
    saude = Math.floor(saude * 1.05);

    log.push("Boa sustentabilidade (51 a 99): Eficiência aumentada em 5%");
  } else if (sustentabilidade === 100) {
    comidaProduzida = Math.floor(comidaProduzida * 1.1); // +10%
    defesaBase = Math.floor(defesaBase * 1.1);
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
    const chanceReduzida = chanceBase - defesaBase;
    const sorte = Math.random() * 100;

    if (sorte < chanceReduzida) {
      eventosOcorridos.push(evento.nome);
      log.push(`Evento: ${evento.nome}`);

      if (evento.efeito === "quebra_estruturas") {
        let dano = 10 - quantidadePorSetor.defesa;

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

  if (comida < populacao) {
    populacao -= 5;
    saude -= 10;
    log.push("Fome! A população e saúde caíram.");
  } else {
    populacao += 2;
  }

  saude = Math.max(0, Math.min(100, saude));
  sustentabilidade = Math.max(0, Math.min(100, sustentabilidade));
  turno += 1;

  // 5. Criar novo estado antes de aplicar efeitos
  const novoEstado = {
    _id,
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
  };

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

  return {
    novoEstado,
    eventosOcorridos,
    log,
    novaFila,
  };
}
