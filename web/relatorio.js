// Gera o relatório da análise em Excel (ExcelJS). A biblioteca só é baixada
// quando o usuário pede o relatório.

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
const KW = '0 "kW"';
const NEGRITO = { bold: true };
const CABECALHO = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
const DESTAQUE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };

function cabecalho(aba, linha, titulos) {
  titulos.forEach((titulo, i) => {
    const celula = aba.getCell(linha, i + 1);
    celula.value = titulo;
    celula.font = NEGRITO;
    celula.fill = CABECALHO;
    celula.alignment = { wrapText: true, vertical: "middle" };
  });
}

function larguras(aba, valores) {
  valores.forEach((largura, i) => (aba.getColumn(i + 1).width = largura));
}

/** resultados: {nome do posto: resultado de analisarPosto}. Retorna um Blob .xlsx. */
export async function gerarExcel(resultados, meses, parametros) {
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();

  // ---- Resumo
  const aba = wb.addWorksheet("Resumo");
  aba.getCell("A1").value = "Análise de demanda contratada";
  aba.getCell("A1").font = { bold: true, size: 14 };
  aba.getCell("A2").value = `Gerado em ${new Date().toLocaleDateString("pt-BR")}`;
  const info = [
    ["Modalidade tarifária", parametros.modalidade],
    ["Período analisado", `${meses[0]} a ${meses.at(-1)} (${meses.length} meses)`],
    ["Crescimento de carga considerado", `${parametros.crescimento.toFixed(1).replace(".", ",")}%`],
  ];
  let linha = 4;
  for (const [rotulo, valor] of info) {
    aba.getCell(linha, 1).value = rotulo;
    aba.getCell(linha, 1).font = NEGRITO;
    aba.getCell(linha, 2).value = valor;
    linha++;
  }

  linha++;
  cabecalho(aba, linha, ["Posto", "Contratada atual", "Recomendada", "Custo atual no período",
    "Custo com a recomendada", "Economia estimada", "Multas de ultrapassagem hoje"]);
  aba.getRow(linha).height = 32;
  for (const [nome, r] of Object.entries(resultados)) {
    linha++;
    const valores = [nome, r.atual, r.otima, r.custoAtual, r.custoOtimo, r.economia, r.multaAtual];
    const formatos = [null, KW, KW, MOEDA, MOEDA, MOEDA, MOEDA];
    valores.forEach((valor, i) => {
      const celula = aba.getCell(linha, i + 1);
      celula.value = valor;
      if (formatos[i]) celula.numFmt = formatos[i];
    });
  }

  linha += 2;
  aba.getCell(linha, 1).value = "Como calculamos";
  aba.getCell(linha, 1).font = NEGRITO;
  const notas = [
    "Demanda faturada = maior valor entre a contratada e a medida.",
    "Se a medida passar de 105% da contratada, o excesso é cobrado em dobro (ultrapassagem).",
    "A demanda recomendada é a que resulta no menor custo total no período analisado.",
    "Valores de custo consideram apenas a parcela de demanda da conta.",
    "Antes de pedir a alteração, confirme com a distribuidora os prazos e condições do contrato.",
  ];
  for (const nota of notas) aba.getCell(++linha, 1).value = "• " + nota;
  larguras(aba, [34, 16, 14, 20, 22, 18, 22]);

  // ---- Uma aba de detalhe por posto
  for (const [nome, r] of Object.entries(resultados)) {
    const det = wb.addWorksheet(`Mês a mês - ${nome}`.slice(0, 31));
    cabecalho(det, 1, ["Mês", "Demanda medida (kW)", `Custo com contratada atual (${Math.round(r.atual)} kW)`,
      "Multa atual", `Custo com recomendada (${r.otima} kW)`, "Multa recomendada"]);
    det.getRow(1).height = 45;
    meses.forEach((mes, i) => {
      const a = r.detalheAtual[i];
      const o = r.detalheOtimo[i];
      const valores = [mes, a.medida, a.custo, a.multa, o.custo, o.multa];
      const formatos = ["@", "0.0", MOEDA, MOEDA, MOEDA, MOEDA];
      valores.forEach((valor, c) => {
        const celula = det.getCell(i + 2, c + 1);
        celula.value = valor;
        celula.numFmt = formatos[c];
        if (a.multa > 0) celula.fill = DESTAQUE;
      });
    });
    const total = meses.length + 2;
    det.getCell(total, 1).value = "Total";
    det.getCell(total, 1).font = NEGRITO;
    for (const [col, valor] of [[3, r.custoAtual], [5, r.custoOtimo]]) {
      const celula = det.getCell(total, col);
      celula.value = valor;
      celula.numFmt = MOEDA;
      celula.font = NEGRITO;
    }
    larguras(det, [10, 14, 22, 14, 22, 16, 4, 24, 22]);

    // Curva de custo, para quem quiser montar o gráfico no Excel
    det.getCell(1, 8).value = "Demanda contratada (kW)";
    det.getCell(1, 9).value = "Custo no período (R$)";
    det.getCell(1, 8).font = det.getCell(1, 9).font = NEGRITO;
    r.curva.forEach(([d, c], i) => {
      det.getCell(i + 2, 8).value = d;
      det.getCell(i + 2, 9).value = c;
      det.getCell(i + 2, 9).numFmt = MOEDA;
    });
  }

  const bytes = await wb.xlsx.writeBuffer();
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
