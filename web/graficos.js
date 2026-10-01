// Gráficos (Plotly), usados na tela e, como imagem, nos relatórios em PDF e Excel.
// A biblioteca só é baixada quando o primeiro gráfico aparece.
//
// Cada gráfico é montado por uma função fig...() que devolve {data, layout}:
// a mesma figura é desenhada na tela (desenhar) ou convertida em imagem (imagem).
//
// Cores verificadas para daltonismo: azul = medida, laranja = contrato atual e
// multas, verde = recomendada. As linhas também diferem no traço.

import { DEMANDA_MINIMA, TOLERANCIA } from "./calculo.js";

export const AZUL = "#4a7bd0";
export const LARANJA = "#c2410c";
export const VERDE = "#2e9e5b";
const VERDE_FAIXA = "rgba(46, 158, 91, 0.14)";
const CINZA = "#80868b";
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
const reais = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Layout comum. Na exportação, o título vai dentro da imagem e o fundo é branco. */
function layoutBase({ titulo, exportar, eixoX = {}, eixoY = {}, legendaY = -0.14, ...extra }) {
  return {
    title: exportar && titulo ? { text: titulo, x: 0, xanchor: "left", font: { size: 17, color: TINTA } } : undefined,
    margin: { t: exportar ? 70 : 10, r: 16, b: 10, l: 10 },
    font: { family: "Helvetica, Arial, sans-serif", size: exportar ? 14 : 13, color: TINTA },
    paper_bgcolor: exportar ? "#ffffff" : "rgba(0,0,0,0)",
    plot_bgcolor: exportar ? "#ffffff" : "rgba(0,0,0,0)",
    separators: ",.",
    // Na tela a legenda fica em cima; na imagem exportada, embaixo, para não encostar no título
    legend: exportar
      ? { orientation: "h", x: 0, xanchor: "left", y: legendaY, yanchor: "top", traceorder: "normal", font: { size: 13 } }
      : { orientation: "h", x: 0, xanchor: "left", y: 1.02, yanchor: "bottom", traceorder: "normal", font: { size: 12 } },
    hoverlabel: { bgcolor: "#fff", bordercolor: GRADE, font: { color: TINTA } },
    xaxis: { automargin: true, gridcolor: GRADE, linecolor: "#bdc1c6", fixedrange: true, ...eixoX },
    yaxis: { automargin: true, gridcolor: GRADE, zeroline: false, fixedrange: true, ...eixoY },
    barcornerradius: 4,
    ...extra,
  };
}

/**
 * Demanda medida mês a mês, com a contratada atual, a recomendada e a faixa de
 * tolerância de 5% acima da recomendada (até onde não há multa).
 */
export function figDemandaPorMes(meses, r, { exportar = false, titulo = "Demanda medida mês a mês" } = {}) {
  const n = meses.length;
  const linha = (y, nome, cor, traco, largura = 2, extra = {}) => ({
    x: meses, y: Array.isArray(y) ? y : Array(n).fill(y), name: nome, type: "scatter", mode: "lines",
    line: { color: cor, dash: traco, width: largura, shape: "hvh" }, hoverinfo: "skip", ...extra,
  });
  const comMulta = r.detalheAtual.map((l) => l.multa > 0);
  const dados = [
    // Faixa sem multa da recomendada: de 100% a 105%
    linha(r.otima, "", VERDE, "solid", 0, { showlegend: false }),
    linha(r.otima * TOLERANCIA, "Faixa sem multa da recomendada (até +5%)", VERDE, "solid", 0,
      { fill: "tonexty", fillcolor: VERDE_FAIXA }),
    {
      x: meses, y: r.medidas, name: "Demanda medida", type: "bar",
      marker: { color: comMulta.map((m) => (m ? LARANJA : AZUL)) },
      customdata: comMulta.map((m) => (m ? "com multa no contrato atual" : "sem multa no contrato atual")),
      hovertemplate: "%{x}: %{y:,.0f} kW<br>%{customdata}<extra></extra>",
    },
    linha(r.atual, `Contratada atual (${kw(r.atual)})`, LARANJA, "dash"),
    linha(r.otima, `Recomendada (${kw(r.otima)})`, VERDE, "solid", 3),
  ];
  // Contrato da época, quando mudou ao longo do período
  if (r.contratadasMes?.some((c) => c != null && Math.abs(c - r.atual) > 0.5)) {
    dados.push(linha(r.contratadasMes, "Contratada em cada mês", CINZA, "dot", 2));
  }
  // Legenda para os meses com multa (as barras laranja)
  if (comMulta.some(Boolean)) {
    dados.push({ x: [null], y: [null], type: "bar", name: "Mês com multa no contrato atual", marker: { color: LARANJA }, hoverinfo: "skip" });
  }
  return {
    data: dados,
    layout: layoutBase({ titulo, exportar, bargap: 0.3, eixoY: { title: { text: "kW" }, tickformat: ",.0f", rangemode: "tozero" } }),
  };
}

