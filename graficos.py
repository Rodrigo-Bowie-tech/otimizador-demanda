"""Gráficos da tela de resultado (plotly)."""

import plotly.graph_objects as go

import calculo

AZUL = "#4a7bd0"
VERMELHO = "#d0654a"
VERDE = "#2e9e5b"


def demanda_por_mes(meses, r):
    """Barras da demanda medida com as linhas da contratada atual, ótima e tolerância."""
    n = len(meses)
    cores = [VERMELHO if linha["multa"] > 0 else AZUL for linha in r["detalhe_atual"]]
    fig = go.Figure()
    fig.add_bar(x=meses, y=r["medidas"], name="Demanda medida", marker_color=cores,
                hovertemplate="%{x}: %{y:.0f} kW<extra></extra>")
    fig.add_scatter(x=meses, y=[r["atual"]] * n, name=f"Contratada atual ({r['atual']:.0f} kW)",
                    mode="lines", line=dict(color=VERMELHO, dash="dash"))
    fig.add_scatter(x=meses, y=[r["otima"]] * n, name=f"Recomendada ({r['otima']} kW)",
                    mode="lines", line=dict(color=VERDE, width=3))
    fig.add_scatter(x=meses, y=[r["otima"] * calculo.TOLERANCIA] * n,
                    name="Limite sem multa da recomendada (+5%)", mode="lines",
                    line=dict(color=VERDE, dash="dot", width=1))
    fig.update_layout(yaxis_title="kW", margin=dict(t=20),
                      legend=dict(orientation="h", y=-0.15))
    return fig


def curva_de_custo(r):
    """Custo total do período para cada valor possível de demanda contratada."""
    fig = go.Figure()
    fig.add_scatter(x=[d for d, _ in r["curva"]], y=[c for _, c in r["curva"]],
                    mode="lines", name="Custo total", line=dict(color=AZUL),
                    hovertemplate="%{x} kW → R$ %{y:,.2f}<extra></extra>")
    fig.add_scatter(x=[r["otima"]], y=[r["custo_otimo"]], mode="markers+text",
                    name="Recomendada", text=[f"{r['otima']} kW"], textposition="top center",
                    marker=dict(size=13, color=VERDE))
    fig.add_scatter(x=[r["atual"]], y=[r["custo_atual"]], mode="markers+text",
                    name="Atual", text=[f"{r['atual']:.0f} kW"], textposition="bottom center",
                    marker=dict(size=11, color=VERMELHO))
    fig.update_layout(xaxis_title="Demanda contratada (kW)", yaxis_title="Custo no período (R$)",
                      margin=dict(t=20), legend=dict(orientation="h", y=-0.2),
                      separators=",.")
    return fig
