// Interpretação das leituras: significado de cada carta, combinações entre as cartas
// e o texto personalizado (nome, estado de espírito, pergunta e assunto).

// ---------- Dados ----------

// Por carta (na ordem de CARTAS): pergunta de reflexão, ação prática, tema curto quando sai
// invertida (usado no resumo da tiragem), ritmo e grupo temático.
// ritmo: velocidade típica com que a carta se manifesta (rapido, medio, lento).
const APROFUNDAMENTO = [
  { reflexao: "O que você faria agora se não tivesse medo de errar?", acao: "Dê um passo pequeno e novo, algo que você nunca tentou, sem esperar ter certeza absoluta.", invertida: "impulsividade ou medo de começar", ritmo: "rapido", grupo: "acao" },
  { reflexao: "Quais recursos e talentos você já tem e ainda não está usando?", acao: "Liste três habilidades suas e escolha uma para aplicar nesta questão ainda esta semana.", invertida: "talentos desperdiçados", ritmo: "rapido", grupo: "acao" },
  { reflexao: "O que a sua intuição vem dizendo e você tem preferido ignorar?", acao: "Antes de dormir, escreva a primeira resposta que vier à mente sobre a sua pergunta.", invertida: "intuição ignorada", ritmo: "lento", grupo: "interior" },
  { reflexao: "O que você está cultivando e precisa de mais cuidado para crescer?", acao: "Dedique tempo a algo que te nutre: natureza, arte, boa comida ou pessoas queridas.", invertida: "criatividade estagnada", ritmo: "medio", grupo: "afeto" },
  { reflexao: "Onde falta estrutura ou limite na sua vida hoje?", acao: "Defina uma regra clara ou um prazo concreto para esta questão, e cumpra.", invertida: "rigidez ou falta de disciplina", ritmo: "lento", grupo: "estrutura" },
  { reflexao: "Quem, com mais experiência, poderia te orientar neste momento?", acao: "Peça conselho a alguém de confiança que já passou por algo parecido.", invertida: "regras que já não servem", ritmo: "lento", grupo: "estrutura" },
  { reflexao: "A sua escolha está alinhada com o que você valoriza de verdade?", acao: "Escreva os prós e contras de cada opção e, no fim, pergunte qual delas te deixa em paz.", invertida: "indecisão", ritmo: "rapido", grupo: "afeto" },
  { reflexao: "Para onde você quer ir, exatamente?", acao: "Defina uma meta clara e um primeiro movimento para os próximos sete dias.", invertida: "falta de rumo", ritmo: "rapido", grupo: "acao" },
  { reflexao: "Onde a gentileza funcionaria melhor do que a força?", acao: "Na próxima situação tensa, respire antes de responder e escolha a calma.", invertida: "insegurança", ritmo: "medio", grupo: "acao" },
  { reflexao: "Quando foi a última vez que você ficou em silêncio para se ouvir?", acao: "Reserve um momento a sós, sem celular, só para pensar nesta questão.", invertida: "isolamento", ritmo: "lento", grupo: "interior" },
  { reflexao: "Que ciclo está terminando na sua vida, e qual está começando?", acao: "Aproveite a mudança de maré: diga sim a uma oportunidade que aparecer.", invertida: "resistência à mudança", ritmo: "rapido", grupo: "transformacao" },
  { reflexao: "Você está agindo com justiça com os outros e consigo?", acao: "Coloque os fatos no papel e tome a decisão que você conseguiria defender com honestidade.", invertida: "desequilíbrio e injustiça", ritmo: "lento", grupo: "estrutura" },
  { reflexao: "O que muda se você olhar esta situação por outro ângulo?", acao: "Adie uma decisão por alguns dias e observe o que se revela nesse intervalo.", invertida: "estagnação", ritmo: "lento", grupo: "interior" },
  { reflexao: "O que já cumpriu seu papel e você ainda insiste em manter?", acao: "Encerre conscientemente algo que acabou: uma pendência, um hábito ou uma expectativa.", invertida: "medo de mudar", ritmo: "medio", grupo: "transformacao" },
  { reflexao: "Onde está o meio-termo que você ainda não tentou?", acao: "Troque um excesso da sua rotina por uma versão mais moderada.", invertida: "excessos", ritmo: "lento", grupo: "afeto" },
  { reflexao: "O que te prende, e o que você ganha continuando assim?", acao: "Identifique um apego ou hábito que te limita e reduza-o um pouco a cada dia.", invertida: "libertação de apegos", ritmo: "medio", grupo: "sombra" },
  { reflexao: "Que estrutura frágil precisa cair para algo mais verdadeiro nascer?", acao: "Encare de frente a verdade que você tem evitado, mesmo que seja desconfortável.", invertida: "mudança interna, sem ruptura", ritmo: "rapido", grupo: "transformacao" },
  { reflexao: "O que te dá esperança, mesmo nos dias difíceis?", acao: "Escreva um desejo para os próximos meses e um pequeno gesto que te aproxime dele.", invertida: "desânimo", ritmo: "medio", grupo: "luz" },
  { reflexao: "Quais medos estão distorcendo a forma como você vê esta situação?", acao: "Separe fatos de suposições: escreva o que você sabe e o que está apenas imaginando.", invertida: "confusão se dissipando", ritmo: "medio", grupo: "sombra" },
  { reflexao: "O que em você merece ser mostrado ao mundo?", acao: "Celebre uma conquista recente, por menor que seja, e compartilhe com alguém.", invertida: "alegria ofuscada", ritmo: "rapido", grupo: "luz" },
  { reflexao: "Que chamado interno você vem adiando?", acao: "Perdoe um erro do passado, seu ou de alguém, e siga mais leve.", invertida: "autocrítica excessiva", ritmo: "medio", grupo: "transformacao" },
  { reflexao: "O que você já conquistou e ainda não reconheceu?", acao: "Feche um ciclo com um gesto simples: agradeça, organize e planeje o próximo passo.", invertida: "ciclos inacabados", ritmo: "lento", grupo: "luz" }
];

