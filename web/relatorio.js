// Planilha Excel da análise (ExcelJS), com todas as unidades consumidoras.
// A biblioteca só é baixada quando o usuário pede o relatório.

let carregando = null;

function carregarExcelJS() {
  carregando ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "lib/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = reject;
    document.head.append(script);
  });
  return carregando;
}

const MOEDA = '"R$" #,##0.00';
const KW = '#,##0 "kW"';
const KW_DECIMAL = '#,##0.0';
const NEGRITO = { bold: true };
const CABECALHO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const DESTAQUE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
const SECAO = { bold: true, size: 13, color: { argb: "FF2E7D4F" } };

// Tamanho das imagens dos gráficos na planilha (pixels)
const IMAGEM = { width: 640, height: 307 };
const LINHAS_POR_IMAGEM = 17;

function cabecalho(aba, linha, titulos, coluna = 1) {
  titulos.forEach((titulo, i) => {
    const celula = aba.getCell(linha, coluna + i);
    celula.value = titulo;
    celula.font = NEGRITO;
    celula.fill = CABECALHO;
    celula.alignment = { wrapText: true, vertical: "middle" };
  });
  aba.getRow(linha).height = 32;
}

function escrever(aba, linha, valores, formatos = [], coluna = 1) {
  valores.forEach((valor, i) => {
    const celula = aba.getCell(linha, coluna + i);
    celula.value = valor;
    if (formatos[i]) celula.numFmt = formatos[i];
  });
}

function larguras(aba, valores) {
  valores.forEach((largura, i) => (aba.getColumn(i + 1).width = largura));
}

function inserirImagem(wb, aba, dataUrl, coluna, linha) {
  const id = wb.addImage({ base64: dataUrl, extension: "png" });
  aba.addImage(id, { tl: { col: coluna, row: linha }, ext: IMAGEM });
}

/** Nome de aba válido e único (até 31 caracteres, sem / \ ? * [ ] :). */
function nomeDeAba(wb, desejado) {
  const base = desejado.replace(/[/\\?*[\]:]/g, "-").slice(0, 31);
  let nome = base;
  for (let n = 2; wb.getWorksheet(nome); n++) nome = `${base.slice(0, 27)} (${n})`;
  return nome;
}

const reais = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * itens: [{unidade, analise}] de todas as unidades (analise null = dados incompletos).
 * imagens: resultado de imagensDosRelatorios. meta: {crescimento, distribuidoras}.
 * Retorna um Blob .xlsx.
 */
