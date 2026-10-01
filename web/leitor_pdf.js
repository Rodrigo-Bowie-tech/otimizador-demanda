// Leitura de contas de energia em PDF, direto no aparelho (pdf.js).
//
// Um PDF pode trazer uma ou várias unidades consumidoras (UCs). Cada página é
// testada pelos leitores de cada distribuidora, que reconhecem o seu formato:
// - Light: faturas agrupadas, uma página por UC ("Grupo A4 / A4 - Verde ...");
// - Enel (antiga Ampla): faturas agrupadas, uma nota por UC ("A4 HOROSAZONAL VERDE ..."),
//   com histórico de 13 meses de demanda medida e consumo na própria nota;
// - Energisa: notas individuais (DANF3E, "Classificação: MTC-...").
// Se nenhum reconhecer o arquivo, o leitor genérico procura os rótulos comuns
// ("Demanda Contratada", "Demanda Medida", "Ponta", "Referência"...).
// O que não for encontrado fica em branco para o usuário completar.
//
// Calibrado com faturas reais da Light (2024), da Enel (2024) e da Energisa (2025,
// só Grupo B: o formato do Grupo A da Energisa ainda não foi visto).
//
// Além dos preços com tributos, os leitores guardam as tarifas sem tributos
// (coluna "Tarifa unit."), que são iguais para todas as UCs da mesma distribuidora:
// assim dá para comparar modalidades aplicando os tributos de cada UC (há UCs
// isentas de ICMS, por exemplo).

const DISTRIBUIDORAS = {
  Enel: /\bENEL\b|ENELDISTRIBUICAO|\bAMPLA ENERGIA\b/,
  Energisa: /\bENERGISA\b/,
  Light: /\bLIGHT\b/,
};

const MESES = { JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12 };
const MES_ABREVIADO = String.raw`(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)`;

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

const mesNumerico = (abreviado, ano) => `${String(MESES[abreviado.slice(0, 3)]).padStart(2, "0")}/${ano}`;
const modalidadeDe = (texto) => ({ AZUL: "Azul", VERDE: "Verde" })[texto?.match(/\b(AZUL|VERDE)\b/)?.[1]] ?? null;

function identificarDistribuidora(texto) {
  for (const [nome, padrao] of Object.entries(DISTRIBUIDORAS)) if (padrao.test(texto)) return nome;
  return null;
}

/**
 * Números no início de um trecho, até a primeira palavra: "160 24,468 3.914,93 22,78 PIS/PASEP" -> [160, 24.468, 3914.93, 22.78].
 * Percentuais ("24,00%") são pulados. Serve para ler as colunas de um item de fatura:
 * quantidade, preço com tributos, valor, ... e, por último, a tarifa sem tributos.
 */
function numerosDaCauda(cauda) {
  const numeros = [];
  for (const token of cauda.trim().split(/\s+/)) {
    if (!/^-?[\d.]+(?:,\d+)?%?-?$/.test(token)) break;
    if (!token.endsWith("%")) numeros.push(numeroBr(token.replace(/-$/, "")));
  }
  return numeros;
}

/** Item de fatura: {quantidade, preco (com tributos), base (tarifa sem tributos, se houver)}. */
function itemDaFatura(cauda) {
  const n = numerosDaCauda(cauda);
  if (n.length < 2) return null;
  return { quantidade: n[0], preco: n[1], base: n.length >= 4 ? n.at(-1) : null };
}

function novaConta(campos = {}) {
  return {
    instalacao: null, endereco: "", modalidade: null, subgrupo: null, grupoB: false, mes: null,
    contratada: null, medida: null, contratada_p: null, medida_p: null, consumo_p: null, consumo_fp: null,
    // Preços com tributos desta UC: demanda (fora de ponta ou única), demanda na ponta, energia por kWh
    tarifa: null, tarifa_p: null, energia_p: null, energia_fp: null,
    // Tarifas sem tributos (iguais para todas as UCs da distribuidora)
    base: {},
    // Meses anteriores impressos na fatura (Enel): [{mes, medida, medida_p, consumo_p, consumo_fp}]
    historico: [],
    ...campos,
  };
}