/** Custo total do período para cada valor possível de demanda contratada. */
export function figCurvaDeCusto(r, { exportar = false, titulo = "Custo no período para cada demanda contratada" } = {}) {
  const ponto = (x, y, nome, cor, posicao, tamanho) => ({
    x: [x], y: [y], name: `${nome} (${kw(x)})`, type: "scatter", mode: "markers+text", text: [kw(x)],
    textposition: posicao, textfont: { color: TINTA },
    marker: { size: tamanho, color: cor, line: { color: "#fff", width: 2 } },
    hovertemplate: `${nome}: %{x:,.0f} kW → R$ %{y:,.2f}<extra></extra>`,
  });
  // Mostra só a parte da curva que interessa: de um pouco abaixo da menor demanda relevante até o fim
  const inicio = Math.max(DEMANDA_MINIMA, Math.floor(0.6 * Math.min(r.otima, r.atual, ...r.medidas)));
  const curva = r.curva.filter(([d]) => d >= inicio);
  const dados = [
    {
      x: curva.map(([d]) => d), y: curva.map(([, c]) => c), name: "Custo total no período", type: "scatter",
      mode: "lines", line: { color: AZUL, width: 2 },
      hovertemplate: "%{x:,.0f} kW → R$ %{y:,.2f}<extra></extra>",
    },
    ponto(r.otima, r.custoOtimo, "Recomendada", VERDE, "bottom center", 13),
    ponto(r.atual, r.custoAtual, "Atual", LARANJA, "top center", 11),
  ];
  const anotacoes = [];
  if (r.economia > 0.5) {
    // Seta vertical do custo atual até o custo recomendado, com o valor economizado
    anotacoes.push({
      x: r.atual, y: r.custoOtimo, ax: r.atual, ay: r.custoAtual, xref: "x", yref: "y", axref: "x", ayref: "y",
      showarrow: true, arrowhead: 2, arrowsize: 1, arrowwidth: 1.5, arrowcolor: VERDE, text: "",
    }, {
      // Valor da economia no canto superior direito, longe dos pontos
      x: 1, y: 1, xref: "paper", yref: "paper", xanchor: "right", yanchor: "top", showarrow: false,
      text: `Economia com a recomendada: <b>${reais(r.economia)}</b>`,
      font: { color: VERDE, size: exportar ? 15 : 13 }, bgcolor: "rgba(255,255,255,0.9)", borderpad: 4,
    });
  }
  return {
    data: dados,
    layout: layoutBase({
      titulo, exportar, hovermode: "closest", annotations: anotacoes, legendaY: -0.24,
      shapes: [{ type: "line", x0: r.otima, x1: r.otima, yref: "paper", y0: 0, y1: 1, line: { color: VERDE, width: 1, dash: "dot" } }],
      eixoX: { title: { text: "Demanda contratada (kW)" }, tickformat: ",.0f" },
      eixoY: { title: { text: "Custo de demanda no período (R$)" }, tickprefix: "R$ ", tickformat: ",.0f" },
    }),
  };
}

