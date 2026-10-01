// Leitura de contas de energia do Grupo A em PDF, direto no aparelho (pdf.js).
//
// Um PDF pode trazer uma ou várias unidades consumidoras (UCs). As faturas
// agrupadas da Light têm uma página por UC, que é lida pelo leitor específico
// (lerPaginaLight). Para outros formatos, o leitor genérico procura os rótulos
// comuns ("Demanda Contratada", "Demanda Medida", "Ponta", "Referência"...).
// O que não for encontrado fica em branco para o usuário completar.
//
// Calibrado com faturas agrupadas reais da Light (2024). Energisa e Enel ainda
// usam só o leitor genérico.

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

// ---------------------------------------------------------------- faturas da Light

/** Número inteiro ou decimal no fim da linha ('1.609' -> 1609). */
const numeroNoFim = (linha) => numeroBr(linha.trim().split(" ").at(-1));

/**
 * Lê uma página de fatura da Light ("nota fiscal" de uma UC do Grupo A).
 * Retorna null se a página não for desse tipo.
 */
export function lerPaginaLight(pagina) {
  const texto = pagina.toUpperCase();
  const linhas = texto.split("\n").map((l) => l.trim());
  const inicio = linhas.findIndex((l) => /^GRUPO A\d?/.test(l));
  if (inicio < 0) return null;

  // Número da instalação: no fim de uma das linhas do nome do cliente, logo abaixo do grupo
  let instalacao = null;
  let endereco = "";
  for (let i = inicio + 1; i < Math.min(inicio + 8, linhas.length); i++) {
    const achou = linhas[i].match(/\b(\d{8,10})$/);
    if (achou) {
      instalacao = achou[1];
      endereco = linhas[i + 1] && !/^NOTA FISCAL|^CEP/.test(linhas[i + 1]) ? linhas[i + 1] : "";
      break;
    }
  }
  const conta = {
    instalacao,
    endereco,
    modalidade: ({ AZUL: "Azul", VERDE: "Verde" })[linhas[inicio].match(/\b(AZUL|VERDE)\b/)?.[1]] ?? null,
    subgrupo: linhas[inicio].match(/^GRUPO (A\d[A-Z]?|AS)\b/)?.[1] ?? null,
    mes: null,
    contratada: null, medida: null, contratada_p: null, medida_p: null,
    consumo_p: null, consumo_fp: null,
    tarifa: null, tarifa_p: null,
    // Preços por kWh com tributos (servem para comparar as modalidades)
    energia_p: null, energia_fp: null,
  };
  const consumoMedidor = { p: null, fp: null };

  // Mês de referência: linha "FEV/2024 25/03/2024 R$8.548,72"
  const mes = texto.match(/^(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(\d{4}) \d{2}\/\d{2}\/\d{4}/m);
  if (mes) conta.mes = `${String(MESES[mes[1]]).padStart(2, "0")}/${mes[2]}`;

  // A medida do medidor é acrescida da perda de transformação, quando a conta informa
  const perda = texto.match(/PERDA DE TRANSFORMA[ÇC][ÃA]O\s*=\s*([\d,]+)\s*%/);
  const fatorPerda = perda ? 1 + numeroBr(perda[1]) / 100 : 1;

  for (const linha of linhas) {
    // Demanda contratada: bloco "Demanda 360,00" ou "Demanda Ponta 60,00" / "Demanda Fora Ponta 160,00"
    const contrato = linha.match(/\bDEMANDA( FORA PONTA| PONTA)? ([\d.]+,\d{2})$/);
    if (contrato) {
      const campo = contrato[1] === " PONTA" ? "contratada_p" : "contratada";
      conta[campo] ??= numeroBr(contrato[2]);
    }
    // Demanda medida: tabela do medidor, "Demanda Ativa-Kw Único 843 2.365 0,2523 384"
    const medidor = linha.match(/DEMANDA ATIVA-KW (FORA PONTA|PONTA|[ÚU]NICO)\b.* [\d.]+$/);
    if (medidor) {
      const campo = medidor[1] === "PONTA" ? "medida_p" : "medida";
      conta[campo] = (conta[campo] ?? 0) + numeroNoFim(linha); // soma se houver mais de um medidor
    }
    // Tarifa de demanda (preço unitário com tributos): "Demanda Ativa kW HFP/Único kW 160 24,46831364 ..."
    const tarifa = linha.match(/^DEMANDA ATIVA KW (HFP\/[ÚU]NICO|HP) KW [\d.]+ ([\d.]+,\d+)/);
    if (tarifa) conta[tarifa[1] === "HP" ? "tarifa_p" : "tarifa"] = numeroBr(tarifa[2]);
    // Energia faturada (kWh) e preço com tributos: "Energia Ativa kWh HP kWh 371 0,74344791 ..."
    const energia = linha.match(/^ENERGIA ATIVA KWH (HFP\/[ÚU]NICO|HP) KWH ([\d.]+) ([\d.]+,\d+)/);
    if (energia) {
      const posto = energia[1] === "HP" ? "p" : "fp";
      conta[`consumo_${posto}`] = (conta[`consumo_${posto}`] ?? 0) + numeroBr(energia[2]);
      conta[`energia_${posto}`] = numeroBr(energia[3]);
    }
    // Consumo do medidor, usado se a fatura não trouxer o item de energia
    const medidorEnergia = linha.match(/ENERGIA ATIVA-KWH (FORA PONTA|PONTA)\b.* [\d.]+$/);
    if (medidorEnergia) {
      const posto = medidorEnergia[1] === "PONTA" ? "p" : "fp";
      consumoMedidor[posto] = (consumoMedidor[posto] ?? 0) + numeroNoFim(linha);
    }
  }
  for (const posto of ["p", "fp"]) {
    if (conta[`consumo_${posto}`] == null && consumoMedidor[posto] != null) {
      conta[`consumo_${posto}`] = Math.round(consumoMedidor[posto] * fatorPerda);
    }
  }
  for (const campo of ["medida", "medida_p"]) {
    if (conta[campo] != null) conta[campo] = Math.round(conta[campo] * fatorPerda * 10) / 10;
  }
  conta.temDemanda = conta.contratada != null || conta.medida != null;
  return conta;
}

/** Campos que faltam numa conta, com nomes amigáveis. */
function camposFaltando(conta) {
  const obrigatorios = ["mes", "contratada", "medida"];
  if (conta.modalidade === "Azul") obrigatorios.push("contratada_p", "medida_p");
  return obrigatorios.filter((c) => conta[c] == null).map((c) => NOMES_CAMPOS[c]);
}

/**
 * Extrai as contas de um PDF já convertido em texto (uma string por página).
 * Retorna { distribuidora, contas: [...], semDemanda: [instalações sem cobrança de demanda] }.
 */
export function extrairDePaginas(paginas) {
  const distribuidora = identificarDistribuidora(paginas.join("\n").toUpperCase());
  const contasLight = paginas.map(lerPaginaLight).filter(Boolean);
  if (contasLight.length) {
    return {
      distribuidora,
      contas: contasLight.filter((c) => c.temDemanda),
      semDemanda: contasLight.filter((c) => !c.temDemanda).map((c) => c.instalacao ?? "sem número"),
    };
  }
  // Outros formatos: o arquivo inteiro é uma conta só
  const { distribuidora: _, ...conta } = extrairDeTexto(paginas.join("\n"));
  return { distribuidora, contas: [{ instalacao: null, endereco: "", ...conta }], semDemanda: [] };
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

/** Lê um arquivo PDF e devolve as contas encontradas + avisos amigáveis. */
export async function lerPdf(arquivo) {
  const resultado = { arquivo: arquivo.name, avisos: [], texto: "", contas: [], semDemanda: [] };
  let paginas;
  try {
    const biblioteca = await carregarPdfjs();
    const pdf = await biblioteca.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
    paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      paginas.push(linhasDaPagina((await pagina.getTextContent()).items).join("\n"));
    }
  } catch (erro) {
    console.error(erro);
    resultado.avisos.push("Não consegui abrir este arquivo. Ele pode estar protegido por senha ou corrompido. " +
      "Digite os valores desta conta na tabela.");
    return resultado;
  }

  resultado.texto = paginas.join("\n");
  if (resultado.texto.trim().length < 50) {
    resultado.avisos.push("Este PDF parece ser uma imagem escaneada, e não consigo ler o texto dele. " +
      "Digite os valores desta conta na tabela.");
    return resultado;
  }

  Object.assign(resultado, extrairDePaginas(paginas));
  for (const conta of resultado.contas) {
    const faltando = camposFaltando(conta);
    if (faltando.length) {
      const qual = conta.instalacao ? `Instalação ${conta.instalacao}: n` : "N";
      resultado.avisos.push(`${qual}ão encontrei ${faltando.join(", ")}. Complete na tabela.`);
    }
  }
  if (!resultado.distribuidora) resultado.avisos.push("Não reconheci a distribuidora desta conta.");
  return resultado;
}
