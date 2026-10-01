// Gráficos da tela de resultado (Plotly). A biblioteca só é baixada quando
// o primeiro gráfico aparece.
//
// Cores verificadas para daltonismo: azul = medida, laranja = contrato atual e
// meses com multa, verde = recomendada. As linhas também diferem no traço.

import { TOLERANCIA } from "./calculo.js";

const AZUL = "#4a7bd0";
const LARANJA = "#c2410c";
const VERDE = "#2e9e5b";
const TINTA = "#3c4043";
const GRADE = "#e8eaed";

let carregando = null;

function carregarPlotly() {
  carregando ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "lib/plotly.min.js";
    script.onload = () => resolve(window.Plotly);
    script.onerror = reject;
    document.head.append(script);
  });
  return carregando;
}

const kw = (v) => `${Math.round(v).toLocaleString("pt-BR")} kW`;

function layoutBase(extra) {
  return {
    margin: { t: 10, r: 10, b: 10, l: 10 },
    font: { family: "system-ui, sans-serif", size: 13, color: TINTA },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    separators: ",.",
    legend: { orientation: "h", x: 0, xanchor: "left", y: 1.02, yanchor: "bottom" },
    hoverlabel: { bgcolor: "#fff", bordercolor: GRADE, font: { color: TINTA } },
    xaxis: { automargin: true, gridcolor: GRADE, linecolor: GRADE, fixedrange: true },
    yaxis: { automargin: true, gridcolor: GRADE, zeroline: false, fixedrange: true },
    ...extra,
  };
}

const CONFIG = { displayModeBar: false, responsive: true, locale: "pt-BR" };

/** Barras da demanda medida com as linhas da contratada atual, recomendada e tolerância. */
export async function demandaPorMes(elemento, meses, r) {
  const Plotly = await carregarPlotly();
  const n = meses.length;
  const linha = (y, nome, cor, traco, largura = 2) => ({
    x: meses, y: Array(n).fill(y), name: nome, type: "scatter", mode: "lines",
    line: { color: cor, dash: traco, width: largura }, hoverinfo: "skip",
  });
  const dados = [
    {
      x: meses, y: r.medidas, name: "Demanda medida", type: "bar",
      marker: { color: r.detalheAtual.map((l) => (l.multa > 0 ? LARANJA : AZUL)) },
      customdata: r.detalheAtual.map((l) => (l.multa > 0 ? "com multa no contrato atual" : "sem multa")),
      hovertemplate: "%{x}: %{y:.0f} kW<br>%{customdata}<extra></extra>",
    },
    linha(r.atual, `Contratada atual (${kw(r.atual)})`, LARANJA, "dash"),
    linha(r.otima, `Recomendada (${kw(r.otima)})`, VERDE, "solid", 3),
    linha(r.otima * TOLERANCIA, "Limite sem multa da recomendada (+5%)", VERDE, "dot", 1.5),
  ];
  await Plotly.react(elemento, dados, layoutBase({ bargap: 0.25, yaxis: { ...layoutBase().yaxis, title: { text: "kW" } } }), CONFIG);
}

/** Custo total do período para cada valor possível de demanda contratada. */
export async function curvaDeCusto(elemento, r) {
  const Plotly = await carregarPlotly();
  const ponto = (x, y, nome, cor, posicao, tamanho) => ({
    x: [x], y: [y], name: nome, type: "scatter", mode: "markers+text", text: [kw(x)], textposition: posicao,
    marker: { size: tamanho, color: cor, line: { color: "#fff", width: 2 } },
    hovertemplate: `${nome}: %{x:.0f} kW → R$ %{y:,.2f}<extra></extra>`,
  });
  const dados = [
    {
      x: r.curva.map(([d]) => d), y: r.curva.map(([, c]) => c), name: "Custo total", type: "scatter",
      mode: "lines", line: { color: AZUL, width: 2 },
      hovertemplate: "%{x} kW → R$ %{y:,.2f}<extra></extra>",
    },
    ponto(r.otima, r.custoOtimo, "Recomendada", VERDE, "top center", 13),
    ponto(r.atual, r.custoAtual, "Atual", LARANJA, "bottom center", 11),
  ];
  await Plotly.react(elemento, dados, layoutBase({
    hovermode: "closest",
    xaxis: { ...layoutBase().xaxis, title: { text: "Demanda contratada (kW)" } },
    yaxis: { ...layoutBase().yaxis, title: { text: "Custo no período (R$)" }, tickprefix: "R$ " },
  }), CONFIG);
}