/** Custo de demanda de cada mês: contrato atual x recomendado, com a parte de multa destacada. */
export function figCustoPorMes(meses, r, { exportar = false, titulo = "Custo de demanda por mês: atual x recomendada" } = {}) {
  const barras = (nome, grupo, valores, cor) => ({
    x: meses, y: valores, name: nome, type: "bar", offsetgroup: grupo, marker: { color: cor },
    hovertemplate: `${nome}<br>%{x}: R$ %{y:,.2f}<extra></extra>`,
  });
  const semMulta = (d) => d.map((l) => l.custo - l.multa);
  // Parte clara = demanda faturada; parte escura empilhada = multa de ultrapassagem
  const dados = [barras(`Contrato atual (${kw(r.atual)})`, "atual", semMulta(r.detalheAtual), "#f2b48f")];
  if (r.detalheAtual.some((l) => l.multa > 0)) {
    dados.push(barras("Multa no contrato atual", "atual", r.detalheAtual.map((l) => l.multa), LARANJA));
  }
  dados.push(barras(`Recomendada (${kw(r.otima)})`, "otimo", semMulta(r.detalheOtimo), VERDE));
  if (r.detalheOtimo.some((l) => l.multa > 0)) {
    dados.push(barras("Multa com a recomendada", "otimo", r.detalheOtimo.map((l) => l.multa), "#1e6b3e"));
  }
  return {
    data: dados,
    layout: layoutBase({
      titulo, exportar, barmode: "relative", bargap: 0.25, bargroupgap: 0.08,
      eixoY: { title: { text: "R$" }, tickprefix: "R$ ", tickformat: ",.0f" },
    }),
  };
}

/** Economia estimada por unidade consumidora, da maior para a menor. */
export function figEconomiaPorUnidade(itens, { exportar = false, titulo = "Economia estimada por unidade consumidora" } = {}) {
  const ordenados = [...itens].sort((a, b) => a.economia - b.economia); // de baixo para cima no gráfico
  return {
    data: [{
      y: ordenados.map((i) => i.nome), x: ordenados.map((i) => i.economia), type: "bar", orientation: "h",
      marker: { color: ordenados.map((i) => (i.economia > 0.5 ? VERDE : CINZA)) },
      text: ordenados.map((i) => reais(i.economia)), textposition: "outside", cliponaxis: false,
      hovertemplate: "%{y}<br>Economia: R$ %{x:,.2f}<extra></extra>", showlegend: false,
    }],
    layout: layoutBase({
      titulo, exportar, bargap: 0.35,
      margin: { t: exportar ? 70 : 10, r: 90, b: 10, l: 10 },
      eixoX: { title: { text: "Economia no período (R$)" }, tickprefix: "R$ ", tickformat: ",.0f", rangemode: "tozero" },
      eixoY: { gridcolor: "rgba(0,0,0,0)", automargin: true },
    }),
  };
}

const CONFIG = { displayModeBar: false, responsive: true, locale: "pt-BR" };

/** Desenha uma figura num elemento da tela. */
export async function desenhar(elemento, figura) {
  const Plotly = await carregarPlotly();
  await Plotly.react(elemento, figura.data, figura.layout, CONFIG);
}

/** Converte uma figura em imagem PNG (data URL) para os relatórios. */
export async function imagem(figura, largura = 1000, altura = 480) {
  const Plotly = await carregarPlotly();
  return Plotly.toImage({ data: figura.data, layout: figura.layout }, { format: "png", width: largura, height: altura, scale: 2 });
}

/**
 * Todas as imagens dos relatórios. itens: [{unidade, analise}] (analise null = dados incompletos).
 * Retorna { economia: dataURL|null, unidades: [{ [posto]: {demanda, curva, custo} } | null] }.
 */
