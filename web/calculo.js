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