// Quando duas ou mais cartas da tiragem são do mesmo grupo.
const GRUPOS = {
  acao: "Há muita energia de ação nesta tiragem. As cartas pedem iniciativa: esperar demais é o maior risco agora.",
  interior: "Predominam cartas de introspecção. A resposta vem mais de dentro do que de fora; antes de agir, silencie e observe.",
  afeto: "As cartas falam de vínculos e cuidado. As pessoas ao seu redor são parte central desta questão.",
  estrutura: "Aparecem cartas de estrutura e regras. Organização, acordos e limites claros vão decidir o resultado.",
  transformacao: "Duas ou mais cartas de transformação: você está no meio de uma mudança maior do que parece. Resistir cansa mais do que acompanhar.",
  sombra: "As cartas de sombra aparecem juntas. Medos, apegos ou ilusões podem estar distorcendo sua visão; dar nome ao que assusta já tira parte do peso.",
  luz: "Cartas de luz em destaque: há esperança e clareza disponíveis. Permita-se acreditar no que está dando certo."
};

// Combinações clássicas entre duas cartas (pelos índices em CARTAS), em qualquer posição.
const COMBINACOES = [
  [16, 17, "A Torre e a Estrela contam uma história clássica: depois do abalo vem a renovação. O que desmorona abre espaço para a esperança."],
  [13, 20, "A Morte e o Julgamento: um ciclo se encerra de verdade e você renasce com mais consciência."],
  [18, 19, "A Lua e o Sol juntos: a confusão atual tende a se dissipar. Não decida no escuro; espere a luz chegar."],
  [6, 15, "Os Enamorados e o Diabo: atenção à diferença entre amor e apego. Alguma escolha pode estar sendo guiada por desejo ou dependência."],
  [3, 4, "A Imperatriz e o Imperador: o resultado vem de unir cuidado e organização, afeto e firmeza."],
  [1, 2, "O Mago e a Sacerdotisa: ação e intuição trabalhando juntas. Siga o que você sente, mas coloque em prática."],
  [0, 21, "O Louco e o Mundo, o começo e o fim da jornada lado a lado: você fecha um ciclo e, ao mesmo tempo, começa outro."],
  [10, 21, "A Roda da Fortuna e o Mundo: um ciclo se completa com a sorte a favor."],
  [2, 9, "A Sacerdotisa e o Eremita: um período de silêncio e escuta interna. As respostas não virão de fora."],
  [7, 8, "O Carro e a Força: determinação com autocontrole. Você tem força para vencer, desde que não atropele ninguém no caminho."],
  [11, 20, "A Justiça e o Julgamento: decisões importantes, avaliações e consequências. Seja honesto consigo."],
  [12, 13, "O Enforcado e a Morte: a pausa prepara uma transformação. Aceitar o fim é o que libera o movimento."],
  [17, 19, "A Estrela e o Sol, uma das combinações mais luminosas do tarot: esperança que se realiza."],
  [15, 16, "O Diabo e a Torre: correntes que se rompem de forma brusca. A libertação pode vir por meio de um choque."],
  [6, 14, "Os Enamorados e a Temperança: harmonia nas relações e escolhas feitas com equilíbrio."],
  [5, 6, "O Hierofante e os Enamorados: compromisso, união formal ou valores que finalmente se alinham."],
  [2, 18, "A Sacerdotisa e a Lua: a intuição está à flor da pele, mas cuidado para não confundir intuição com medo."],
  [4, 7, "O Imperador e o Carro: liderança e conquista. É hora de assumir o comando."],
  [0, 1, "O Louco e o Mago: um começo com ferramentas nas mãos. A ideia está pronta para sair do papel."],
  [9, 12, "O Eremita e o Enforcado: um tempo de espera e recolhimento que não é perda de tempo, é preparação."]
];