/** Fecha a conta: fator de tributos desta UC e se ela tem demanda para analisar. */
function finalizar(conta) {
  const pares = [[conta.tarifa, conta.base.demanda_fp], [conta.energia_fp, conta.base.energia_fp], [conta.tarifa_p, conta.base.demanda_p]];
  const par = pares.find(([com, sem]) => com > 0 && sem > 0);
  conta.fatorTributos = par ? par[0] / par[1] : null;
  conta.temDemanda = !conta.grupoB && (conta.contratada != null || conta.medida != null);
  return conta;
}

// ---------------------------------------------------------------- leitor genérico

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

// ---------------------------------------------------------------- Light

/** Número inteiro ou decimal no fim da linha ('1.609' -> 1609). */
const numeroNoFim = (linha) => numeroBr(linha.trim().split(" ").at(-1));

/**
 * Lê uma página de fatura da Light ("nota fiscal" de uma UC).
 * Retorna null se a página não for desse tipo.
 */
export function lerPaginaLight(pagina) {
  const texto = pagina.toUpperCase();
  const linhas = texto.split("\n").map((l) => l.trim());
  const inicio = linhas.findIndex((l) => /^GRUPO [AB]\d?/.test(l));
  if (inicio < 0) return null;

  const conta = novaConta({
    modalidade: modalidadeDe(linhas[inicio]),
    subgrupo: linhas[inicio].match(/^GRUPO (A\d[A-Z]?|AS|B\d)\b/)?.[1] ?? null,
    grupoB: /^GRUPO B/.test(linhas[inicio]),
  });

  // Número da instalação: no fim de uma das linhas do nome do cliente, logo abaixo do grupo
  for (let i = inicio + 1; i < Math.min(inicio + 8, linhas.length); i++) {
    const achou = linhas[i].match(/\b(\d{8,10})$/);
    if (achou) {
      conta.instalacao = achou[1];
      conta.endereco = linhas[i + 1] && !/^NOTA FISCAL|^CEP/.test(linhas[i + 1]) ? linhas[i + 1] : "";
      break;
    }
  }
  const consumoMedidor = { p: null, fp: null };

  // Mês de referência: linha "FEV/2024 25/03/2024 R$8.548,72"
  const mes = texto.match(new RegExp(String.raw`^${MES_ABREVIADO}\/(\d{4}) \d{2}\/\d{2}\/\d{4}`, "m"));
  if (mes) conta.mes = mesNumerico(mes[1], mes[2]);

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
    // Tarifa de demanda: "Demanda Ativa kW HFP/Único kW 160 24,46831364 3.914,93 270,13 22,78000 PIS/PASEP ..."
    const demanda = linha.match(/^DEMANDA ATIVA KW (HFP\/[ÚU]NICO|HP) KW (.*)$/);
    const itemDemanda = demanda && itemDaFatura(demanda[2]);
    if (itemDemanda) {
      const ponta = demanda[1] === "HP";
      conta[ponta ? "tarifa_p" : "tarifa"] = itemDemanda.preco;
      if (itemDemanda.base) conta.base[ponta ? "demanda_p" : "demanda_fp"] = itemDemanda.base;
    }
    // Energia faturada (kWh) e preço: "Energia Ativa kWh HP kWh 371 0,74344791 275,81 19,03 0,69215"
    const energia = linha.match(/^ENERGIA ATIVA KWH (HFP\/[ÚU]NICO|HP) KWH (.*)$/);
    const itemEnergia = energia && itemDaFatura(energia[2]);
    if (itemEnergia) {
      const p = energia[1] === "HP" ? "p" : "fp";
      conta[`consumo_${p}`] = (conta[`consumo_${p}`] ?? 0) + itemEnergia.quantidade;
      conta[`energia_${p}`] = itemEnergia.preco;
      if (itemEnergia.base) conta.base[`energia_${p}`] = itemEnergia.base;
    }
    // Consumo do medidor, usado se a fatura não trouxer o item de energia
    const medidorEnergia = linha.match(/ENERGIA ATIVA-KWH (FORA PONTA|PONTA)\b.* [\d.]+$/);
    if (medidorEnergia) {
      const p = medidorEnergia[1] === "PONTA" ? "p" : "fp";
      consumoMedidor[p] = (consumoMedidor[p] ?? 0) + numeroNoFim(linha);
    }
  }
  for (const p of ["p", "fp"]) {
    if (conta[`consumo_${p}`] == null && consumoMedidor[p] != null) {
      conta[`consumo_${p}`] = Math.round(consumoMedidor[p] * fatorPerda);
    }
  }
  for (const campo of ["medida", "medida_p"]) {
    if (conta[campo] != null) conta[campo] = Math.round(conta[campo] * fatorPerda * 10) / 10;
  }
  return finalizar(conta);
}

