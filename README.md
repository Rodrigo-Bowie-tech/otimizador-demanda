# Otimizador de Demanda Contratada

Programa que lê contas de energia do Grupo A (Light, Energisa, Enel), em tarifa verde ou azul,
e calcula a demanda contratada que resulta no menor custo, considerando as multas de ultrapassagem
(REN ANEEL 1000/2021).

## Rodar em desenvolvimento

```
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

## Gerar o pacote para quem não programa

```
powershell -ExecutionPolicy Bypass -File empacotar.ps1
```

Gera `dist/OtimizadorDemanda.zip`, com um Python portátil incluso. Instruções de uso em `pacote/LEIA-ME.txt`.

## Organização

| Arquivo | Função |
|---|---|
| `app.py` | Interface web em 3 etapas (Streamlit) |
| `calculo.py` | Regras de faturamento e busca da demanda ótima |
| `leitor_pdf.py` | Extração dos dados das contas em PDF |
| `graficos.py` | Gráficos da tela de resultado |
| `relatorio.py` | Relatório em Excel |
| `iniciar.py` | Abre o programa no navegador (usado pelo atalho do pacote) |

## Pendências

- Calibrar `leitor_pdf.py` com contas reais de cada distribuidora.
