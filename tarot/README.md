# Tarot das Três Cartas

Aplicativo web estático (HTML, CSS e JavaScript puro, sem dependências) com três abas:

- **Tirar cartas**: leitura de três cartas — Passado · Presente · Futuro.
- **Consultar tiragem**: o usuário escolhe as três cartas na galeria e recebe a mesma leitura de
  Passado · Presente · Futuro, com o resultado combinado.
- **Glossário**: o significado individual de cada uma das 22 cartas.

## Como usar

### Tirar cartas

1. Abra `index.html` no navegador (funciona com duplo clique, sem servidor).
2. Escolha um assunto padrão (Amor, Trabalho, Família, Dinheiro, Saúde, Amizades, Espiritualidade)
   ou escreva um assunto próprio. A pergunta é opcional.
3. Toque no baralho: as cartas são embaralhadas, três são distribuídas e viram uma a uma.
4. A leitura mostra o significado de cada carta na sua posição e um resultado provável
   (Favorável, Em equilíbrio ou Desafiador), com um conselho final.

### Consultar tiragem

1. Escolha um assunto padrão ou escreva um próprio, e opcionalmente uma pergunta.
2. Busque por nome, número (romano ou arábico) ou palavra-chave e toque em três cartas da galeria:
   a primeira é o Passado, a segunda o Presente e a terceira o Futuro. Tocar de novo numa carta
   escolhida libera a posição, e a próxima carta tocada ocupa a posição vazia.
3. Cada carta aparece com a imagem, o significado geral, o significado para o assunto e um conselho,
   com opção de **Em pé** ou **Invertida**. Sem assunto, cada carta mostra o significado em todos os
   assuntos padrão.
4. Com as três cartas e um assunto escolhidos, aparece o resultado provável, calculado igual ao da
   aba "Tirar cartas".

### Glossário

1. Digite o nome, número ou palavra-chave da carta (quando sobra só uma, ela já aparece; Enter mostra
   a primeira encontrada) ou toque na imagem.
2. A carta aparece com energia, grupo temático, significado em pé e invertida, conselho, reflexão,
   ação prática, significado em cada assunto, ritmo e combinações marcantes.
3. Os botões no fim passam para a carta anterior ou a próxima.

Para servir localmente: `python -m http.server` dentro desta pasta.

## Organização

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual, baralho e animação de virar as cartas |
| `cartas.js` | Os 22 Arcanos Maiores, com significados gerais, invertidos e por assunto |
| `comum.js` | Seletores (assunto, estado de espírito, nome), galeria com busca, face da carta e troca de abas |
| `interpretacao.js` | Textos de aprofundamento e montagem da leitura personalizada |
| `tiragem.js` | Aba "Tirar cartas": sorteio, animações e leitura |
| `consulta.js` | Aba "Consultar tiragem": escolha das três cartas e leitura |
| `glossario.js` | Aba "Glossário": significado individual de cada carta |
| `imagens/` | Imagens das cartas: baralho Rider-Waite-Smith (1909), domínio público, via Wikimedia Commons |

## Como a leitura é montada

- O sorteio usa `crypto.getRandomValues`; cada carta tem 50% de chance de sair invertida.
- Assuntos padrão usam o texto específico da carta para aquele tema; assuntos digitados usam o
  significado geral da carta.
- Cada carta traz também uma pergunta de reflexão e uma ação prática.
- O resultado provável soma a energia de cada carta (favorável, neutra ou desafiadora; invertida
  muda o sinal), com peso maior para o Futuro.
- A leitura combinada é personalizada com o que o usuário informa:
  - **nome** e **estado de espírito** (ansiedade, esperança, dúvida…) mudam a abertura e o fecho;
  - a **pergunta** é classificada (sim ou não, quando, por que, como, aberta) e recebe uma
    resposta própria;
  - o **assunto** define uma dica prática conforme o resultado.
- "O que as cartas dizem juntas" aponta padrões da tiragem: trajetória do Passado ao Futuro,
  cartas invertidas, sequência dos números, grupos temáticos repetidos e 20 combinações clássicas
  de cartas (ex.: Torre + Estrela).
- O ritmo (semanas, meses, prazo longo) vem da carta do Futuro.
- O nome fica guardado só no navegador de quem usa (`localStorage`).
- Se uma imagem não carregar, a carta é desenhada com número, símbolo e nome.
