export function runSimulationTurn(currentState, parametros, scenario) {
  const log = [];

  let {
    populacao,
    energia,
    agua,
    comida,
    minerais,
    saude,
    sustentabilidade,
    integridadeEstrutural,
    turno,
  } = currentState;

  const { distribuicao, agua: consumoAgua, alocacaoColonos } = parametros;

  const quantidadePorSetor = Object.fromEntries(
  Object.entries(alocacaoColonos).map(([setor, porcentagem]) => [
    setor,
    Math.ceil((porcentagem / 100) * populacao),
  ])
);


  // -------------------
  // 1. Produções básicas com base nos pontos
  // -------------------

  const pontos = distribuicao;

  //Comida
  
  var comidaProduzida = ((quantidadePorSetor.fazenda * 2) * consumoAgua);

  if (pontos.agricultura == 1){
    comidaProduzida = comidaProduzida * 2;
  }

  comidaProduzida = comidaProduzida- populacao
  console.log("comidaProduzida = " + comidaProduzida)

  //Defesa

  var defesa = (quantidadePorSetor.defesa);
  
  if (pontos.defesa == 1){
    defesa = defesa * 2;
  }
  console.log("defesa = " + defesa)

  //Minas

  var mineraisProduzidos = quantidadePorSetor.fazenda * 3;

  if (pontos.minas == 1){
    mineraisProduzidos = mineraisProduzidos * 2;
  }

  
  comida += comidaProduzida;
  log.push(`Produzido ${comidaProduzida.toFixed(1)} de comida.`);

  const mineraisProduzidos = (pontos.minas || 0) * 10;
  minerais += mineraisProduzidos;
  log.push(`Extraído ${mineraisProduzidos} de minerais.`);

  const energiaGerada = (pontos.energia || 0) * 50;
  energia += energiaGerada;
  log.push(`Gerado ${energiaGerada} de energia.`);

  const ganhoSaude = (pontos.saude || 0) * 5;
  saude = Math.min(100, saude + ganhoSaude);
  log.push(`Saúde melhorada em ${ganhoSaude}.`);

  const ganhoSustentabilidade = (pontos.laboratorio || 0) * 3;
  sustentabilidade = Math.min(100, sustentabilidade + ganhoSustentabilidade);
  log.push(`Sustentabilidade aumentada em ${ganhoSustentabilidade}.`);

  const defesaConstrucoes = (pontos.construcao || 0) * 5;
  const defesaBase = (pontos.defesa || 0) * 5;

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
        const dano = 10 - defesaConstrucoes;
        integridadeEstrutural -= dano;
        log.push(`Estrutura danificada em ${dano} pontos.`);
      }

      if (evento.efeito === "ganha_pesquisa") {
        sustentabilidade += 5;
        log.push("Pesquisa acelerada! Sustentabilidade +5");
      }
    }
  });

  // -------------------
  // 3. Alocação de colonos influencia reparos
  // -------------------

  if (alocacaoColonos?.construcao) {
    const reparo = Math.floor(alocacaoColonos.construcao / 10); // cada 10% = +1
    integridadeEstrutural += reparo;
    log.push(`Oficina de Construção restaurou ${reparo} de integridade.`);
  }

  // -------------------
  // 4. Ajustes finais
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

  const novoEstado = {
    turno,
    populacao,
    energia,
    agua,
    comida,
    minerais,
    saude,
    sustentabilidade,
    integridadeEstrutural,
  };

  return {
    novoEstado,
    eventosOcorridos,
    log,
  };
}
