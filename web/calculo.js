// Cálculo de demanda contratada ótima para consumidores do Grupo A.
//
// Regras usadas (REN ANEEL 1000/2021):
// - Demanda faturada = maior valor entre contratada e medida.
// - Se a medida passar de 105% da contratada, a parcela acima da contratada
//   é cobrada como ultrapassagem, a 2x a tarifa de demanda.
//
// Na tarifa VERDE há uma demanda só. Na AZUL há duas (ponta e fora de ponta),
// e cada uma é calculada de forma independente, com sua própria tarifa.

export const TOLERANCIA = 1.05;
export const FATOR_ULTRAPASSAGEM = 2;
export const DEMANDA_MINIMA = 30; // kW, mínimo para o Grupo A

const soma = (lista) => lista.reduce((total, valor) => total + valor, 0);

/** kW de ultrapassagem no mês (zero se ficou dentro da tolerância de 5%). */
export function ultrapassagem(contratada, medida) {
  return medida > TOLERANCIA * contratada ? medida - contratada : 0;
}

/** Custo de demanda (R$) de um mês para um valor de demanda contratada. */
export function custoMes(contratada, medida, tarifa) {
  const faturada = Math.max(contratada, medida);
  const multa = ultrapassagem(contratada, medida) * FATOR_ULTRAPASSAGEM * tarifa;
  return faturada * tarifa + multa;
}

/** Soma do custo de todos os meses. */
export function custoTotal(contratada, medidas, tarifa) {
  return soma(medidas.map((m) => custoMes(contratada, m, tarifa)));
}

/** Custo total para cada demanda candidata. Retorna lista de [demanda, custo]. */
export function curvaCusto(medidas, tarifa, atual = 0) {
  // Vai até 20% acima da maior medida, ou até a contratada atual, se for maior
  const maximo = Math.max(Math.floor(Math.max(...medidas) * 1.2) + 1, Math.ceil(atual) + 1, DEMANDA_MINIMA + 1);
  const curva = [];
  for (let d = DEMANDA_MINIMA; d < maximo; d++) curva.push([d, custoTotal(d, medidas, tarifa)]);
  return curva;
}

/** Demanda contratada que minimiza o custo total (o menor valor, em caso de empate). */
export function demandaOtima(curva) {
  return curva.reduce((melhor, par) => (par[1] < melhor[1] ? par : melhor));
}

/** Quebra mês a mês: faturada, ultrapassagem, multa e custo. */
export function detalheMensal(contratada, medidas, tarifa) {
  return medidas.map((m) => {
    const excesso = ultrapassagem(contratada, m);
    return {
      medida: m,
      faturada: Math.max(contratada, m),
      ultrapassagemKw: excesso,
      multa: excesso * FATOR_ULTRAPASSAGEM * tarifa,
      custo: custoMes(contratada, m, tarifa),
    };
  });
}

/** Compara a demanda contratada atual com a ótima para um posto tarifário. */
export function analisarPosto(medidas, tarifa, atual) {
  const curva = curvaCusto(medidas, tarifa, atual);
  const [otima, custoOtimo] = demandaOtima(curva);
  const detalheAtual = detalheMensal(atual, medidas, tarifa);
  const detalheOtimo = detalheMensal(otima, medidas, tarifa);
  const custoAtual = soma(detalheAtual.map((l) => l.custo));
  return {
    tarifa, medidas, atual, otima, curva, detalheAtual, detalheOtimo,
    custoAtual,
    custoOtimo,
    economia: custoAtual - custoOtimo,
    multaAtual: soma(detalheAtual.map((l) => l.multa)),
    mesesUltrapassagemAtual: detalheAtual.filter((l) => l.multa > 0).length,
    mesesUltrapassagemOtima: detalheOtimo.filter((l) => l.multa > 0).length,
  };
}

// ---------------------------------------------------------------- escolha da modalidade

// Subgrupos que podem escolher a tarifa verde; os demais (A1, A2, A3) só podem ser azul
export const SUBGRUPOS_COM_VERDE = ["A3A", "A4", "AS"];

/** Contratada que minimiza o custo de demanda de um posto. Retorna {contratada, custo}. */
function demandaOtimaPosto(medidas, tarifa) {
  const [contratada, custo] = demandaOtima(curvaCusto(medidas, tarifa));
  return { contratada, custo };
}