// Como a pessoa chega à leitura.
const SENTIMENTOS = [
  {
    id: "ansiedade", nome: "Ansiedade",
    abertura: "Você chega com o coração acelerado, e tudo bem. Leia com calma: as cartas não mostram um destino fixo, mostram tendências que você pode trabalhar.",
    fecho: "Antes de qualquer decisão, respire fundo e dê um passo pequeno de cada vez. A pressa é a pior conselheira agora."
  },
  {
    id: "esperanca", nome: "Esperança",
    abertura: "Você chega com esperança, e essa energia já é metade do caminho.",
    fecho: "Mantenha essa esperança, mas ancore-a em atitudes concretas: é assim que ela vira realidade."
  },
  {
    id: "duvida", nome: "Dúvida",
    abertura: "Você chega com dúvidas, buscando clareza. As cartas não decidem por você, mas iluminam as opções.",
    fecho: "Quando a dúvida voltar, lembre do conselho do Presente: ele é o seu ponto de apoio."
  },
  {
    id: "tristeza", nome: "Tristeza",
    abertura: "Você chega num momento delicado. Esta leitura é um convite ao acolhimento, não ao julgamento.",
    fecho: "Seja gentil consigo. Nenhuma carta pede que você resolva tudo hoje, e se o peso estiver grande, conversar com alguém de confiança ajuda muito."
  },
  {
    id: "determinacao", nome: "Determinação",
    abertura: "Você chega com vontade de agir, e as cartas vão ajudar a mirar essa energia no alvo certo.",
    fecho: "Canalize essa determinação no passo que as cartas apontam, sem se dispersar."
  },
  {
    id: "curiosidade", nome: "Curiosidade",
    abertura: "Você chega com curiosidade e mente aberta, o melhor estado para uma leitura.",
    fecho: "Guarde esta leitura e volte a ela daqui a algumas semanas para ver o que fez sentido."
  }
];

