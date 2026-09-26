# Tarot das Três Cartas

Aplicativo web estático (HTML, CSS e JavaScript puro, sem dependências) com duas abas:

- **Tirar cartas**: leitura de três cartas — Passado · Presente · Futuro.
- **Consultar cartas**: o usuário escolhe as três cartas na galeria e recebe a mesma leitura de
  Passado · Presente · Futuro, com o resultado combinado.

## Como usar

### Tirar cartas

1. Abra `index.html` no navegador (funciona com duplo clique, sem servidor).
2. Escolha um assunto padrão (Amor, Trabalho, Família, Dinheiro, Saúde, Amizades, Espiritualidade)
   ou escreva um assunto próprio. A pergunta é opcional.
3. Toque no baralho: as cartas são embaralhadas, três são distribuídas e viram uma a uma.
4. A leitura mostra o significado de cada carta na sua posição e um resultado provável
   (Favorável, Em equilíbrio ou Desafiador), com um conselho final.

### Consultar cartas

1. Escolha um assunto padrão ou escreva um próprio, e opcionalmente uma pergunta.
2. Busque por nome, número (romano ou arábico) ou palavra-chave e toque em três cartas da galeria:
   a primeira é o Passado, a segunda o Presente e a terceira o Futuro. Tocar de novo numa carta
   escolhida libera a posição, e a próxima carta tocada ocupa a posição vazia.
3. Cada carta aparece com a imagem, o significado geral, o significado para o assunto e um conselho,
   com opção de **Em pé** ou **Invertida**. Sem assunto, cada carta mostra o significado em todos os
   assuntos padrão.
4. Com as três cartas e um assunto escolhidos, aparece o resultado provável, calculado igual ao da
   aba "Tirar cartas".

Para servir localmente: `python -m http.server` dentro desta pasta.

## Organização

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual, baralho e animação de virar as cartas |
| `cartas.js` | Os 22 Arcanos Maiores, com significados gerais, invertidos e por assunto |
| `comum.js` | Seletor de assunto, interpretação, resultado provável, face da carta e troca de abas |
| `tiragem.js` | Aba "Tirar cartas": sorteio, animações e leitura |
| `consulta.js` | Aba "Consultar cartas": busca, escolha das três cartas e leitura |
| `imagens/` | Imagens das cartas: baralho Rider-Waite-Smith (1909), domínio público, via Wikimedia Commons |

## Como a leitura é montada

- O sorteio usa `crypto.getRandomValues`; cada carta tem 50% de chance de sair invertida.
- Assuntos padrão usam o texto específico da carta para aquele tema; assuntos digitados usam o
  significado geral da carta.
- Se uma imagem não carregar, a carta é desenhada com número, símbolo e nome.
- O resultado provável soma a energia de cada carta (favorável, neutra ou desafiadora; invertida
  muda o sinal), com peso maior para o Futuro.