export async function imagensDosRelatorios(itens, aoProgredir = () => {}) {
  const completos = itens.filter((i) => i.analise);
  const total = completos.reduce((n, i) => n + Object.keys(i.analise.resultados).length * 3 + (i.analise.comparacao?.disponivel ? 1 : 0), 0)
    + (itens.length > 1 ? 1 : 0);
  let feitas = 0;
  const gerar = async (figura, largura, altura) => {
    const png = await imagem(figura, largura, altura);
    aoProgredir(++feitas, total);
    return png;
  };
  const unidades = [];
  for (const { analise } of itens) {
    if (!analise) { unidades.push(null); continue; }
    const porPosto = {};
    for (const [posto, r] of Object.entries(analise.resultados)) {
      const sufixo = Object.keys(analise.resultados).length > 1 ? ` — ${posto}` : "";
      porPosto[posto] = {
        demanda: await gerar(figDemandaPorMes(analise.meses, r, { exportar: true, titulo: `Demanda medida mês a mês${sufixo}` })),
        curva: await gerar(figCurvaDeCusto(r, { exportar: true, titulo: `Custo no período para cada demanda contratada${sufixo}` })),
        custo: await gerar(figCustoPorMes(analise.meses, r, { exportar: true, titulo: `Custo de demanda por mês: atual x recomendada${sufixo}` })),
      };
    }
    if (analise.comparacao?.disponivel) porPosto.modalidade = await gerar(figComparacaoModalidades(analise.comparacao, { exportar: true }));
    unidades.push(porPosto);
  }
  let economia = null;
  if (itens.length > 1) {
    const dados = completos.map(({ unidade, analise }) => ({ nome: unidade.nomeCurto ?? unidade.rotulo, economia: analise.economia }));
    economia = await gerar(figEconomiaPorUnidade(dados, { exportar: true }), 1000, Math.max(320, 70 * dados.length + 120));
  }
  return { economia, unidades };
}

/** Custo do período (demanda + energia): situação atual x cada modalidade com a demanda ideal. */
export function figComparacaoModalidades(comp, { exportar = false, titulo = "Custo no período por modalidade: demanda + energia" } = {}) {
  const nomes = [`Hoje (${comp.atual.modalidade}, contratos atuais)`, ...Object.keys(comp.opcoes).map((m) => `${m} com a demanda ideal`)];
  const valores = [comp.atual, ...Object.values(comp.opcoes)];
  const melhor = 1 + Object.keys(comp.opcoes).indexOf(comp.melhor);
  const cor = (escura, clara) => valores.map((_, i) => (i === melhor ? (escura ? VERDE : "#9fd4b4") : escura ? AZUL : "#b4c8ee"));
  const barras = (nome, campo, escura) => ({
    x: nomes, y: valores.map((v) => v[campo]), name: nome, type: "bar", marker: { color: cor(escura) },
    hovertemplate: `%{x}<br>${nome}: R$ %{y:,.2f}<extra></extra>`,
  });
  return {
    data: [
      barras("Demanda", "custoDemanda", true),
      barras("Energia", "custoEnergia", false),
      {
        x: nomes, y: valores.map((v) => v.total), type: "scatter", mode: "text", showlegend: false, hoverinfo: "skip",
        text: valores.map((v, i) => `<b>${reais(v.total)}</b>${i === melhor ? "<br>mais barata" : ""}`),
        textposition: "top center", textfont: { color: valores.map((_, i) => (i === melhor ? VERDE : TINTA)), size: exportar ? 14 : 13 },
      },
    ],
    layout: layoutBase({
      titulo, exportar, barmode: "stack", bargap: 0.45,
      eixoY: { title: { text: "R$" }, tickprefix: "R$ ", tickformat: ",.0f", rangemode: "tozero" },
      margin: { t: exportar ? 70 : 30, r: 16, b: 10, l: 10 },
    }),
  };
}