// Dica prática por assunto, conforme o resultado provável.
const DICAS = {
  amor: {
    favoravel: "Demonstre o que sente com gestos simples nesta semana: uma mensagem, um convite, um elogio sincero.",
    equilibrado: "Converse com franqueza sobre expectativas. Muita coisa se resolve quando os dois lados dizem o que querem.",
    desafiador: "Observe se você está dando mais do que recebe. Cuidar de si também é cuidar da relação."
  },
  trabalho: {
    favoravel: "Apresente aquela ideia ou peça aquele retorno: o momento favorece quem se mostra.",
    equilibrado: "Organize as prioridades da próxima semana e concentre-se no que depende só de você.",
    desafiador: "Evite decisões no calor do momento. Planeje, registre o que acontece e busque aliados."
  },
  familia: {
    favoravel: "Proponha um encontro ou uma refeição juntos; o clima favorece a aproximação.",
    equilibrado: "Escolha uma conversa importante e tenha-a com calma, sem tentar resolver tudo de uma vez.",
    desafiador: "Estabeleça limites com carinho. Dizer “não” também protege os laços."
  },
  dinheiro: {
    favoravel: "Aproveite a boa fase para criar ou reforçar uma reserva, em vez de gastar tudo.",
    equilibrado: "Revise os gastos do último mês e corte um item que não faz falta.",
    desafiador: "Adie compras grandes e investimentos arriscados; priorize quitar pendências."
  },
  saude: {
    favoravel: "Aproveite a disposição para começar um hábito novo, como uma caminhada diária.",
    equilibrado: "Cuide do básico: sono, água e pausas ao longo do dia fazem mais diferença do que parece.",
    desafiador: "Não ignore os sinais do corpo; se algo preocupa, procure um profissional de saúde."
  },
  amizades: {
    favoravel: "Retome o contato com alguém de quem sente falta; a conversa tende a fluir.",
    equilibrado: "Observe quais amizades te fortalecem e dedique mais tempo a elas.",
    desafiador: "Afaste-se com educação de quem drena sua energia, sem precisar de rompimentos dramáticos."
  },
  espiritualidade: {
    favoravel: "Reserve alguns minutos por dia para gratidão, meditação ou oração.",
    equilibrado: "Anote seus sonhos e intuições por uma semana e veja que padrões aparecem.",
    desafiador: "Volte ao básico: silêncio, respiração e presença. Não busque respostas grandes agora."
  },
  // Assunto digitado pelo usuário; {assunto} é trocado pelo texto dele.
  livre: {
    favoravel: "Dê um passo concreto em direção a {assunto} nos próximos dias; o momento está a seu favor.",
    equilibrado: "Liste o que depende de você em {assunto} e comece pelo menor passo possível.",
    desafiador: "Antes de avançar em {assunto}, pense no que pode dar errado e prepare um plano B."
  }
};

const RITMOS = {
  rapido: "de forma rápida, em questão de semanas",
  medio: "ao longo dos próximos meses",
  lento: "num prazo mais longo, que pede paciência"
};

// ---------- Significado de cada carta ----------

// Invertida, uma carta favorável perde força e uma neutra pesa;
// cartas desafiadoras invertidas indicam libertação do problema.
function tomEfetivo({ carta, invertida }) {
  if (!invertida) return carta.tom;
  return carta.tom === 0 ? -1 : 0;
}

// comGeral = false omite o significado geral invertido, para quem já o exibe à parte.
function textoDaCarta({ carta, invertida }, assunto, comGeral = true) {
  if (!assunto.padrao) {
    const sentido = invertida ? carta.invertida : carta.normal;
    return `Em relação a “${escaparHtml(assunto.nome)}”, a carta fala de ${sentido}.`;
  }
  const doTema = carta.temas[assunto.id];
  if (invertida) {
    let complemento = "";
    if (doTema) {
      const area = assunto.nome.toLowerCase();
      complemento = carta.tom < 0
        ? ` Em ${area}, a sombra desta carta (${doTema}) começa a perder força.`
        : ` Em ${area}, o lado luminoso desta carta (${doTema}) ainda encontra resistência.`;
    }
    return comGeral ? `Invertida, aponta ${carta.invertida}.${complemento}` : complemento.trim();
  }
  return maiuscula(doTema || carta.normal) + ".";
}

// Reflexão e ação prática de uma carta.
function praticaDaCarta({ carta }) {
  const extra = APROFUNDAMENTO[carta.indice];
  return `
    <p class="reflexao">${extra.reflexao}</p>
    <p><strong>Na prática:</strong> ${extra.acao}</p>`;
}

// ---------- Leitura personalizada ----------

function nomeDoAssunto(assunto) {
  return assunto.padrao ? assunto.nome.toLowerCase() : `“${escaparHtml(assunto.nome)}”`;
}

function nomeDaPessoa(ctx) {
  return ctx.nome ? escaparHtml(ctx.nome) : "";
}