// ---------------------------------------------------------------- Enel (Ampla)

/**
 * Lê uma página de nota fiscal da Enel ("A4 HOROSAZONAL VERDE - Poder Público ...").
 * A tabela do medidor e a dos itens da fatura vêm lado a lado, na mesma linha de texto.
 * Retorna null se a página não for desse tipo.
 */
export function lerPaginaEnel(pagina) {
  const texto = pagina.toUpperCase();
  const linhas = texto.split("\n").map((l) => l.trim());
  const cabecalho = linhas.find((l) => /^(A\d[A-Z]?|AS|B\d)\s+(HOROSS?AZONAL|CONVENCIONAL)\b/.test(l));
  if (!cabecalho) return null;
  const subgrupo = cabecalho.match(/^(A\d[A-Z]?|AS|B\d)/)[1];
  const conta = novaConta({ subgrupo, modalidade: modalidadeDe(cabecalho), grupoB: subgrupo.startsWith("B") });

  // "ANGRA DOS REIS 3608 NOTA FISCAL Nº ..." (município e código da unidade) e "RUA ... chave de acesso:"
  const nota = texto.match(/^(.*?)\s*(\d{3,12}) NOTA FISCAL N/m);
  conta.instalacao = texto.match(/UTILIZANDO O C[ÓO]DIGO (\d+)/)?.[1] ?? nota?.[2] ?? null;
  const rua = texto.match(/^(.+?)\s+CHAVE DE ACESSO:$/m)?.[1];
  conta.endereco = [rua, nota?.[1]].filter(Boolean).join(", ");

  // Mês de referência: "09/2024 25/10/2024 R$ 3.251,16"
  const mes = texto.match(/^(\d{2})\/(\d{4}) \d{2}\/\d{2}\/\d{4} R\$/m);
  if (mes) conta.mes = `${mes[1]}/${mes[2]}`;

  const medidas = {};
  const consumoMedidor = {};
  const energia = { p: {}, fp: {} };
  let noHistorico = false;
  for (const linha of linhas) {
    // Demanda contratada: "DEMANDA FORA PONTA - KW 200,00" e "DEMANDA PONTA - KW 150,00" (na verde, só a primeira)
    for (const contrato of linha.matchAll(/DEMANDA(?: (FORA PONTA|PONTA))? - KW ([\d.]+,\d+)/g)) {
      conta[contrato[1] === "PONTA" ? "contratada_p" : "contratada"] ??= numeroBr(contrato[2]);
    }
    // Medidor: "Demanda Faturada-kW FORA PONTA 1.107,00 1.138,00 0.3360 10,41" (a constante usa ponto)
    const medidor = linha.match(/DEMANDA FATURADA-KW (FORA PONTA|PONTA) [\d.]+,\d+ [\d.]+,\d+ [\d.]+ ([\d.]+,\d+)/);
    if (medidor) {
      const p = medidor[1] === "PONTA" ? "p" : "fp";
      medidas[p] = (medidas[p] ?? 0) + numeroBr(medidor[2]);
    }
    const medidorEnergia = linha.match(/ENERGIA ATIVA-KWH (FORA PONTA|PONTA) [\d.]+,\d+ [\d.]+,\d+ [\d.]+ ([\d.]+,\d+)/);
    if (medidorEnergia) {
      const p = medidorEnergia[1] === "PONTA" ? "p" : "fp";
      consumoMedidor[p] = (consumoMedidor[p] ?? 0) + numeroBr(medidorEnergia[2]);
    }
    // Itens de demanda: "Demanda Ativa kW 30,000 53,36000 ..." (verde) ou "Demanda Ponta kW ..." (azul)
    const demanda = linha.match(/(?:^|\d )DEMANDA (ATIVA|FORA PONTA|PONTA) KW (.*)$/);
    const itemDemanda = demanda && itemDaFatura(demanda[2]);
    if (itemDemanda) {
      const ponta = demanda[1] === "PONTA";
      conta[ponta ? "tarifa_p" : "tarifa"] = itemDemanda.preco;
      if (itemDemanda.base) conta.base[ponta ? "demanda_p" : "demanda_fp"] = itemDemanda.base;
    }
    // Itens de energia, separados em TE e TUSD: "Energia Atv Forn F Ponta TE kWh 1.705,200 0,38897 ... 0,27949"
    const itemEnergia = linha.match(/(?:^|\d )ENERGIA ATV FORN (F PONTA|PONTA) (TE|TUSD) KWH (.*)$/);
    const item = itemEnergia && itemDaFatura(itemEnergia[3]);
    if (item) energia[itemEnergia[1] === "PONTA" ? "p" : "fp"][itemEnergia[2]] = item;
    // Histórico de 13 meses: "SET/2024 82,66 127,68 3349,16 31861,20 31"
    // (demanda ponta, demanda fora de ponta, consumo ponta, consumo fora de ponta, dias)
    if (/^M[ÊE]S\/ANO DEMANDA/.test(linha)) noHistorico = true;
    const historico = noHistorico &&
      linha.match(new RegExp(String.raw`^${MES_ABREVIADO}\/(\d{4}) ([\d.]+,\d+) ([\d.]+,\d+) ([\d.]+,\d+) ([\d.]+,\d+)\b`));
    if (historico) {
      const [p, fp, consumoP, consumoFp] = historico.slice(3, 7).map(numeroBr);
      conta.historico.push({ mes: mesNumerico(historico[1], historico[2]), demandaP: p, demandaFp: fp, consumo_p: consumoP, consumo_fp: consumoFp });
    }
  }

  // Energia: preço do kWh = TE + TUSD; quantidade igual nas duas
  for (const p of ["p", "fp"]) {
    const { TE, TUSD } = energia[p];
    const partes = [TE, TUSD].filter(Boolean);
    if (partes.length) {
      conta[`consumo_${p}`] = partes[0].quantidade;
      conta[`energia_${p}`] = partes.reduce((s, x) => s + x.preco, 0);
      if (partes.every((x) => x.base)) conta.base[`energia_${p}`] = partes.reduce((s, x) => s + x.base, 0);
    } else if (consumoMedidor[p] != null) {
      conta[`consumo_${p}`] = consumoMedidor[p];
    }
  }

  // Demanda medida: na verde, a maior entre ponta e fora de ponta (a verde cobra a maior do mês);
  // a da ponta fica guardada, porque serve para simular a azul
  const verde = conta.modalidade !== "Azul";
  const medidaDoMes = (p, fp) => (verde ? Math.max(p ?? 0, fp ?? 0) : fp);
  if (medidas.fp != null || medidas.p != null) {
    conta.medida = medidaDoMes(medidas.p, medidas.fp);
    conta.medida_p = medidas.p ?? null;
  }
  conta.historico = conta.historico.map(({ mes: m, demandaP, demandaFp, consumo_p, consumo_fp }) => ({
    mes: m, medida: medidaDoMes(demandaP, demandaFp), medida_p: demandaP, consumo_p, consumo_fp,
  }));
  return finalizar(conta);
}