export async function gerarExcel(itens, imagens, meta) {
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  const completos = itens.filter((i) => i.analise);
  const ordem = (m) => Number(m.slice(3)) * 100 + Number(m.slice(0, 2));
  const todosMeses = completos.flatMap((i) => i.analise.meses).sort((a, b) => ordem(a) - ordem(b));

  // ---- Resumo
  const aba = wb.addWorksheet("Resumo");
  aba.getCell("A1").value = "Análise de demanda contratada";
  aba.getCell("A1").font = { bold: true, size: 14 };
  aba.getCell("A2").value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  const info = [
    ["Unidades consumidoras analisadas",
      `${completos.length}${completos.length < itens.length ? ` (de ${itens.length}; as demais têm dados incompletos)` : ""}`],
    ["Período analisado", todosMeses.length ? `${todosMeses[0]} a ${todosMeses.at(-1)}` : "-"],
    ...(meta.distribuidoras?.length ? [["Distribuidora", meta.distribuidoras.join(", ")]] : []),
    ["Crescimento de carga considerado", `${meta.crescimento.toLocaleString("pt-BR")}%`],
  ];
  let linha = 4;
  for (const [rotulo, valor] of info) {
    aba.getCell(linha, 1).value = rotulo;
    aba.getCell(linha, 1).font = NEGRITO;
    aba.getCell(linha, 2).value = valor;
    linha++;
  }

  linha++;
  cabecalho(aba, linha, ["Unidade consumidora", "Modalidade", "Posto", "Contratada atual", "Recomendada",
    "Custo atual no período", "Custo com a recomendada", "Economia estimada", "Multas de ultrapassagem hoje", "Meses"]);
  for (const { unidade, analise } of itens) {
    if (!analise) {
      escrever(aba, ++linha, [unidade.rotulo, unidade.modalidade, "Dados incompletos"]);
      continue;
    }
    for (const [posto, r] of Object.entries(analise.resultados)) {
      escrever(aba, ++linha, [unidade.rotulo, unidade.modalidade, posto, r.atual, r.otima, r.custoAtual, r.custoOtimo,
        r.economia, r.multaAtual, analise.meses.length], [null, null, null, KW, KW, MOEDA, MOEDA, MOEDA, MOEDA]);
    }
  }
  linha++;
  aba.getCell(linha, 1).value = "Total";
  aba.getCell(linha, 1).font = NEGRITO;
  const total = (campo) => completos.reduce((s, i) => s + Object.values(i.analise.resultados).reduce((t, r) => t + r[campo], 0), 0);
  for (const [coluna, campo] of [[6, "custoAtual"], [7, "custoOtimo"], [8, "economia"], [9, "multaAtual"]]) {
    escrever(aba, linha, [total(campo)], [MOEDA], coluna);
    aba.getCell(linha, coluna).font = NEGRITO;
  }

  linha += 2;
  aba.getCell(linha, 1).value = "Como calculamos";
  aba.getCell(linha, 1).font = NEGRITO;
  const notas = [
    "Demanda faturada = maior valor entre a contratada e a medida (REN ANEEL 1000/2021).",
    "Se a medida passar de 105% da contratada, o excesso é cobrado em dobro (ultrapassagem).",
    "A demanda recomendada é a que resulta no menor custo total no período analisado.",
    "Custos consideram apenas a parcela de demanda da conta, com a tarifa com tributos da conta mais recente.",
    "Antes de pedir a alteração, confirme com a distribuidora os prazos e condições do contrato.",
    "O detalhe mês a mês e os gráficos de cada unidade estão nas abas seguintes.",
  ];
  for (const nota of notas) aba.getCell(++linha, 1).value = "• " + nota;
  larguras(aba, [52, 12, 14, 16, 14, 20, 22, 18, 22, 8]);
  if (imagens.economia) {
    const id = wb.addImage({ base64: imagens.economia, extension: "png" });
    const altura = Math.round(IMAGEM.width * (Math.max(320, 70 * completos.length + 120) / 1000));
    aba.addImage(id, { tl: { col: 0, row: linha + 1 }, ext: { width: IMAGEM.width, height: altura } });
  }

  // ---- Uma aba por unidade, com o mês a mês e os gráficos de cada posto
  itens.forEach(({ unidade, analise }, indice) => {
    if (!analise) return;
    const postos = Object.entries(analise.resultados);
    const det = wb.addWorksheet(nomeDeAba(wb, /^\d+$/.test(unidade.id) ? unidade.id : unidade.rotulo || "Unidade"));
    det.getCell("A1").value = unidade.rotulo;
    det.getCell("A1").font = { bold: true, size: 14 };
    det.getCell("A2").value = `Tarifa ${unidade.modalidade} · tarifa de demanda ${unidade.modalidade === "Azul"
      ? `ponta R$ ${unidade.tarifa_p.toLocaleString("pt-BR")}/kW, fora de ponta R$ ${unidade.tarifa.toLocaleString("pt-BR")}/kW`
      : `R$ ${unidade.tarifa.toLocaleString("pt-BR")}/kW`}`;
    let l = 4;
    for (const [indicePosto, [posto, r]] of postos.entries()) {
      const inicio = l;
      det.getCell(l, 1).value = postos.length > 1 ? `Posto: ${posto}` : "Demanda";
      det.getCell(l, 1).font = SECAO;
      escrever(det, ++l, [`Contratada atual: ${Math.round(r.atual).toLocaleString("pt-BR")} kW`, "", "",
        `Recomendada: ${r.otima.toLocaleString("pt-BR")} kW`, "", `Economia no período: ${reais(r.economia)}`]);
      l += 2;
      cabecalho(det, l, ["Mês", "Contratada na época (kW)", "Demanda medida (kW)",
        `Custo com contratada atual (${Math.round(r.atual)} kW)`, "Multa atual", `Custo com recomendada (${r.otima} kW)`, "Multa recomendada"]);
      analise.meses.forEach((mes, i) => {
        const a = r.detalheAtual[i];
        const o = r.detalheOtimo[i];
        escrever(det, ++l, [mes, r.contratadasMes?.[i] ?? null, a.medida, a.custo, a.multa, o.custo, o.multa],
          ["@", KW_DECIMAL, KW_DECIMAL, MOEDA, MOEDA, MOEDA, MOEDA]);
        if (a.multa > 0) for (let c = 1; c <= 7; c++) det.getCell(l, c).fill = DESTAQUE;
      });
      l++;
      det.getCell(l, 1).value = "Total";
      det.getCell(l, 1).font = NEGRITO;
      const multaOtima = r.detalheOtimo.reduce((s, x) => s + x.multa, 0);
      for (const [coluna, valor] of [[4, r.custoAtual], [5, r.multaAtual], [6, r.custoOtimo], [7, multaOtima]]) {
        escrever(det, l, [valor], [MOEDA], coluna);
        det.getCell(l, coluna).font = NEGRITO;
      }
      l += 2;
      det.getCell(l, 1).value = "Linhas laranja: meses com multa de ultrapassagem no contrato atual.";
      det.getCell(l, 1).font = { italic: true, color: { argb: "FF5F6368" } };

      // Gráficos à direita da tabela, um abaixo do outro
      const figuras = imagens.unidades[indice]?.[posto];
      if (figuras) {
        [figuras.demanda, figuras.curva, figuras.custo]
          .forEach((png, i) => inserirImagem(wb, det, png, 8, inicio - 1 + i * LINHAS_POR_IMAGEM));
      }
      // Curva de custo (dados), para quem quiser refazer o gráfico no Excel: colunas próprias para cada posto
      const colunaCurva = 20 + indicePosto * 3;
      det.getCell(4, colunaCurva).value = `Curva de custo${postos.length > 1 ? ` (${posto})` : ""}`;
      det.getCell(4, colunaCurva).font = NEGRITO;
      cabecalho(det, 5, ["Demanda contratada (kW)", "Custo no período (R$)"], colunaCurva);
      r.curva.forEach(([d, c], i) => escrever(det, 6 + i, [d, c], [null, MOEDA], colunaCurva));
      det.getColumn(colunaCurva).width = 16;
      det.getColumn(colunaCurva + 1).width = 18;

      l = Math.max(l + 3, inicio + 3 * LINHAS_POR_IMAGEM + 2);
    }
    larguras(det, [10, 14, 14, 20, 14, 20, 16, 3]);
  });

  const bytes = await wb.xlsx.writeBuffer();
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
