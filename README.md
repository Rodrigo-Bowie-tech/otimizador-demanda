# Otimizador de Demanda Contratada

Programa que lê contas de energia do Grupo A (Light, Energisa, Enel), em tarifa verde ou azul,
e calcula a demanda contratada que resulta no menor custo, considerando as multas de ultrapassagem
(REN ANEEL 1000/2021).

## Rodar em desenvolvimento

```
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

## Baixar

- **Windows (sem instalar nada):** [OtimizadorDemanda.zip](https://github.com/Rodrigo-Bowie-tech/otimizador-demanda/releases/latest/download/OtimizadorDemanda.zip).
  Extraia e abra "Abrir Otimizador de Demanda". Instruções em `pacote/LEIA-ME.txt`.
- **Celular ou qualquer navegador:** versão online no Streamlit Community Cloud (link a definir).

## Publicar uma versão nova

1. Altere o número em `VERSAO` e descreva as mudanças em `NOVIDADES.md`.
2. Envie para o branch `main`.

O GitHub Actions (`.github/workflows/publicar.yml`) gera o pacote para Windows e cria uma Release.
As cópias instaladas se atualizam sozinhas ao abrir (`iniciar.py`), e a versão online se atualiza
a cada envio ao `main`. Se `requirements.txt` mudar, as cópias instaladas avisam que é preciso
baixar o pacote completo.

Para gerar o pacote manualmente no Windows: `powershell -ExecutionPolicy Bypass -File empacotar.ps1`.

## Organização

| Arquivo | Função |
|---|---|
| `app.py` | Interface web em 3 etapas (Streamlit) |
| `calculo.py` | Regras de faturamento e busca da demanda ótima |
| `leitor_pdf.py` | Extração dos dados das contas em PDF |
| `graficos.py` | Gráficos da tela de resultado |
| `relatorio.py` | Relatório em Excel |
| `iniciar.py` | Atualiza e abre o programa no navegador (usado pelo atalho do pacote) |
| `empacotar.ps1` | Gera o pacote para Windows e o arquivo de atualização |
| `VERSAO`, `NOVIDADES.md` | Versão atual e histórico de mudanças |

## Pendências

- Calibrar `leitor_pdf.py` com contas reais de cada distribuidora.
