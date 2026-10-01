// Leitura de contas de energia do Grupo A em PDF, direto no aparelho (pdf.js).
//
// Estratégia: extrair o texto do PDF e procurar, linha a linha, os rótulos
// comuns nas contas ("Demanda Contratada", "Demanda Medida", "Ponta",
// "Fora Ponta", "Referência"...). O que não for encontrado fica em branco
// para o usuário completar na etapa de conferência.
//
// ATENÇÃO: os padrões abaixo são genéricos e ainda precisam ser calibrados
// com contas reais de cada distribuidora (Light, Energisa, Enel).

const DISTRIBUIDORAS = { Light: /\bLIGHT\b/, Energisa: /\bENERGISA\b/, Enel: /\bENEL\b/ };

const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };

// Número no formato brasileiro: 1.234,56 ou 410,40 ou 500
const NUMERO = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g;

const NOMES_CAMPOS = {
  mes: "mês de referência",
  contratada: "demanda contratada",
  medida: "demanda medida",
  contratada_p: "demanda contratada na ponta",
  medida_p: "demanda medida na ponta",
};

/** Converte '1.234,56' em 1234.56. */
export function numeroBr(texto) {
  return parseFloat(texto.replaceAll(".", "").replace(",", "."));
}

function identificarDistribuidora(texto) {
  for (const [nome, padrao] of Object.entries(DISTRIBUIDORAS)) if (padrao.test(texto)) return nome;
  return null;
}

/** 'Azul', 'Verde' ou null. */
function identificarModalidade(texto) {
  const pertoDoRotulo = texto.match(/(?:MODALIDADE|TARIF|SUBGRUPO|HOR[ÁA]RIA)[^\n]{0,60}?\b(AZUL|VERDE)\b/);
  if (pertoDoRotulo) return pertoDoRotulo[1] === "AZUL" ? "Azul" : "Verde";
  const temAzul = /\bAZUL\b/.test(texto);
  const temVerde = /\bVERDE\b/.test(texto);
  if (temAzul && !temVerde) return "Azul";
  if (temVerde && !temAzul) return "Verde";
  return null;
}

/** Mês de referência no formato 'MM/AAAA', ou null. */
function identificarMes(texto) {
  // O trecho entre o rótulo e a data não pode ter dígitos, para não pegar o vencimento
  const rotulo = String.raw`(?:REFER[ÊE]NCIA|M[ÊE]S\s*/\s*ANO|M[ÊE]S\s+REF)[^\n\d]{0,30}?`;
  const padroes = [
    rotulo + String.raw`\b(\d{2})\s*/\s*(\d{4})\b`,
    rotulo + String.raw`\b([A-ZÇ]{3,9})\s*(?:/|DE)\s*(\d{4})\b`,
    String.raw`\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-ZÇ]*\s*(?:/|DE)\s*(\d{4})\b`,
    String.raw`\b(\d{2})/(\d{4})\b`,
  ];
  for (const padrao of padroes) {
    for (const [, mes, ano] of texto.matchAll(new RegExp(padrao, "g"))) {
      const numero = /^\d+$/.test(mes) ? parseInt(mes, 10) : MESES[mes.slice(0, 3)];
      if (numero >= 1 && numero <= 12) return `${String(numero).padStart(2, "0")}/${ano}`;
    }
  }
  return null;
}

/** 'p' para ponta, 'fp' para fora de ponta, null se a linha não diz. */
function posto(trecho) {
  if (/FORA\s*(?:DE\s*)?PONTA|F\.?\s?PONTA|\bH?FP\b/.test(trecho)) return "fp";
  if (/\bPONTA\b|\bHP\b/.test(trecho)) return "p";
  return null;
}

/** Procura linhas de demanda contratada e medida. Retorna objeto com os campos achados. */
function extrairDemandas(texto) {
  const achados = {};
  for (const linha of texto.split("\n")) {
    if (!linha.includes("DEMANDA") || linha.includes("ULTRAP")) continue;
    const trecho = linha.slice(linha.indexOf("DEMANDA"));
    let tipo;
    if (trecho.includes("CONTRAT")) tipo = "contratada";
    else if (/MEDID|REGISTR|LIDA|MEDI[ÇC]/.test(trecho)) tipo = "medida";
    else continue;
    const numeros = trecho.match(NUMERO);
    if (!numeros) continue;
    const campo = posto(trecho) === "p" ? tipo + "_p" : tipo;
    if (!(campo in achados)) achados[campo] = numeroBr(numeros[0]); // fica com a 1ª ocorrência
  }
  return achados;
}

/** Extrai todos os campos de um texto de conta (útil também para testes). */
export function extrairDeTexto(texto) {
  texto = texto.toUpperCase();
  return {
    distribuidora: identificarDistribuidora(texto),
    modalidade: identificarModalidade(texto),
    mes: identificarMes(texto),
    ...extrairDemandas(texto),
  };
}

/** Junta os pedaços de texto do pdf.js em linhas, como aparecem na conta. */
function linhasDaPagina(itens) {
  const linhas = [];
  for (const item of itens) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    let linha = linhas.find((l) => Math.abs(l.y - y) < 3);
    if (!linha) linhas.push((linha = { y, itens: [] }));
    linha.itens.push(item);
  }
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map((l) => {
    l.itens.sort((a, b) => a.transform[4] - b.transform[4]);
    let texto = "";
    let fim = null;
    for (const item of l.itens) {
      if (fim !== null && item.transform[4] - fim > 1) texto += " ";
      texto += item.str;
      fim = item.transform[4] + item.width;
    }
    return texto.replace(/\s+/g, " ").trim();
  });
}

let pdfjs = null;

async function carregarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("./lib/pdf.min.js");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("./lib/pdf.worker.min.js", import.meta.url).href;
  }
  return pdfjs;
}

/** Lê um arquivo PDF e devolve os dados + avisos amigáveis. */
export async function lerPdf(arquivo) {
  const resultado = { arquivo: arquivo.name, avisos: [], texto: "" };
  let texto;
  try {
    const biblioteca = await carregarPdfjs();
    const pdf = await biblioteca.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      paginas.push(linhasDaPagina((await pagina.getTextContent()).items).join("\n"));
    }
    texto = paginas.join("\n");
  } catch (erro) {
    console.error(erro);
    resultado.avisos.push("Não consegui abrir este arquivo. Ele pode estar protegido por senha ou corrompido. " +
      "Digite os valores desta conta na tabela.");
    return resultado;
  }

  resultado.texto = texto;
  if (texto.trim().length < 50) {
    resultado.avisos.push("Este PDF parece ser uma imagem escaneada, e não consigo ler o texto dele. " +
      "Digite os valores desta conta na tabela.");
    return resultado;
  }

  Object.assign(resultado, extrairDeTexto(texto));

  const obrigatorios = ["mes", "contratada", "medida"];
  if (resultado.modalidade === "Azul") obrigatorios.push("contratada_p", "medida_p");
  const faltando = obrigatorios.filter((c) => resultado[c] == null).map((c) => NOMES_CAMPOS[c]);
  if (faltando.length) resultado.avisos.push("Não encontrei: " + faltando.join(", ") + ". Complete na tabela.");
  if (!resultado.distribuidora) resultado.avisos.push("Não reconheci a distribuidora desta conta.");
  return resultado;
}