/**
 * Compara o custo total (demanda + energia) do período nas modalidades verde e azul,
 * cada uma com a demanda contratada ótima, e com a situação atual.
 *
 * linhas: meses com contratada/medida (fora de ponta ou única), contratada_p/medida_p e
 *   consumo_p/consumo_fp (kWh).
 * tarifas: {Verde: {demanda, energia_p, energia_fp}, Azul: {demanda_p, demanda_fp, energia_p, energia_fp}}
 *   (R$/kW e R$/kWh, com tributos).
 *
 * Na verde a demanda é uma só: a maior do mês, em qualquer horário. Na azul, ponta e fora de
 * ponta são cobradas separadamente. Para uma unidade verde, a demanda na ponta não é medida
 * separadamente; ela é considerada igual à demanda máxima (premissa conservadora: não
 * favorece a azul).
 */
export function compararModalidades(linhas, tarifas, { modalidadeAtual, subgrupo = null, fator = 1 }) {
  if (linhas.some((l) => l.consumo_p == null || l.consumo_fp == null)) {
    return { disponivel: false, motivo: "Faltam os consumos de energia (kWh) na ponta e fora de ponta." };
  }
  const azulAtual = modalidadeAtual === "Azul";
  const completa = (t, campos) => t && campos.every((c) => t[c] > 0);
  const tv = completa(tarifas.Verde, ["demanda", "energia_p", "energia_fp"]) ? tarifas.Verde : null;
  const ta = completa(tarifas.Azul, ["demanda_p", "demanda_fp", "energia_p", "energia_fp"]) ? tarifas.Azul : null;
  if (!(azulAtual ? ta : tv)) {
    return { disponivel: false, motivo: `Faltam as tarifas da modalidade ${modalidadeAtual} para a comparação.` };
  }

  const medidaFp = linhas.map((l) => l.medida * fator);
  const medidaP = linhas.map((l) => (azulAtual ? l.medida_p : l.medida) * fator);
  const medidaUnica = medidaFp.map((m, i) => Math.max(m, medidaP[i]));
  const energia = (t) => soma(linhas.map((l) => (l.consumo_p * t.energia_p + l.consumo_fp * t.energia_fp) * fator));
  const ultima = (campo) => linhas.map((l) => l[campo]).filter((v) => v != null).at(-1);

  // Situação atual: modalidade e contratos de hoje
  const custoDemandaAtual = azulAtual
    ? custoTotal(ultima("contratada_p"), medidaP, ta.demanda_p) + custoTotal(ultima("contratada"), medidaFp, ta.demanda_fp)
    : custoTotal(ultima("contratada"), medidaUnica, tv.demanda);
  const custoEnergiaAtual = energia(azulAtual ? ta : tv);
  const atual = {
    modalidade: modalidadeAtual,
    custoDemanda: custoDemandaAtual,
    custoEnergia: custoEnergiaAtual,
    total: custoDemandaAtual + custoEnergiaAtual,
  };

  const opcoes = {};
  const verdePermitida = !subgrupo || SUBGRUPOS_COM_VERDE.includes(subgrupo.toUpperCase());
  if (tv && verdePermitida) {
    const unica = demandaOtimaPosto(medidaUnica, tv.demanda);
    const custoEnergia = energia(tv);
    opcoes.Verde = { postos: { Demanda: unica }, custoDemanda: unica.custo, custoEnergia, total: unica.custo + custoEnergia };
  }
  if (ta) {
    const ponta = demandaOtimaPosto(medidaP, ta.demanda_p);
    const foraPonta = demandaOtimaPosto(medidaFp, ta.demanda_fp);
    const custoEnergia = energia(ta);
    const custoDemanda = ponta.custo + foraPonta.custo;
    opcoes.Azul = { postos: { "Ponta": ponta, "Fora de ponta": foraPonta }, custoDemanda, custoEnergia, total: custoDemanda + custoEnergia };
  }
  const melhor = Object.keys(opcoes).reduce((a, b) => (opcoes[b].total < opcoes[a].total ? b : a));
  const outra = Object.keys(opcoes).find((m) => m !== melhor);
  return {
    disponivel: true,
    atual,
    opcoes,
    melhor,
    economia: atual.total - opcoes[melhor].total,
    diferencaEntreModalidades: outra ? opcoes[outra].total - opcoes[melhor].total : null,
    verdePermitida,
    faltaOutraModalidade: !outra && verdePermitida,
    pontaEstimada: !azulAtual,
  };
}
