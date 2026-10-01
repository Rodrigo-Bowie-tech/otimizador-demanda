# Otimizador de Demanda Contratada

Programa que lê contas de energia do Grupo A (Light, Energisa, Enel), em tarifa verde ou azul,
e calcula a demanda contratada que resulta no menor custo, considerando as multas de ultrapassagem
(REN ANEEL 1000/2021).

## Usar o app (celular e computador)

Abra **https://rodrigo-bowie-tech.github.io/otimizador-demanda/** e instale:

- **Android / Chrome / Edge (PC):** botão "Instalar app" na tela, ou menu do navegador → "Instalar".
- **iPhone / iPad:** Safari → Compartilhar → "Adicionar à Tela de Início".

O app roda inteiro no aparelho (as contas não são enviadas para a internet), funciona sem
internet depois de instalado e se atualiza sozinho quando há versão nova.

O código do app fica em `web/` (JavaScript, sem etapa de compilação). Para testar no computador:
`python -m http.server -d web 8000` e abra http://localhost:8000.

## Publicar uma versão nova

1. Faça as mudanças em `web/`, altere o número em `VERSAO` e descreva as mudanças em `NOVIDADES.md`.
2. Envie para o branch `main`.

O GitHub Actions (`.github/workflows/site.yml`) publica o app no GitHub Pages, e os aparelhos com o
app instalado baixam a versão nova sozinhos.

## Versão em Python (arquivada)

A primeira versão, em Python + Streamlit, fica em `versao-python/` só para consulta.
Veja `versao-python/README.md`.

## Organização

| Arquivo | Função |
|---|---|
| `web/` | App instalável (PWA): mesmas regras e telas, em JavaScript |
| `web/sw.js` | Guarda o app para uso sem internet e instala as versões novas |
| `web/app.js` | Telas do app em 3 etapas |
| `web/calculo.js` | Regras de faturamento e busca da demanda ótima |
| `web/leitor_pdf.js` | Extração dos dados das contas em PDF |
| `web/graficos.js` | Gráficos da tela de resultado |
| `web/relatorio.js` | Relatório em Excel |
| `VERSAO`, `NOVIDADES.md` | Versão atual e histórico de mudanças |
| `versao-python/` | Versão antiga em Python (arquivada) |

## Pendências

- Calibrar `web/leitor_pdf.js` com contas reais de cada distribuidora.
