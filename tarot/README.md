# Tarot das Três Cartas

Aplicativo web estático (HTML, CSS e JavaScript puro, sem dependências) para uma leitura de tarot
de três cartas: **Passado · Presente · Futuro**.

## Como usar

1. Abra `index.html` no navegador (funciona com duplo clique, sem servidor).
2. Escolha um assunto padrão (Amor, Trabalho, Família, Dinheiro, Saúde, Amizades, Espiritualidade)
   ou escreva um assunto próprio. A pergunta é opcional.
3. Toque no baralho: as cartas são embaralhadas, três são distribuídas e viram uma a uma.
4. A leitura mostra o significado de cada carta na sua posição e um resultado provável
   (Favorável, Em equilíbrio ou Desafiador), com um conselho final.

Para servir localmente: `python -m http.server` dentro desta pasta.

## Organização

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual, baralho e animação de virar as cartas |
| `cartas.js` | Os 22 Arcanos Maiores, com significados gerais, invertidos e por assunto |
| `app.js` | Escolha do assunto, sorteio, animações e montagem da leitura |

## Como a leitura é montada

- O sorteio usa `crypto.getRandomValues`; cada carta tem 50% de chance de sair invertida.
- Assuntos padrão usam o texto específico da carta para aquele tema (quando existe);
  assuntos digitados usam o significado geral da carta.
- O resultado provável soma a energia de cada carta (favorável, neutra ou desafiadora; invertida
  muda o sinal), com peso maior para o Futuro.