// Linha com o assunto e a pergunta, e o parágrafo de abertura personalizado.
function aberturaDaLeitura(ctx) {
  const linha = `<p class="contexto">Assunto: <strong>${escaparHtml(ctx.assunto.nome)}</strong>` +
    (ctx.pergunta ? ` · Pergunta: <em>${escaparHtml(ctx.pergunta)}</em>` : "") + "</p>";

  const sentimento = SENTIMENTOS.find((s) => s.id === ctx.sentimento);
  const nome = nomeDaPessoa(ctx);
  let texto = sentimento
    ? sentimento.abertura
    : `Estas são as suas três cartas sobre ${nomeDoAssunto(ctx.assunto)}.`;
  if (nome) texto = `${nome}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;
  return `${linha}<p class="abertura">${texto}</p>`;
}

function classificar(cartas) {
  // O futuro pesa mais por ser a tendência da questão.
  const pesos = [1, 1, 1.5];
  const pontos = cartas.reduce((soma, s, i) => soma + tomEfetivo(s) * pesos[i], 0);
  if (pontos >= 1.5) return { tom: "favoravel", rotulo: "Favorável" };
  if (pontos <= -1.5) return { tom: "desafiador", rotulo: "Desafiador" };
  return { tom: "equilibrado", rotulo: "Em equilíbrio" };
}

function textoDoTom(tom, assunto) {
  const nome = nomeDoAssunto(assunto);
  return {
    favoravel: `As energias são positivas para ${nome}. O caminho tende a se abrir, e suas atitudes estão alinhadas com o que você deseja.`,
    equilibrado: `A situação em ${nome} está em aberto, com forças que se equilibram. O resultado depende muito das escolhas que você fizer a partir de agora.`,
    desafiador: `As cartas mostram obstáculos em ${nome}. Não é um “não” definitivo, mas um alerta: há padrões a rever e decisões que pedem cautela antes de avançar.`
  }[tom];
}

function narrativa(cartas) {
  const trechos = cartas.map(({ carta, invertida }) =>
    invertida ? APROFUNDAMENTO[carta.indice].invertida : carta.palavras[0]);
  return `Você vem de um período marcado por <strong>${trechos[0]}</strong>, vive agora um momento de <strong>${trechos[1]}</strong> e caminha para <strong>${trechos[2]}</strong>.`;
}

// Leituras do conjunto: trajetória, cartas invertidas, sequência numérica, grupos e combinações.
function padroes(cartas) {
  const achados = [];
  const [passado, , futuro] = cartas.map(tomEfetivo);

  if (futuro > passado) {
    achados.push("A energia melhora do Passado para o Futuro: o que foi difícil tende a ficar para trás.");
  } else if (futuro < passado) {
    achados.push("A energia cai do Passado para o Futuro. Não é uma condenação, é um aviso para não se acomodar no que já deu certo.");
  } else {
    achados.push("A energia se mantém estável ao longo da tiragem: o padrão atual tende a continuar, a menos que você mude algo.");
  }

  const invertidas = cartas.filter((s) => s.invertida).length;
  if (invertidas === 0) {
    achados.push("Todas as cartas saíram em pé: as energias fluem sem grandes bloqueios.");
  } else if (invertidas === 2) {
    achados.push("Duas cartas invertidas mostram energia travada. Parte do trabalho agora é interno.");
  } else if (invertidas === 3) {
    achados.push("As três cartas invertidas pedem uma revisão profunda: o que está travado precisa de atenção antes de novos passos.");
  }

  const numeros = cartas.map((s) => s.carta.indice);
  if (numeros[0] < numeros[1] && numeros[1] < numeros[2]) {
    achados.push("Os números das cartas crescem do Passado ao Futuro, sinal de amadurecimento e progresso natural.");
  } else if (numeros[0] > numeros[1] && numeros[1] > numeros[2]) {
    achados.push("Os números das cartas diminuem do Passado ao Futuro: você pode estar revisitando lições antigas antes de seguir.");
  }

  const contagem = {};
  for (const s of cartas) {
    const grupo = APROFUNDAMENTO[s.carta.indice].grupo;
    contagem[grupo] = (contagem[grupo] || 0) + 1;
  }
  for (const [grupo, total] of Object.entries(contagem)) {
    if (total >= 2) achados.push(GRUPOS[grupo]);
  }

  for (const [a, b, texto] of COMBINACOES) {
    if (numeros.includes(a) && numeros.includes(b)) achados.push(texto);
  }
  return achados;
}

function tipoDePergunta(pergunta) {
  const p = " " + semAcentos(pergunta) + " ";
  if (/\bquando\b|\bquanto tempo\b|\bdemora\b/.test(p)) return "tempo";
  if (/\bpor ?que\b|\bpq\b/.test(p)) return "causa";
  if (/\bcomo\b|\bo que (devo|posso|preciso) fazer\b/.test(p)) return "caminho";
  if (/\b(devo|vale a pena|sera que|vai|vou|consigo|conseguirei|da certo|dar certo|tenho chance|e possivel|ele|ela)\b/.test(p)) return "simnao";
  return "aberta";
}

function ritmoDoFuturo(futuro) {
  const ritmo = RITMOS[APROFUNDAMENTO[futuro.carta.indice].ritmo];
  return futuro.invertida ? `${ritmo}, mas com algum atraso` : ritmo;
}

function respostaDaPergunta(cartas, pergunta, tom) {
  const [passado, presente, futuro] = cartas;
  switch (tipoDePergunta(pergunta)) {
    case "simnao":
      return {
        favoravel: `A tendência é de <strong>sim</strong>. ${futuro.carta.nome} no Futuro sustenta esse caminho, desde que você siga o conselho: ${futuro.carta.conselho}.`,
        desafiador: `Neste momento, a tendência é de <strong>não</strong>, ou de <strong>ainda não</strong>. ${presente.carta.nome} no Presente mostra o que precisa mudar antes: ${presente.carta.conselho}.`,
        equilibrado: `A resposta não é um sim ou não fechado: <strong>depende de você</strong>. O ponto de virada está no Presente, com ${presente.carta.nome}: ${presente.carta.conselho}.`
      }[tom];
    case "tempo":
      return `O Futuro, com ${futuro.carta.nome}, indica que as coisas tendem a se mover <strong>${ritmoDoFuturo(futuro)}</strong>.`;
    case "causa":
      return `A raiz está no Passado: ${passado.carta.nome} aponta para ${passado.invertida ? passado.carta.invertida : passado.carta.normal}. Entender isso ajuda a não repetir o padrão.`;
    case "caminho": {
      const acao = APROFUNDAMENTO[presente.carta.indice].acao;
      return `O caminho começa no Presente: ${acao.charAt(0).toLowerCase()}${acao.slice(1)} Depois, no rumo do Futuro, ${futuro.carta.conselho}.`;
    }
    default:
      return `As cartas respondem destacando <strong>${presente.carta.palavras[0]}</strong>, a energia do Presente. É aí que está a chave agora: ${presente.carta.conselho}.`;
  }
}

function dicaDoAssunto(assunto, tom) {
  if (assunto.padrao) return DICAS[assunto.id][tom];
  return DICAS.livre[tom].replace("{assunto}", `“${escaparHtml(assunto.nome)}”`);
}

// Resultado provável e leitura combinada de três cartas, na ordem Passado, Presente, Futuro.
// ctx: { assunto, pergunta, nome, sentimento }.
function sintese(cartas, ctx) {
  const { tom, rotulo } = classificar(cartas);
  const sentimento = SENTIMENTOS.find((s) => s.id === ctx.sentimento);
  const nome = nomeDaPessoa(ctx);

  const achados = padroes(cartas).map((t) => `<li>${t}</li>`).join("");
  const tipo = ctx.pergunta ? tipoDePergunta(ctx.pergunta) : null;
  const resposta = ctx.pergunta
    ? `<h4>Resposta à sua pergunta</h4><p>${respostaDaPergunta(cartas, ctx.pergunta, tom)}</p>`
    : "";

  const conselho = [
    `${maiuscula(cartas[2].carta.conselho)}.`,
    dicaDoAssunto(ctx.assunto, tom),
    sentimento ? sentimento.fecho : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="sintese">
      <h3>Resultado provável <span class="selo ${tom}">${rotulo}</span></h3>
      <p>${narrativa(cartas)} ${textoDoTom(tom, ctx.assunto)}</p>
      ${resposta}
      <h4>O que as cartas dizem juntas</h4>
      <ul class="achados">${achados}</ul>
      ${tipo === "tempo" ? "" : `<h4>Ritmo</h4>
      <p>A tendência é que esta questão se desenvolva ${ritmoDoFuturo(cartas[2])}.</p>`}
      <h4>${nome ? `Conselho para você, ${nome}` : "Conselho para você"}</h4>
      <p>${conselho}</p>
    </div>`;
}
