// Relatório em PDF (jsPDF + AutoTable), com estrutura de relatório técnico:
// capa, introdução, metodologia, medições, análise de cada unidade e conclusão.
// As bibliotecas só são baixadas quando o usuário pede o relatório.
//
// As fontes padrão do PDF só têm os caracteres do português do Windows (WinAnsi):
// por isso o texto usa "para" e "-" no lugar de setas e outros símbolos.

import { DEMANDA_MINIMA, FATOR_ULTRAPASSAGEM, TOLERANCIA } from "./calculo.js";

let carregando = null;

function carregarScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

async function carregarJsPDF() {
  carregando ??= (async () => {
    await carregarScript("lib/jspdf.umd.min.js");
    await carregarScript("lib/jspdf.plugin.autotable.min.js");
    return window.jspdf.jsPDF;
  })();
  return carregando;
}

// ---------------------------------------------------------------- aparência

const A4 = { largura: 210, altura: 297 };
const MARGEM = 18;
const LARGURA_UTIL = A4.largura - 2 * MARGEM;
const VERDE = [46, 125, 79];
const TINTA = [32, 33, 36];
const SUAVE = [95, 99, 104];
const LINHA = [218, 220, 224];
const FUNDO_CABECALHO = [221, 235, 247];
const FUNDO_MULTA = [252, 228, 214];
const FUNDO_DESTAQUE = [230, 244, 234];
const PROPORCAO_GRAFICO = 480 / 1000; // altura / largura das imagens geradas

const reais = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kw = (v) => `${Math.round(v).toLocaleString("pt-BR")} kW`;
const numero = (v, casas = 0) => (v == null ? "-" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas }));
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Ajuda a escrever o documento de cima para baixo, quebrando páginas quando precisa. */
class Documento {
  constructor(jsPDF) {
    this.pdf = new jsPDF({ unit: "mm", format: "a4" });
    this.y = MARGEM;
    this.secao = 0;
  }

  get autoTable() {
    const plugin = window.jspdf_autotable;
    const funcao = plugin?.autoTable ?? plugin?.default;
    return funcao ? (opcoes) => funcao(this.pdf, opcoes) : (opcoes) => this.pdf.autoTable(opcoes);
  }

  novaPagina() {
    this.pdf.addPage();
    this.y = MARGEM + 6;
  }

  garantirEspaco(altura) {
    if (this.y + altura > A4.altura - MARGEM - 8) this.novaPagina();
  }

  fonte(tamanho, estilo = "normal", cor = TINTA) {
    this.pdf.setFont("helvetica", estilo);
    this.pdf.setFontSize(tamanho);
    this.pdf.setTextColor(...cor);
  }

  titulo(texto) {
    this.secao++;
    this.novaPagina();
    this.fonte(18, "bold", VERDE);
    this.pdf.text(`${this.secao}. ${texto}`, MARGEM, this.y);
    this.y += 3;
    this.pdf.setDrawColor(...VERDE);
    this.pdf.setLineWidth(0.6);
    this.pdf.line(MARGEM, this.y, MARGEM + LARGURA_UTIL, this.y);
    this.y += 9;
  }

  subtitulo(texto, tamanho = 13) {
    this.garantirEspaco(30);
    this.fonte(tamanho, "bold");
    const linhas = this.pdf.splitTextToSize(texto, LARGURA_UTIL);
    this.pdf.text(linhas, MARGEM, this.y);
    this.y += linhas.length * tamanho * 0.45 + 3;
  }

  paragrafo(texto, { tamanho = 10.5, estilo = "normal", cor = TINTA, recuo = 0, depois = 3 } = {}) {
    this.fonte(tamanho, estilo, cor);
    const linhas = this.pdf.splitTextToSize(texto, LARGURA_UTIL - recuo);
    const alturaLinha = tamanho * 0.45;
    for (const linha of linhas) {
      this.garantirEspaco(alturaLinha);
      this.pdf.text(linha, MARGEM + recuo, this.y);
      this.y += alturaLinha;
    }
    this.y += depois;
  }

  marcadores(itens, opcoes = {}) {
    for (const item of itens) {
      this.fonte(opcoes.tamanho ?? 10.5);
      this.garantirEspaco(6);
      this.pdf.text("•", MARGEM + 2, this.y);
      this.paragrafo(item, { ...opcoes, recuo: 7, depois: 1.5 });
    }
    this.y += 1.5;
  }

