// Arcanos Maiores.
// tom: energia da carta na posição normal (1 favorável, 0 neutra, -1 desafiadora).
// temas: leitura da carta em pé para cada assunto padrão; os demais assuntos usam "normal".
const CARTAS = [
  {
    numero: "0", nome: "O Louco", simbolo: "🎒", tom: 1,
    palavras: ["começo", "espontaneidade", "liberdade"],
    normal: "um novo começo, cheio de coragem e abertura para o desconhecido",
    invertida: "impulsividade, riscos mal calculados e medo de dar o primeiro passo",
    conselho: "confie no salto, mas olhe onde pisa",
    temas: {
      amor: "a chegada de algo novo e leve no coração, ou a chance de recomeçar sem bagagem",
      trabalho: "uma oportunidade inesperada, um projeto novo ou uma mudança de rumo",
      familia: "um período de renovação nos laços, com mais leveza e menos cobrança",
      dinheiro: "vontade de arriscar; há chance de ganho, desde que haja algum planejamento",
      saude: "disposição para começar novos hábitos com entusiasmo"
    }
  },
  {
    numero: "I", nome: "O Mago", simbolo: "🪄", tom: 1,
    palavras: ["ação", "habilidade", "manifestação"],
    normal: "iniciativa, talento e todos os recursos necessários à mão",
    invertida: "manipulação, talentos desperdiçados ou falta de foco",
    conselho: "use o que você já tem; a hora de agir é agora",
    temas: {
      amor: "poder de atração e capacidade de conduzir a relação com clareza",
      trabalho: "habilidade para realizar; é momento de apresentar ideias e tomar a frente",
      familia: "você tem as ferramentas para resolver tensões com diálogo",
      dinheiro: "criatividade para gerar renda e aproveitar recursos",
      saude: "a força de vontade está a seu favor para cuidar de si"
    }
  },
  {
    numero: "II", nome: "A Sacerdotisa", simbolo: "🌙", tom: 0,
    palavras: ["intuição", "mistério", "silêncio"],
    normal: "intuição aguçada, sabedoria interior e segredos a serem revelados",
    invertida: "ignorar a própria intuição, segredos guardados e desconexão interior",
    conselho: "escute mais do que fala; a resposta já está dentro de você",
    temas: {
      amor: "sentimentos não ditos; observe os sinais antes de agir",
      trabalho: "informações ainda ocultas; aguarde antes de decidir",
      familia: "algo não dito pesa no ambiente; sensibilidade ajuda a entender",
      dinheiro: "prudência; nem tudo foi revelado nas propostas",
      saude: "o corpo dá sinais sutis; preste atenção a eles"
    }
  },
  {
    numero: "III", nome: "A Imperatriz", simbolo: "🌾", tom: 1,
    palavras: ["abundância", "fertilidade", "cuidado"],
    normal: "abundância, criatividade e crescimento natural",
    invertida: "dependência, estagnação criativa ou descuido consigo",
    conselho: "cultive com paciência aquilo que deseja ver florescer",
    temas: {
      amor: "afeto, sensualidade e uma relação que cresce e se nutre",
      trabalho: "projetos que prosperam e reconhecimento pela criatividade",
      familia: "acolhimento, cuidado mútuo e possível chegada de alguém",
      dinheiro: "prosperidade e colheita de esforços anteriores",
      saude: "vitalidade e boa relação com o próprio corpo"
    }
  },
  {
    numero: "IV", nome: "O Imperador", simbolo: "👑", tom: 1,
    palavras: ["estrutura", "autoridade", "estabilidade"],
    normal: "ordem, liderança e bases sólidas",
    invertida: "rigidez, autoritarismo ou falta de disciplina",
    conselho: "organize, defina limites e assuma o comando da situação",
    temas: {
      amor: "compromisso e segurança; a relação pede estrutura",
      trabalho: "liderança, promoção ou a necessidade de organizar processos",
      familia: "uma figura de autoridade e regras claras trazem estabilidade",
      dinheiro: "controle financeiro e decisões firmes trazem segurança",
      saude: "rotina e disciplina são o melhor remédio"
    }
  },
  {
    numero: "V", nome: "O Hierofante", simbolo: "🗝️", tom: 0,
    palavras: ["tradição", "ensinamento", "valores"],
    normal: "tradição, orientação de alguém mais experiente e valores compartilhados",
    invertida: "questionar regras, rebeldia ou conselhos que não servem mais",
    conselho: "busque orientação de quem já trilhou esse caminho",
    temas: {
      amor: "compromissos formais, casamento ou valores em comum",
      trabalho: "aprendizado, mentoria e seguir os caminhos estabelecidos",
      familia: "tradições familiares e a sabedoria dos mais velhos",
      dinheiro: "investimentos conservadores e conselhos de especialistas",
      saude: "procure orientação profissional e siga as recomendações"
    }
  },
  {
    numero: "VI", nome: "Os Enamorados", simbolo: "💞", tom: 1,
    palavras: ["escolha", "união", "harmonia"],
    normal: "união, afinidade e uma escolha importante feita com o coração",
    invertida: "indecisão, desequilíbrio nas relações ou valores em conflito",
    conselho: "escolha de acordo com seus valores, não com o medo",
    temas: {
      amor: "conexão verdadeira e harmonia; um momento especial para o casal",
      trabalho: "parcerias favoráveis e uma decisão importante de carreira",
      familia: "reconciliação e harmonia entre as pessoas próximas",
      dinheiro: "uma escolha entre dois caminhos; avalie com calma",
      saude: "equilíbrio entre corpo e emoções"
    }
  },
  {
    numero: "VII", nome: "O Carro", simbolo: "🛡️", tom: 1,
    palavras: ["vitória", "determinação", "movimento"],
    normal: "avanço, conquista e controle da direção",
    invertida: "falta de rumo, forças em conflito ou pressa excessiva",
    conselho: "mantenha o foco e conduza você mesmo o seu caminho",
    temas: {
      amor: "a relação avança; iniciativa traz resultados",
      trabalho: "vitória sobre obstáculos, metas alcançadas ou uma viagem a trabalho",
      familia: "você consegue conciliar interesses diferentes",
      dinheiro: "progresso financeiro com esforço direcionado",
      saude: "recuperação e energia para seguir em frente"
    }
  },
  {
    numero: "VIII", nome: "A Força", simbolo: "🦁", tom: 1,
    palavras: ["coragem", "paciência", "domínio interior"],
    normal: "força interior, compaixão e domínio das emoções",
    invertida: "insegurança, descontrole emocional ou autoestima abalada",
    conselho: "a gentileza vence onde a força bruta falha",
    temas: {
      amor: "paciência e ternura fortalecem o vínculo",
      trabalho: "resiliência para lidar com pressões e pessoas difíceis",
      familia: "calma e compreensão resolvem conflitos",
      dinheiro: "autocontrole nos gastos traz resultados",
      saude: "boa resistência e capacidade de recuperação"
    }
  },
  {
    numero: "IX", nome: "O Eremita", simbolo: "🏮", tom: 0,
    palavras: ["introspecção", "busca", "sabedoria"],
    normal: "recolhimento, reflexão e busca por respostas interiores",
    invertida: "isolamento excessivo, solidão ou fuga dos outros",
    conselho: "reserve um tempo a sós para ouvir a si mesmo",
    temas: {
      amor: "um tempo para entender o que você realmente busca numa relação",
      trabalho: "estudo, especialização ou reavaliação da carreira",
      familia: "necessidade de espaço próprio, sem se afastar de quem ama",
      dinheiro: "cautela e planejamento de longo prazo",
      saude: "descanso e cuidado com a saúde mental"
    }
  },
  {
    numero: "X", nome: "A Roda da Fortuna", simbolo: "☸️", tom: 1,
    palavras: ["ciclos", "destino", "mudança"],
    normal: "mudanças de ciclo, sorte e reviravoltas favoráveis",
    invertida: "resistência à mudança, azar passageiro ou ciclos que se repetem",
    conselho: "acompanhe o movimento da vida em vez de lutar contra ele",
    temas: {
      amor: "encontros do destino e uma virada positiva",
      trabalho: "mudança de fase, novas oportunidades surgindo",
      familia: "o fim de um ciclo difícil e o início de um melhor",
      dinheiro: "sorte e oscilações; aproveite a maré boa",
      saude: "melhora gradual à medida que o ciclo muda"
    }
  },
  {
    numero: "XI", nome: "A Justiça", simbolo: "⚖️", tom: 0,
    palavras: ["equilíbrio", "verdade", "consequência"],
    normal: "equilíbrio, honestidade e colheita justa das próprias ações",
    invertida: "injustiça, desonestidade ou fugir das consequências",
    conselho: "seja honesto e pese bem os dois lados",
    temas: {
      amor: "reciprocidade; a relação pede equilíbrio entre dar e receber",
      trabalho: "contratos, acordos e decisões justas",
      familia: "questões de partilha resolvidas com imparcialidade",
      dinheiro: "questões legais ou documentos; mantenha tudo em ordem",
      saude: "equilíbrio na rotina e nos hábitos"
    }
  },
  {
    numero: "XII", nome: "O Enforcado", simbolo: "🙃", tom: 0,
    palavras: ["pausa", "entrega", "novo olhar"],
    normal: "pausa necessária, sacrifício e ver as coisas por outro ângulo",
    invertida: "estagnação, sacrifícios inúteis ou resistência a aceitar",
    conselho: "às vezes, esperar é a ação mais sábia",
    temas: {
      amor: "a relação está em suspenso; mude a forma de enxergá-la",
      trabalho: "projetos parados; use o tempo para repensar a estratégia",
      familia: "ceder um pouco pode destravar a situação",
      dinheiro: "adie decisões importantes até ter mais clareza",
      saude: "o corpo pede pausa e descanso"
    }
  },
  {
    numero: "XIII", nome: "A Morte", simbolo: "🦋", tom: 0,
    palavras: ["transformação", "fim", "renascimento"],
    normal: "o fim de uma fase e uma transformação profunda",
    invertida: "medo de mudar, apego ao passado e transições arrastadas",
    conselho: "deixe ir o que já cumpriu seu papel",
    temas: {
      amor: "transformação na relação: algo termina para algo novo nascer",
      trabalho: "encerramento de um ciclo profissional e abertura para outro",
      familia: "mudanças na dinâmica familiar que trazem renovação",
      dinheiro: "fim de uma fonte de renda ou de um hábito de consumo",
      saude: "abandonar hábitos antigos em favor de novos"
    }
  },
  {
    numero: "XIV", nome: "A Temperança", simbolo: "🏺", tom: 1,
    palavras: ["moderação", "paciência", "cura"],
    normal: "equilíbrio, moderação e harmonia entre opostos",
    invertida: "excessos, impaciência ou desequilíbrio",
    conselho: "encontre o meio-termo e dê tempo ao tempo",
    temas: {
      amor: "harmonia e paciência; a relação amadurece com calma",
      trabalho: "cooperação e bom equilíbrio entre trabalho e vida pessoal",
      familia: "mediação e reconciliação",
      dinheiro: "gastos equilibrados e crescimento gradual",
      saude: "cura e restauração do equilíbrio"
    }
  },
  {
    numero: "XV", nome: "O Diabo", simbolo: "⛓️", tom: -1,
    palavras: ["apego", "tentação", "prisão"],
    normal: "apegos, vícios e situações que aprisionam",
    invertida: "libertação, quebra de correntes e retomada do controle",
    conselho: "reconheça o que te prende; a chave está com você",
    temas: {
      amor: "paixão intensa, mas também ciúme, possessividade ou dependência",
      trabalho: "um ambiente que aprisiona ou ambição em excesso",
      familia: "padrões repetidos e relações de controle",
      dinheiro: "dívidas, gastos por impulso ou apego material",
      saude: "atenção a vícios e hábitos nocivos"
    }
  },
  {
    numero: "XVI", nome: "A Torre", simbolo: "⚡", tom: -1,
    palavras: ["ruptura", "revelação", "abalo"],
    normal: "mudanças súbitas, rupturas e verdades que vêm à tona",
    invertida: "evitar um desastre, adiar o inevitável ou uma mudança interna",
    conselho: "o que cai era frágil; reconstrua em bases mais firmes",
    temas: {
      amor: "uma crise ou revelação que muda tudo na relação",
      trabalho: "mudanças inesperadas na empresa ou na carreira",
      familia: "conflitos abertos que, apesar de dolorosos, limpam o ambiente",
      dinheiro: "despesas inesperadas; tenha uma reserva",
      saude: "um alerta para não ignorar sintomas"
    }
  },
  {
    numero: "XVII", nome: "A Estrela", simbolo: "⭐", tom: 1,
    palavras: ["esperança", "inspiração", "renovação"],
    normal: "esperança, fé no futuro e renovação",
    invertida: "desânimo, falta de fé ou desconexão dos próprios sonhos",
    conselho: "mantenha a esperança acesa; você está no caminho certo",
    temas: {
      amor: "esperança renovada e um amor sincero",
      trabalho: "inspiração, visibilidade e reconhecimento",
      familia: "cura de mágoas e paz no lar",
      dinheiro: "perspectivas otimistas e melhora gradual",
      saude: "recuperação e renovação da energia"
    }
  },
  {
    numero: "XVIII", nome: "A Lua", simbolo: "🌕", tom: -1,
    palavras: ["ilusão", "medo", "inconsciente"],
    normal: "incertezas, ilusões e medos que distorcem a realidade",
    invertida: "a verdade vindo à tona e a confusão se dissipando",
    conselho: "não decida no escuro; espere a névoa baixar",
    temas: {
      amor: "insegurança, fantasias ou algo não revelado",
      trabalho: "falta de clareza; cuidado com promessas vagas",
      familia: "mal-entendidos e emoções à flor da pele",
      dinheiro: "cuidado com golpes e negócios pouco claros",
      saude: "ansiedade e sono agitado; cuide da mente"
    }
  },
  {
    numero: "XIX", nome: "O Sol", simbolo: "☀️", tom: 1,
    palavras: ["alegria", "sucesso", "vitalidade"],
    normal: "sucesso, alegria e clareza",
    invertida: "alegria temporariamente ofuscada ou otimismo excessivo",
    conselho: "mostre-se como é; seu brilho abre portas",
    temas: {
      amor: "felicidade, sinceridade e um relacionamento luminoso",
      trabalho: "sucesso, reconhecimento e realização",
      familia: "alegria, celebrações e bons momentos juntos",
      dinheiro: "prosperidade e resultados positivos",
      saude: "vitalidade e ótima energia"
    }
  },
  {
    numero: "XX", nome: "O Julgamento", simbolo: "📯", tom: 1,
    palavras: ["despertar", "chamado", "renascimento"],
    normal: "despertar, avaliação honesta e um chamado para renascer",
    invertida: "autocrítica excessiva, dúvida ou ignorar um chamado",
    conselho: "perdoe o passado e responda ao que a vida está pedindo",
    temas: {
      amor: "segunda chance ou uma reavaliação sincera da relação",
      trabalho: "uma nova vocação ou o resultado de uma avaliação",
      familia: "perdão e reaproximação",
      dinheiro: "hora de revisar as finanças e tomar decisões conscientes",
      saude: "renovação e decisão de mudar hábitos"
    }
  },
  {
    numero: "XXI", nome: "O Mundo", simbolo: "🌍", tom: 1,
    palavras: ["conclusão", "realização", "plenitude"],
    normal: "realização, conclusão de um ciclo e plenitude",
    invertida: "algo inacabado, atrasos ou falta de fechamento",
    conselho: "celebre o caminho percorrido e prepare o próximo",
    temas: {
      amor: "plenitude e uma relação que se completa",
      trabalho: "conclusão de projetos e conquista de objetivos",
      familia: "harmonia e senso de pertencimento",
      dinheiro: "estabilidade e metas financeiras atingidas",
      saude: "bem-estar integral"
    }
  }
];

const ASSUNTOS = [
  { id: "amor", nome: "Amor", icone: "❤️" },
  { id: "trabalho", nome: "Trabalho", icone: "💼" },
  { id: "familia", nome: "Família", icone: "🏡" },
  { id: "dinheiro", nome: "Dinheiro", icone: "💰" },
  { id: "saude", nome: "Saúde", icone: "🌿" },
  { id: "amizades", nome: "Amizades", icone: "🤝" },
  { id: "espiritualidade", nome: "Espiritualidade", icone: "🔮" }
];

const POSICOES = [
  { nome: "Passado", descricao: "o que trouxe você até aqui" },
  { nome: "Presente", descricao: "a energia do momento" },
  { nome: "Futuro", descricao: "a tendência do que está por vir" }
];