// ---------------------------------------------------------------- Energisa

/**
 * Lê uma nota fiscal da Energisa (DANF3E, "Classificação: MTC-CONVENCIONAL BAIXA TENSÃO / B3 ...").
 * Unidades do Grupo B (baixa tensão) não têm demanda contratada. O formato do Grupo A
 * ainda não foi visto numa conta real: nesse caso usa o leitor genérico na página.
 */
export function lerPaginaEnergisa(pagina) {
  const texto = pagina.toUpperCase();
  const classificacao = texto.match(/CLASSIFICA[ÇC][ÃA]O:\s*([^\n]*)/)?.[1];
  if (!classificacao) return null;
  const subgrupo = classificacao.match(/\/\s*(A\d[A-Z]?|AS|B\d)\b/)?.[1] ?? null;
  const conta = novaConta({
    subgrupo,
    modalidade: modalidadeDe(classificacao),
    grupoB: subgrupo ? subgrupo.startsWith("B") : /BAIXA TENS[ÃA]O/.test(classificacao),
  });
  conta.instalacao = texto.match(/MATR[ÍI]CULA:\s*(\d+)/)?.[1] ?? null;
  conta.endereco = texto.match(/^((?:RUA|R\.|AV\.?|AVENIDA|ROD\.?|RODOVIA|ESTRADA|TRAVESSA|PRA[ÇC]A|ALAMEDA)\b[^\n]*?)(?:\s+-\s+CEP.*)?$/m)?.[1] ?? "";
  const mes = texto.match(/^(JANEIRO|FEVEREIRO|MAR[ÇC]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/\s*(\d{4})/m);
  if (mes) conta.mes = mesNumerico(mes[1], mes[2]);
  if (!conta.grupoB) {
    Object.assign(conta, extrairDemandas(texto));
    conta.naoCalibrado = true;
  }
  return finalizar(conta);
}

// ---------------------------------------------------------------- arquivo inteiro

/** Campos que faltam numa conta, com nomes amigáveis. */
function camposFaltando(conta) {
  const obrigatorios = ["mes", "contratada", "medida"];
  if (conta.modalidade === "Azul") obrigatorios.push("contratada_p", "medida_p");
  return obrigatorios.filter((c) => conta[c] == null).map((c) => NOMES_CAMPOS[c]);
}

/**
 * Extrai as contas de um PDF já convertido em texto (uma string por página).
 * Retorna { distribuidora, contas: [...], semDemanda: [{instalacao, motivo}], resumo }.
 * resumo = true quando o PDF é só a página de resumo de um faturamento agrupado.
 */
export function extrairDePaginas(paginas) {
  const distribuidora = identificarDistribuidora(paginas.join("\n").toUpperCase());
  const lidas = [];
  let resumo = false;
  for (const pagina of paginas) {
    const conta = lerPaginaLight(pagina) ?? lerPaginaEnel(pagina) ?? lerPaginaEnergisa(pagina);
    if (conta) lidas.push(conta);
    else if (/RESUMO DAS FATURAS DE ENERGIA/i.test(pagina)) resumo = true;
  }
  if (lidas.length) {
    return {
      distribuidora,
      resumo,
      contas: lidas.filter((c) => c.temDemanda),
      semDemanda: lidas.filter((c) => !c.temDemanda).map((c) => ({
        instalacao: c.instalacao ?? "sem número",
        motivo: c.grupoB ? "Grupo B, baixa tensão: sem demanda contratada" : "sem cobrança de demanda",
      })),
    };
  }
  if (resumo) return { distribuidora, resumo, contas: [], semDemanda: [] };
  // Outros formatos: o arquivo inteiro é uma conta só
  const { distribuidora: _, ...campos } = extrairDeTexto(paginas.join("\n"));
  return { distribuidora, resumo, contas: [finalizar(novaConta(campos))], semDemanda: [] };
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
  if (resultado.resumo && !resultado.contas.length) {
    resultado.avisos.push("Este PDF é só o resumo do faturamento agrupado e não traz os dados de cada unidade. " +
      "Envie o PDF completo, com a nota fiscal de cada unidade.");
  }
  if (!resultado.contas.length && resultado.semDemanda.some((s) => /Grupo B/.test(s.motivo))) {
    resultado.avisos.push("As unidades deste PDF são do Grupo B (baixa tensão): não têm demanda contratada, " +
      "então não há demanda para ajustar.");
  }
  for (const conta of resultado.contas) {
    const qual = conta.instalacao ? `Instalação ${conta.instalacao}: ` : "";
    const faltando = camposFaltando(conta);
    if (faltando.length) resultado.avisos.push(`${qual}não encontrei ${faltando.join(", ")}. Complete na tabela.`);
    if (conta.naoCalibrado) {
      resultado.avisos.push(`${qual}o formato desta conta da ${resultado.distribuidora ?? "distribuidora"} para o Grupo A ` +
        "ainda não foi calibrado com uma conta real. Confira os valores com atenção.");
    }
  }
  if (!resultado.distribuidora) resultado.avisos.push("Não reconheci a distribuidora desta conta.");
  return resultado;
}