  tabela(cabecalho, linhas, { destacar = () => false, alinharDireita = [], larguras, rodape, largura, corDestaque = FUNDO_MULTA } = {}) {
    // Tabelas pequenas não são partidas entre páginas
    const alturaEstimada = (linhas.length + (rodape ? 2 : 1)) * 7 + 6;
    if (alturaEstimada < 180) this.garantirEspaco(alturaEstimada);
    const estilosColunas = {};
    alinharDireita.forEach((i) => (estilosColunas[i] = { halign: "right" }));
    larguras?.forEach((largura, i) => largura && (estilosColunas[i] = { ...estilosColunas[i], cellWidth: largura }));
    this.autoTable({
      startY: this.y,
      head: [cabecalho],
      body: linhas,
      foot: rodape ? [rodape] : undefined,
      margin: { left: MARGEM, right: MARGEM, top: MARGEM + 6, bottom: MARGEM + 8 },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, textColor: TINTA, lineColor: LINHA, lineWidth: 0.1 },
      headStyles: { fillColor: FUNDO_CABECALHO, textColor: TINTA, fontStyle: "bold", valign: "middle" },
      footStyles: { fillColor: [241, 243, 244], textColor: TINTA, fontStyle: "bold" },
      columnStyles: estilosColunas,
      theme: "grid",
      tableWidth: largura ?? "auto",
      rowPageBreak: "avoid",
      didParseCell: (dado) => {
        if (dado.section === "body" && destacar(dado.row.index)) dado.cell.styles.fillColor = corDestaque;
        if (dado.section !== "body" && alinharDireita.includes(dado.column.index)) dado.cell.styles.halign = "right";
      },
    });
    this.y = this.pdf.lastAutoTable.finalY + 6;
  }

  grafico(dataUrl, legenda) {
    const altura = LARGURA_UTIL * PROPORCAO_GRAFICO;
    this.garantirEspaco(altura + 10);
    this.pdf.addImage(dataUrl, "PNG", MARGEM, this.y, LARGURA_UTIL, altura, undefined, "FAST");
    this.y += altura + 5;
    if (legenda) this.paragrafo(legenda, { tamanho: 8.5, cor: SUAVE, depois: 6 });
  }

  caixa(linhas, { cor = FUNDO_DESTAQUE } = {}) {
    const alturaLinha = 6.2;
    const altura = linhas.length * alturaLinha + 6;
    this.garantirEspaco(altura + 4);
    this.pdf.setFillColor(...cor);
    this.pdf.roundedRect(MARGEM, this.y, LARGURA_UTIL, altura, 2, 2, "F");
    let y = this.y + 7;
    for (const [rotulo, valor, destaque] of linhas) {
      this.fonte(10.5, "normal", SUAVE);
      this.pdf.text(rotulo, MARGEM + 5, y);
      this.fonte(destaque ? 12 : 10.5, "bold", destaque ? VERDE : TINTA);
      this.pdf.text(valor, MARGEM + LARGURA_UTIL - 5, y, { align: "right" });
      y += alturaLinha;
    }
    this.y += altura + 6;
  }

  /** Cabeçalho e rodapé de todas as páginas (menos a capa). */
  numerarPaginas(versao) {
    const total = this.pdf.getNumberOfPages();
    for (let n = 2; n <= total; n++) {
      this.pdf.setPage(n);
      this.fonte(8, "normal", SUAVE);
      this.pdf.text("Relatório de análise de demanda contratada", MARGEM, 10);
      this.pdf.setDrawColor(...LINHA);
      this.pdf.setLineWidth(0.2);
      this.pdf.line(MARGEM, 12, A4.largura - MARGEM, 12);
      this.pdf.line(MARGEM, A4.altura - 12, A4.largura - MARGEM, A4.altura - 12);
      this.pdf.text(`Otimizador de Demanda Contratada - versão ${versao}`, MARGEM, A4.altura - 7);
      this.pdf.text(`Página ${n} de ${total}`, A4.largura - MARGEM, A4.altura - 7, { align: "right" });
    }
  }
}

// ---------------------------------------------------------------- textos

