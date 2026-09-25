"""Cálculo de demanda contratada ótima para consumidores do Grupo A.

Regras usadas (REN ANEEL 1000/2021):
- Demanda faturada = maior valor entre contratada e medida.
- Se a medida passar de 105% da contratada, a parcela acima da contratada
  é cobrada como ultrapassagem, a 2x a tarifa de demanda.

Na tarifa VERDE há uma demanda só. Na AZUL há duas (ponta e fora de ponta),
e cada uma é calculada de forma independente, com sua própria tarifa.
"""

TOLERANCIA = 1.05
FATOR_ULTRAPASSAGEM = 2
DEMANDA_MINIMA = 30  # kW, mínimo para o Grupo A


def ultrapassagem(contratada, medida):
    """kW de ultrapassagem no mês (zero se ficou dentro da tolerância de 5%)."""
    if medida > TOLERANCIA * contratada:
        return medida - contratada
    return 0


def custo_mes(contratada, medida, tarifa):
    """Custo de demanda (R$) de um mês para um valor de demanda contratada."""
    faturada = max(contratada, medida)
    multa = ultrapassagem(contratada, medida) * FATOR_ULTRAPASSAGEM * tarifa
    return faturada * tarifa + multa


def custo_total(contratada, medidas, tarifa):
    """Soma do custo de todos os meses."""
    return sum(custo_mes(contratada, m, tarifa) for m in medidas)


def curva_custo(medidas, tarifa, passo=1):
    """Custo total para cada demanda candidata. Retorna lista de (demanda, custo)."""
    maximo = int(max(medidas) * 1.2) + 1
    candidatos = range(DEMANDA_MINIMA, max(maximo, DEMANDA_MINIMA + 1), passo)
    return [(d, custo_total(d, medidas, tarifa)) for d in candidatos]


def demanda_otima(medidas, tarifa, passo=1):
    """Demanda contratada que minimiza o custo total. Retorna (demanda, custo)."""
    return min(curva_custo(medidas, tarifa, passo), key=lambda par: par[1])


def detalhe_mensal(contratada, medidas, tarifa):
    """Quebra mês a mês: faturada, ultrapassagem, multa e custo."""
    linhas = []
    for m in medidas:
        excesso = ultrapassagem(contratada, m)
        linhas.append({
            "medida": m,
            "faturada": max(contratada, m),
            "ultrapassagem_kw": excesso,
            "multa": excesso * FATOR_ULTRAPASSAGEM * tarifa,
            "custo": custo_mes(contratada, m, tarifa),
        })
    return linhas


def analisar_posto(medidas, tarifa, atual):
    """Compara a demanda contratada atual com a ótima para um posto tarifário."""
    otima, custo_otimo = demanda_otima(medidas, tarifa)
    detalhe_atual = detalhe_mensal(atual, medidas, tarifa)
    detalhe_otimo = detalhe_mensal(otima, medidas, tarifa)
    custo_atual = sum(linha["custo"] for linha in detalhe_atual)
    return {
        "tarifa": tarifa,
        "medidas": medidas,
        "atual": atual,
        "otima": otima,
        "custo_atual": custo_atual,
        "custo_otimo": custo_otimo,
        "economia": custo_atual - custo_otimo,
        "curva": curva_custo(medidas, tarifa),
        "detalhe_atual": detalhe_atual,
        "detalhe_otimo": detalhe_otimo,
        "multa_atual": sum(linha["multa"] for linha in detalhe_atual),
        "meses_ultrapassagem_atual": sum(1 for linha in detalhe_atual if linha["multa"] > 0),
        "meses_ultrapassagem_otima": sum(1 for linha in detalhe_otimo if linha["multa"] > 0),
    }
