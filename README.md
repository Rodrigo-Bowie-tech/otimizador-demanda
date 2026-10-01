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

## Versão em Python (Windows)

A primeira versão, em Python + Streamlit, continua na raiz do repositório (`app.py` e demais `.py`).
`.github/workflows/publicar.yml` gera dela um pacote portátil para Windows a cada mudança em `VERSAO`.
Para rodar: `python -m pip install -r requirements.txt` e `python -m streamlit run app.py`.

## Organização

| Arquivo | Função |
|---|---|
| `web/` | App instalável (PWA): mesmas regras e telas, em JavaScript |
| `web/sw.js` | Guarda o app para uso sem internet e instala as versões novas |
| `app.py` | Interface web em 3 etapas (Streamlit) |
| `calculo.py` | Regras de faturamento e busca da demanda ótima |
| `leitor_pdf.py` | Extração dos dados das contas em PDF |
| `graficos.py` | Gráficos da tela de resultado |
| `relatorio.py` | Relatório em Excel |
| `iniciar.py` | Atualiza e abre o programa no navegador (usado pelo atalho do pacote) |
| `empacotar.ps1` | Gera o pacote para Windows e o arquivo de atualização |
| `VERSAO`, `NOVIDADES.md` | Versão atual e histórico de mudanças |

## Pendências

- Calibrar `web/leitor_pdf.js` (e `leitor_pdf.py`) com contas reais de cada distribuidora.