function recomendacao(nome, r) {
  if (r.otima < r.atual) {
    return `${nome}: reduzir de ${kw(r.atual)} para ${kw(r.otima)}. A demanda contratada hoje é maior do que a ` +
      `realmente usada, e paga-se por capacidade ociosa.`;
  }
  if (r.otima > r.atual) {
    return `${nome}: aumentar de ${kw(r.atual)} para ${kw(r.otima)}. Com o contrato atual houve multa de ultrapassagem em ` +
      `${plural(r.mesesUltrapassagemAtual, "mês", "meses")}, somando ${reais(r.multaAtual)}; contratar um pouco mais sai ` +
      `mais barato que pagar a multa.`;
  }
  return `${nome}: manter ${kw(r.atual)}. O valor atual já é o mais econômico.`;
}

const acao = (r) => (r.otima < r.atual ? "Reduzir" : r.otima > r.atual ? "Aumentar" : "Manter");

/** Demanda contratada (texto) de uma lista [[posto, kW]]. */
const textoContratos = (postos) => postos.map(([posto, valor]) => `${postos.length > 1 ? `${posto.toLowerCase()} ` : ""}${kw(valor)}`).join(" e ");

function contratosRecomendados(analise) {
  return analise.trocar
    ? Object.entries(analise.comparacao.opcoes[analise.comparacao.melhor].postos).map(([posto, p]) => [posto, p.contratada])
    : Object.entries(analise.resultados).map(([posto, r]) => [posto, r.otima]);
}

function contratosAtuais(unidade, analise) {
  return Object.entries(analise.resultados).map(([posto, r]) => [posto, r.atual]);
}

// ---------------------------------------------------------------- relatório

/**
 * itens: [{unidade, analise}] (analise null = dados incompletos).
 * imagens: resultado de imagensDosRelatorios. meta: {crescimento, distribuidoras, arquivos, versao}.
 * Retorna um Blob .pdf.
 */
export async function gerarPdf(itens, imagens, meta) {
  const jsPDF = await carregarJsPDF();
  const doc = new Documento(jsPDF);
  const completos = itens.map((item, indice) => ({ ...item, indice })).filter((i) => i.analise);
  const incompletos = itens.filter((i) => !i.analise);
  const ordem = (m) => Number(m.slice(3)) * 100 + Number(m.slice(0, 2));
  const todosMeses = [...new Set(completos.flatMap((i) => i.analise.meses))].sort((a, b) => ordem(a) - ordem(b));
  const periodo = todosMeses.length ? `${todosMeses[0]} a ${todosMeses.at(-1)}` : "-";
  const economiaTotal = completos.reduce((s, i) => s + i.analise.economia, 0);
  const custoAtualTotal = completos.reduce((s, i) => s + Object.values(i.analise.resultados).reduce((t, r) => t + r.custoAtual, 0), 0);
  const trocas = completos.filter((i) => i.analise.trocar);
  const multasTotal = completos.reduce((s, i) => s + Object.values(i.analise.resultados).reduce((t, r) => t + r.multaAtual, 0), 0);
  const variasUnidades = itens.length > 1;
  const nome = (u) => u.rotulo;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const pdf = doc.pdf;

  // ---- Capa
  pdf.setFillColor(...VERDE);
  pdf.rect(0, 0, A4.largura, 70, "F");
  doc.fonte(26, "bold", [255, 255, 255]);
  pdf.text(["Relatório de Análise de", "Demanda Contratada"], MARGEM, 32);
  doc.fonte(12, "normal", [230, 244, 234]);
  pdf.text("Avaliação do valor de demanda contratada que minimiza o custo de energia", MARGEM, 58);
  doc.y = 90;
  doc.caixa([
    ["Unidades consumidoras analisadas", String(completos.length)],
    ["Período analisado", periodo],
    ["Distribuidora", meta.distribuidoras?.join(", ") || "-"],
    ["Custo de demanda no período (contrato atual)", reais(custoAtualTotal)],
    ["Multas de ultrapassagem com os contratos atuais", reais(multasTotal)],
    ["Unidades em que vale trocar de modalidade", String(trocas.length)],
    ["Economia estimada com as recomendações", reais(economiaTotal), true],
  ]);
  doc.fonte(11, "bold");
  pdf.text("Conteúdo", MARGEM, doc.y + 4);
  doc.y += 11;
  const secoes = ["Introdução", "Metodologia e premissas", "Medições", "Análise por unidade consumidora", "Conclusão e recomendações"];
  secoes.forEach((s, i) => {
    doc.fonte(10.5, "normal");
    pdf.text(`${i + 1}. ${s}`, MARGEM + 3, doc.y);
    doc.y += 6.5;
  });
  doc.fonte(9, "normal", SUAVE);
  pdf.text(`Emitido em ${hoje} pelo Otimizador de Demanda Contratada (versão ${meta.versao}).`, MARGEM, A4.altura - MARGEM);

  // ---- 1. Introdução
  doc.titulo("Introdução");
  doc.paragrafo("Consumidores do Grupo A (média e alta tensão) pagam, além da energia consumida, pela demanda de potência " +
    "contratada com a distribuidora. Contratar demanda acima da necessária faz pagar por capacidade que não é usada; " +
    "contratar abaixo gera multas de ultrapassagem sempre que a demanda medida passa do limite de tolerância. Por isso, " +
    "o valor contratado tem impacto direto e recorrente no custo da conta de energia.");
  doc.paragrafo("Este relatório tem como objetivo identificar, para cada unidade consumidora, o valor de demanda contratada " +
    "que resulta no menor custo total no período analisado, comparando-o com o contrato vigente e estimando a economia " +
    "possível com o ajuste.");
  doc.subtitulo("Escopo", 12);
  doc.marcadores([
    `${plural(completos.length, "unidade consumidora analisada", "unidades consumidoras analisadas")}` +
      `${incompletos.length ? ` (${plural(incompletos.length, "outra ficou", "outras ficaram")} fora por dados incompletos)` : ""}.`,
    `Período: ${periodo} (${plural(todosMeses.length, "mês", "meses")}).`,
    meta.arquivos ? `Fonte dos dados: ${plural(meta.arquivos, "fatura em PDF", "faturas em PDF")} da distribuidora` +
      `${meta.distribuidoras?.length ? ` (${meta.distribuidoras.join(", ")})` : ""}, conferidas na etapa de revisão do aplicativo.`
      : "Fonte dos dados: valores informados pelo usuário.",
    "Considera apenas a parcela de demanda da fatura; o consumo de energia (kWh) não é alterado pela demanda contratada.",
  ]);
  if (todosMeses.length < 12) {
    doc.paragrafo(`Atenção: a análise usa ${plural(todosMeses.length, "mês", "meses")}. Com menos de 12 meses, a ` +
      "recomendação pode não considerar os meses de maior demanda do ano. Recomenda-se repetir a análise com um ano completo " +
      "antes de solicitar alterações à distribuidora.", { estilo: "bold", cor: [176, 96, 0] });
  }

  // ---- 2. Metodologia
  doc.titulo("Metodologia e premissas");
  doc.paragrafo("O custo de demanda de cada mês foi calculado segundo as regras de faturamento da REN ANEEL nº 1.000/2021:");
  doc.marcadores([
    "Demanda faturada: o maior valor entre a demanda contratada e a demanda medida no mês.",
    `Ultrapassagem: quando a demanda medida passa de ${Math.round((TOLERANCIA - 1) * 100)}% acima da contratada, a parcela ` +
      `excedente é cobrada adicionalmente a ${FATOR_ULTRAPASSAGEM} vezes a tarifa de demanda.`,
    "Tarifa verde: um único valor de demanda contratada. Tarifa azul: valores separados para os horários de ponta e fora " +
      "de ponta, cada um analisado de forma independente com sua própria tarifa.",
    `Demanda mínima considerada: ${DEMANDA_MINIMA} kW, mínimo do Grupo A.`,
  ]);
  doc.paragrafo("Para cada unidade (e cada posto horário, na tarifa azul), foram simulados todos os valores inteiros de " +
    "demanda contratada, do mínimo até acima da maior demanda medida, aplicando-se o mesmo valor a todos os meses do período. " +
    "A demanda recomendada é a de menor custo total; em caso de empate, o menor valor.");
  doc.subtitulo("Escolha da modalidade tarifária", 12);
  doc.paragrafo("Além do ajuste de demanda, cada unidade foi simulada nas duas modalidades horárias, cada uma com a sua " +
    "demanda contratada ideal, somando o custo de demanda e o de energia (kWh) do período:");
  doc.marcadores([
    "Verde: uma única demanda contratada, cobrada pela maior demanda do mês em qualquer horário; a energia consumida no " +
      "horário de ponta tem tarifa bem mais alta.",
    "Azul: demandas contratadas separadas para a ponta (tarifa mais alta) e fora de ponta; a energia na ponta é mais barata " +
      "que na verde.",
    "A verde tende a compensar quando a unidade usa pouca demanda e pouca energia no horário de ponta; a azul, quando a " +
      "demanda e o consumo na ponta são altos.",
    "Tarifas de energia e de demanda de cada modalidade: preços com tributos das faturas mais recentes de unidades em cada " +
      "modalidade, da mesma distribuidora (ou informadas pelo usuário).",
    "Para unidades na verde, a demanda na ponta não é medida separadamente; na simulação da azul ela foi considerada igual à " +
      "demanda máxima do mês, premissa conservadora que não favorece a azul.",
    "Só os subgrupos A3a, A4 e AS podem optar pela verde; os demais foram comparados apenas na azul.",
  ]);
  doc.subtitulo("Premissas", 12);
  doc.marcadores([
    "Demanda medida: valor registrado pelo medidor em cada mês. Quando a fatura informa perda de transformação, a medida " +
      "foi acrescida desse percentual, como faz a distribuidora no faturamento.",
    "Tarifa de demanda: preço por kW com tributos da fatura mais recente de cada unidade, aplicado a todo o período.",
    "Contrato atual: demanda contratada do mês mais recente; o custo atual simula esse valor em todos os meses.",
    meta.crescimento
      ? `Crescimento de carga: as demandas medidas foram ajustadas em ${meta.crescimento > 0 ? "+" : ""}${numero(meta.crescimento, 1)}%.`
      : "Crescimento de carga: não foi considerado (demandas futuras iguais às do período analisado).",
  ]);

  // ---- 3. Medições
  doc.titulo("Medições");
  doc.paragrafo("Demandas contratadas e medidas (kW) e consumos de energia (kWh) em cada mês, conforme as faturas.");
  for (const { unidade, analise } of completos) {
    doc.subtitulo(nome(unidade), 11);
    doc.paragrafo(`Tarifa ${unidade.modalidade}.`, { tamanho: 9, cor: SUAVE, depois: 1 });
    const azul = unidade.modalidade === "Azul";
    const cabecalho = [...(azul
      ? ["Mês", "Contratada ponta (kW)", "Medida ponta (kW)", "Contratada fora ponta (kW)", "Medida fora ponta (kW)"]
      : ["Mês", "Contratada (kW)", "Medida (kW)"]), "Consumo ponta (kWh)", "Consumo fora ponta (kWh)"];
    const linhas = analise.linhas.map((l) => [...(azul
      ? [l.mes, numero(l.contratada_p, 1), numero(l.medida_p, 1), numero(l.contratada, 1), numero(l.medida, 1)]
      : [l.mes, numero(l.contratada, 1), numero(l.medida, 1)]), numero(l.consumo_p), numero(l.consumo_fp)]);
    doc.tabela(cabecalho, linhas, { alinharDireita: cabecalho.map((_, i) => i).slice(1) });
  }

  // ---- 4. Análises
  doc.titulo("Análise por unidade consumidora");
  doc.paragrafo("Para cada unidade: a recomendação, os custos com o contrato atual e com o valor recomendado, e os gráficos " +
    "que fundamentam o resultado. Nas tabelas, as linhas destacadas são meses com multa de ultrapassagem no contrato atual.");
  completos.forEach(({ unidade, analise, indice }, n) => {
    if (n > 0) doc.novaPagina();
    doc.subtitulo(`4.${n + 1}. ${nome(unidade)}`, 13);
    doc.paragrafo(`Tarifa ${unidade.modalidade} · ${plural(analise.meses.length, "mês analisado", "meses analisados")} ` +
      `(${analise.meses[0]} a ${analise.meses.at(-1)}) · economia estimada de ${reais(analise.economia)}.`, { cor: SUAVE, tamanho: 9.5 });
    const postos = Object.entries(analise.resultados);
    const comp = analise.comparacao;
    // Modalidade tarifária
    if (comp?.disponivel) {
      doc.subtitulo("Modalidade tarifária", 11.5);
      const outra = unidade.modalidade === "Azul" ? "verde" : "azul";
      doc.paragrafo(analise.trocar
        ? `Recomenda-se trocar da tarifa ${unidade.modalidade.toLowerCase()} para a ${comp.melhor.toLowerCase()}, contratando ` +
          `${textoContratos(contratosRecomendados(analise))}. Somando demanda e energia, o custo no período cai de ` +
          `${reais(comp.atual.total)} para ${reais(comp.opcoes[comp.melhor].total)}: economia de ${reais(comp.economia)}.`
        : comp.diferencaEntreModalidades != null
          ? `A tarifa ${unidade.modalidade.toLowerCase()} atual é a mais econômica: a ${outra} custaria ` +
            `${reais(comp.diferencaEntreModalidades)} a mais no período, mesmo com a demanda ideal.`
          : `Tarifa ${unidade.modalidade.toLowerCase()}; a outra modalidade não pôde ser comparada.`);
      doc.tabela(["Opção", "Demanda contratada", "Custo de demanda", "Custo de energia", "Total no período"], [
        [`Hoje (${unidade.modalidade})`, textoContratos(contratosAtuais(unidade, analise)), reais(comp.atual.custoDemanda),
          reais(comp.atual.custoEnergia), reais(comp.atual.total)],
        ...Object.entries(comp.opcoes).map(([m, v]) => [`${m} com a demanda ideal`,
          textoContratos(Object.entries(v.postos).map(([posto, p]) => [posto, p.contratada])), reais(v.custoDemanda),
          reais(v.custoEnergia), reais(v.total)]),
      ], { alinharDireita: [2, 3, 4], destacar: (i) => i > 0 && Object.keys(comp.opcoes)[i - 1] === comp.melhor, corDestaque: FUNDO_DESTAQUE });
      const figura = imagens.unidades[indice]?.modalidade;
      if (figura) doc.grafico(figura, "Custo do período em cada opção: a parte escura é a demanda e a clara, a energia. " +
        "Em verde, a opção mais barata.");
      doc.subtitulo(analise.trocar ? `Ajuste de demanda, se mantiver a tarifa ${unidade.modalidade.toLowerCase()}` : "Ajuste de demanda", 11.5);
    } else if (comp) {
      doc.paragrafo(`Modalidade tarifária: não foi possível comparar verde e azul. ${comp.motivo}`, { tamanho: 9.5, cor: SUAVE });
    }
    doc.marcadores(postos.map(([posto, r]) => recomendacao(postos.length > 1 ? posto : "Demanda", r)));
    doc.tabela(
      ["Posto", "Contratada atual", "Recomendada", "Custo atual", "Custo recomendado", "Economia", "Meses com multa hoje"],
      postos.map(([posto, r]) => [posto, kw(r.atual), kw(r.otima), reais(r.custoAtual), reais(r.custoOtimo), reais(r.economia),
        String(r.mesesUltrapassagemAtual)]),
      { alinharDireita: [1, 2, 3, 4, 5, 6] },
    );
    for (const [posto, r] of postos) {
      const figuras = imagens.unidades[indice]?.[posto];
      if (postos.length > 1) doc.subtitulo(`Posto ${posto}`, 11);
      if (figuras) {
        doc.grafico(figuras.demanda, "Barras: demanda medida em cada mês (laranja = mês com multa no contrato atual). " +
          "Linha tracejada: contratada atual. Linha verde: recomendada; a faixa verde vai até 5% acima dela, limite sem multa.");
        doc.grafico(figuras.curva, "Custo de demanda no período para cada valor contratado. À esquerda do ponto verde, as multas " +
          "de ultrapassagem encarecem a conta; à direita, paga-se por demanda que não é usada.");
        doc.grafico(figuras.custo, "Custo de demanda de cada mês com o contrato atual e com o valor recomendado. " +
          "A parte mais escura de cada barra é a multa de ultrapassagem.");
      }
      doc.tabela(
        ["Mês", "Medida (kW)", `Custo atual (${kw(r.atual)})`, "Multa atual", `Custo recomendado (${kw(r.otima)})`, "Multa recomendada"],
        analise.meses.map((mes, i) => [mes, numero(r.detalheAtual[i].medida, 1), reais(r.detalheAtual[i].custo),
          reais(r.detalheAtual[i].multa), reais(r.detalheOtimo[i].custo), reais(r.detalheOtimo[i].multa)]),
        {
          destacar: (i) => r.detalheAtual[i].multa > 0,
          alinharDireita: [1, 2, 3, 4, 5],
          rodape: ["Total", "", reais(r.custoAtual), reais(r.multaAtual), reais(r.custoOtimo),
            reais(r.detalheOtimo.reduce((s, l) => s + l.multa, 0))],
        },
      );
    }
  });

  // ---- 5. Conclusão
  doc.titulo("Conclusão e recomendações");
  const comEconomia = completos.filter((i) => i.analise.economia > 0.5);
  doc.paragrafo(comEconomia.length
    ? `Seguindo as recomendações em ${plural(comEconomia.length, "unidade", "unidades")}, a economia estimada é de ` +
      `${reais(economiaTotal)} no período analisado (${periodo}). Com os contratos atuais, as multas de ultrapassagem ` +
      `somariam ${reais(multasTotal)} no período.`
    : "Os valores de demanda contratada já são os mais econômicos para o período analisado; não há ajuste que reduza o custo.");
  if (trocas.length) {
    doc.paragrafo(`Em ${plural(trocas.length, "unidade", "unidades")} vale a pena trocar de modalidade tarifária ` +
      `(${trocas.map((i) => `${i.unidade.id}: ${i.unidade.modalidade.toLowerCase()} para ${i.analise.modalidadeRecomendada.toLowerCase()}`).join("; ")}). ` +
      "Nesses casos, a economia considera demanda e energia; nas demais, só o ajuste de demanda.");
  }
  if (imagens.economia) {
    const altura = LARGURA_UTIL * (Math.max(320, 70 * completos.length + 120) / 1000);
    doc.garantirEspaco(altura + 4);
    pdf.addImage(imagens.economia, "PNG", MARGEM, doc.y, LARGURA_UTIL, altura, undefined, "FAST");
    doc.y += altura + 6;
  }
  doc.subtitulo("Valores recomendados", 12);
  const ordenados = [...completos].sort((a, b) => b.analise.economia - a.analise.economia);
  const linhasResumo = ordenados.map(({ unidade, analise }) => [
    nome(unidade),
    analise.trocar ? `${unidade.modalidade} para ${analise.modalidadeRecomendada}` : `${unidade.modalidade} (manter)`,
    textoContratos(contratosAtuais(unidade, analise)),
    textoContratos(contratosRecomendados(analise)),
    reais(analise.economia),
  ]);
  doc.tabela(["Unidade consumidora", "Modalidade", "Demanda contratada atual", "Demanda recomendada", "Economia no período"],
    linhasResumo, {
      alinharDireita: [4], larguras: [58],
      destacar: (i) => ordenados[i].analise.trocar, corDestaque: FUNDO_DESTAQUE,
      rodape: ["Total", "", "", "", reais(economiaTotal)],
    });
  if (trocas.length) doc.paragrafo("Linhas destacadas: unidades em que se recomenda trocar de modalidade.", { tamanho: 8.5, cor: SUAVE });
  doc.subtitulo("Próximos passos", 12);
  doc.marcadores([
    ...(trocas.length ? ["Solicitar à distribuidora a troca de modalidade nas unidades indicadas, junto com o novo valor de " +
      "demanda contratada; confirmar as condições e prazos para a mudança."] : []),
    "Priorizar as unidades com maior economia e, entre elas, as que hoje pagam multas de ultrapassagem: o aumento da " +
      "demanda contratada pode ser solicitado a qualquer momento.",
    "Para reduções, verificar com a distribuidora os prazos de antecedência e de carência previstos no contrato e na " +
      "regulação antes de formalizar o pedido.",
    ...(todosMeses.length < 12 ? ["Repetir a análise com 12 meses de faturas para confirmar os valores, incluindo os meses de maior demanda."] : []),
    "Antes de reduzir, confirmar com as áreas responsáveis se há previsão de aumento de carga (novos equipamentos, obras, " +
      "expansão); nesse caso, refazer a análise informando o crescimento previsto.",
    "Acompanhar as demandas medidas após a mudança e repetir esta análise periodicamente (por exemplo, a cada 12 meses).",
  ]);
  if (incompletos.length) {
    doc.paragrafo(`Unidades fora da análise por dados incompletos: ${incompletos.map((i) => nome(i.unidade)).join("; ")}.`,
      { tamanho: 9, cor: SUAVE });
  }
  doc.paragrafo("Os valores são estimativas baseadas nas faturas do período e nas regras de faturamento vigentes; não " +
    "substituem a análise do contrato junto à distribuidora.", { tamanho: 9, cor: SUAVE });

  doc.numerarPaginas(meta.versao);
  return pdf.output("blob");
}
