// Otimizador de Demanda Contratada — app em 3 etapas, que roda inteiro no aparelho.
//
// Uma análise pode ter várias unidades consumidoras (UCs): as faturas agrupadas
// trazem uma UC por página. Cada UC tem sua modalidade, tarifas e meses.

import { analisarPosto, compararModalidades, DEMANDA_MINIMA } from "./calculo.js";
import { desenhar as desenharFigura, figCurvaDeCusto, figCustoPorMes, figComparacaoModalidades, figDemandaPorMes, figEconomiaPorUnidade,
  imagensDosRelatorios } from "./graficos.js";
import { lerPdf } from "./leitor_pdf.js";
import { gerarExcel } from "./relatorio.js";
import { gerarPdf } from "./relatorio_pdf.js";
import { VERSAO } from "./versao.js";

const TARIFAS_PADRAO = { tarifa: 35, tarifa_p: 90 };
const CHAVE_ARMAZENAMENTO = "estado-v2";

// Dados de exemplo (valores ilustrativos) para conhecer o programa
const EXEMPLO_MEDIDA = [410, 435, 460, 420, 380, 350, 340, 355, 390, 425, 450, 470];
const EXEMPLO_PONTA = [280, 300, 310, 290, 260, 240, 230, 245, 270, 295, 305, 320];
// Tarifas ilustrativas (com tributos) para comparar as modalidades no exemplo
const TARIFAS_EXEMPLO = {
  Geral: {
    Verde: { demanda: 35, energia_p: 1.7, energia_fp: 0.52, semTributos: false },
    Azul: { demanda_p: 90, demanda_fp: 35, energia_p: 0.71, energia_fp: 0.52, semTributos: false },
  },
};

// Colunas da tabela de conferência. Na tarifa verde só "contratada" e "medida" são usadas;
// na azul elas representam o "fora de ponta".
const ROTULOS = {
  mes: "Mês",
  contratada: "Contratada (kW)",
  medida: "Medida (kW)",
  contratada_p: "Contratada ponta (kW)",
  medida_p: "Medida ponta (kW)",
  consumo_p: "Consumo ponta (kWh)",
  consumo_fp: "Consumo fora ponta (kWh)",
};
const CAMPOS_DEMANDA = ["contratada", "medida", "contratada_p", "medida_p", "consumo_p", "consumo_fp"];
const AJUDA_CONSUMO = "Energia consumida no mês (kWh). Serve para comparar as modalidades verde e azul.";
// Tarifas com tributos usadas para comparar as modalidades
const CAMPOS_TARIFAS = {
  Verde: [["demanda", "Demanda (R$/kW)"], ["energia_p", "Energia na ponta (R$/kWh)"], ["energia_fp", "Energia fora de ponta (R$/kWh)"]],
  Azul: [["demanda_p", "Demanda na ponta (R$/kW)"], ["demanda_fp", "Demanda fora de ponta (R$/kW)"],
    ["energia_p", "Energia na ponta (R$/kWh)"], ["energia_fp", "Energia fora de ponta (R$/kWh)"]],
};
const AJUDA_CONTRATADA = "Valor de demanda que consta no contrato com a distribuidora naquele mês.";
const AJUDA_MEDIDA = "Maior demanda registrada pelo medidor no mês (também chamada de demanda registrada ou lida).";

const conteudo = document.getElementById("conteudo");
let estado = carregarEstado();
let arquivosEscolhidos = [];

// ---------------------------------------------------------------- utilidades

function novoEstado() {
  return { etapa: 1, leituras: [], unidades: [], atual: 0, crescimento: 0, tarifasRef: {}, filtro: "Todas" };
}

function novaUnidade(id, rotulo, distribuidora = null) {
  return { id, rotulo, distribuidora, modalidade: "Verde", ...TARIFAS_PADRAO, tarifasDaConta: false, fatorTributos: null, linhas: [] };
}

const unidadeAtual = () => estado.unidades[estado.atual];
const nomeDistribuidora = (u) => u.distribuidora ?? "Geral";

// O estado fica guardado no aparelho para não se perder se o app for fechado no meio
function carregarEstado() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO));
    if (salvo?.etapa && salvo.unidades?.length) {
      // Versões anteriores guardavam uma tabela de tarifas só, sem separar por distribuidora
      if (salvo.tarifasRef?.Verde || salvo.tarifasRef?.Azul) {
        salvo.tarifasRef = { Geral: { Verde: salvo.tarifasRef.Verde, Azul: salvo.tarifasRef.Azul } };
      }
      return { ...novoEstado(), ...salvo };
    }
  } catch { /* sem armazenamento: começa do zero */ }
  return novoEstado();
}

function salvarEstado() {
  try {
    // O texto extraído dos PDFs pode ser grande e só serve para suporte: não é guardado
    const leve = { ...estado, leituras: estado.leituras.map(({ texto, ...resto }) => resto) };
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(leve));
  } catch { /* sem armazenamento: segue só na memória */ }
}

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** Formata número no padrão brasileiro: R$ 1.234,56 */
function reais(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const kw = (valor) => `${Math.round(valor).toLocaleString("pt-BR")} kW`;
const arredondar2 = (valor) => Math.round(valor * 100) / 100;

/** Converte o que o usuário digitou ('1.234,5', '410.5', '410') em número, ou null. */
function lerNumero(texto) {
  let t = String(texto ?? "").trim().replace(/\s|kW/gi, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replaceAll(".", "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const mostrarNumero = (n) => (n == null ? "" : String(n).replace(".", ","));

/** Lista 'MM/AAAA' dos últimos meses completos, do mais antigo ao mais recente. */
function ultimosMeses(quantidade = 12) {
  const hoje = new Date();
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1;
  const meses = [];
  for (let i = 0; i < quantidade; i++) {
    mes -= 1;
    if (mes === 0) [ano, mes] = [ano - 1, 12];
    meses.push(`${String(mes).padStart(2, "0")}/${ano}`);
  }
  return meses.reverse();
}

/** Chave para ordenar 'MM/AAAA' cronologicamente. */
function ordemDoMes(texto) {
  const m = String(texto ?? "").trim().match(/^(\d{2})\/(\d{4})$/);
  return m ? Number(m[2]) * 100 + Number(m[1]) : 999999;
}

/** Número sequencial do mês (para contar meses entre duas datas). */
const indiceDoMes = (texto) => Math.floor(ordemDoMes(texto) / 100) * 12 + (ordemDoMes(texto) % 100);

const ordenar = (linhas) => [...linhas].sort((a, b) => ordemDoMes(a.mes) - ordemDoMes(b.mes));

function irPara(etapa) {
  estado.etapa = etapa;
  salvarEstado();
  desenhar();
  window.scrollTo({ top: 0 });
}

function linhaVazia(mes = "", arquivo = "digitado") {
  return { mes, arquivo, contratada: null, medida: null, contratada_p: null, medida_p: null, consumo_p: null, consumo_fp: null };
}

/**
 * Tarifas de cada modalidade, por distribuidora, para a comparação verde x azul. Vêm das contas
 * mais recentes de cada modalidade (numa fatura agrupada costuma haver unidades nas duas).
 * Sempre que a conta traz a tarifa sem tributos, é ela que vale: é a mesma para todas as unidades
 * da distribuidora, e cada unidade recebe depois os tributos da própria conta.
 */
function tarifasDasLeituras(leituras) {
  const tarifas = {};
  const ordem = {};
  for (const leitura of leituras) {
    for (const conta of leitura.contas) {
      const m = conta.modalidade;
      if (m !== "Verde" && m !== "Azul") continue;
      const nome = leitura.distribuidora ?? "Geral";
      const b = conta.base ?? {};
      const semTributos = m === "Verde" ? Boolean(b.demanda_fp && b.energia_p && b.energia_fp)
        : Boolean(b.demanda_p && b.demanda_fp && b.energia_p && b.energia_fp);
      const fonte = semTributos ? b
        : { demanda_fp: conta.tarifa, demanda_p: conta.tarifa_p, energia_p: conta.energia_p, energia_fp: conta.energia_fp };
      if (!fonte.demanda_fp || !fonte.energia_fp || ordemDoMes(conta.mes) < (ordem[`${nome}|${m}`] ?? -1)) continue;
      ordem[`${nome}|${m}`] = ordemDoMes(conta.mes);
      tarifas[nome] ??= {};
      tarifas[nome][m] = m === "Verde"
        ? { demanda: fonte.demanda_fp, energia_p: fonte.energia_p, energia_fp: fonte.energia_fp, mes: conta.mes, semTributos }
        : { demanda_p: fonte.demanda_p, demanda_fp: fonte.demanda_fp, energia_p: fonte.energia_p, energia_fp: fonte.energia_fp,
          mes: conta.mes, semTributos };
    }
  }
  return tarifas;
}

/** Tarifas com tributos das duas modalidades para uma unidade (as da distribuidora + os tributos da unidade). */
function tarifasDaUnidade(u) {
  const ref = estado.tarifasRef?.[nomeDistribuidora(u)] ?? {};
  const tarifas = {};
  for (const m of ["Verde", "Azul"]) {
    if (!ref[m]) continue;
    const fator = ref[m].semTributos ? (u.fatorTributos ?? 1) : 1;
    tarifas[m] = Object.fromEntries(Object.entries(ref[m])
      .filter(([, valor]) => typeof valor === "number").map(([campo, valor]) => [campo, valor * fator]));
  }
  return tarifas;
}

/** Agrupa as contas lidas dos PDFs por unidade consumidora (distribuidora + número da instalação). */
function unidadesDasLeituras(leituras) {
  const unidades = new Map();
  const comHistorico = [];
  for (const leitura of leituras) {
    for (const conta of leitura.contas) {
      const id = conta.instalacao ?? "sem-numero";
      const chave = `${leitura.distribuidora ?? "Geral"}|${id}`;
      if (!unidades.has(chave)) {
        const rotulo = conta.instalacao
          ? `Instalação ${conta.instalacao}${conta.endereco ? ` — ${conta.endereco}` : ""}`
          : "Unidade sem número de instalação";
        const unidade = novaUnidade(id, rotulo, leitura.distribuidora ?? null);
        const curto = conta.instalacao ? `${conta.instalacao}${conta.endereco ? ` - ${conta.endereco}` : ""}` : rotulo;
        unidade.nomeCurto = curto.length > 36 ? `${curto.slice(0, 35)}…` : curto;
        unidades.set(chave, { ...unidade, mesMaisRecente: -1 });
      }
      const u = unidades.get(chave);
      const linha = { mes: conta.mes ?? "", arquivo: leitura.arquivo };
      for (const campo of CAMPOS_DEMANDA) linha[campo] = conta[campo] ?? null;
      // O mesmo mês enviado duas vezes (mesmo PDF repetido) entra uma vez só
      const repetida = u.linhas.some((l) => l.mes && l.mes === linha.mes && CAMPOS_DEMANDA.every((c) => l[c] === linha[c]));
      if (!repetida) u.linhas.push(linha);
      if (conta.historico?.length) comHistorico.push({ u, conta, arquivo: leitura.arquivo });
      // Modalidade, tarifas e tributos: os da conta mais recente
      const ordem = ordemDoMes(conta.mes);
      if (ordem >= u.mesMaisRecente) {
        u.mesMaisRecente = ordem;
        if (conta.modalidade) u.modalidade = conta.modalidade;
        if (conta.subgrupo) u.subgrupo = conta.subgrupo;
        if (conta.tarifa) Object.assign(u, { tarifa: arredondar2(conta.tarifa), tarifasDaConta: true });
        if (conta.tarifa_p) u.tarifa_p = arredondar2(conta.tarifa_p);
        if (conta.fatorTributos) u.fatorTributos = conta.fatorTributos;
      }
    }
  }
  // Meses que faltam vêm do histórico impresso nas faturas (Enel), até completar os 12 meses
  // mais recentes de cada unidade; o histórico da fatura mais recente tem prioridade
  comHistorico.sort((a, b) => ordemDoMes(b.conta.mes) - ordemDoMes(a.conta.mes));
  for (const { u, conta, arquivo } of comHistorico) {
    const ultimo = indiceDoMes(u.linhas.reduce((a, l) => (ordemDoMes(l.mes) > ordemDoMes(a) ? l.mes : a), u.linhas[0].mes));
    for (const h of conta.historico) {
      const indice = indiceDoMes(h.mes);
      if (indice > ultimo || indice <= ultimo - 12 || u.linhas.some((l) => l.mes === h.mes)) continue;
      u.linhas.push({ ...linhaVazia(h.mes, `histórico da fatura de ${conta.mes} (${arquivo})`),
        medida: h.medida, medida_p: h.medida_p, consumo_p: h.consumo_p, consumo_fp: h.consumo_fp, historico: true });
    }
  }
  const lista = [...unidades.values()].map(({ mesMaisRecente, ...u }) => ({ ...u, linhas: ordenar(u.linhas) }));
  if (lista.length) {
    return lista.sort((a, b) => nomeDistribuidora(a).localeCompare(nomeDistribuidora(b)) || a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  }
  // Nada foi lido: uma linha por arquivo para o usuário digitar
  const unidade = novaUnidade("manual", "Unidade");
  unidade.linhas = leituras.map((l) => linhaVazia("", l.arquivo));
  return [unidade];
}

function indicadorDeEtapas(atual) {
  const nomes = ["Enviar contas", "Conferir valores", "Ver resultado"];
  document.getElementById("etapas").innerHTML = nomes.map((nome, i) => {
    const numero = i + 1;
    const classe = numero < atual ? "feita" : numero === atual ? "atual" : "";
    const marca = numero < atual ? "✔ " : numero === atual ? "➜ " : "";
    return `<li class="${classe}">${marca}${numero}. ${nome}</li>`;
  }).join("");
}

function desenhar() {
  if (estado.etapa > 1 && !estado.unidades.length) estado.etapa = 1;
  indicadorDeEtapas(estado.etapa);
  ({ 1: etapaEnviar, 2: etapaConferir, 3: etapaResultado })[estado.etapa]();
}

// ---------------------------------------------------------------- etapa 1

function etapaEnviar() {
  arquivosEscolhidos = [];
  conteudo.innerHTML = `
    <h2>Envie as contas de energia</h2>
    <p>Escolha os PDFs das contas de energia (Light, Enel ou Energisa) — pode misturar as distribuidoras: o app
      reconhece cada uma sozinho. Envie uma conta por mês —
      o ideal são os <strong>últimos 12 meses</strong>, para que a análise considere as variações
      ao longo do ano (verão, férias, etc.). Faturas agrupadas, com várias unidades consumidoras
      no mesmo PDF, também são aceitas.</p>
    <label class="soltar" id="soltar">
      <input type="file" id="arquivos" accept="application/pdf,.pdf" multiple>
      <span class="soltar-titulo">📄 Toque para escolher os PDFs</span>
      <span class="legenda">ou arraste os arquivos para cá</span>
    </label>
    <ul class="lista-arquivos" id="lista"></ul>
    <button class="primario largo" id="ler" disabled>Ler as contas e continuar ➜</button>
    <div id="sem-demanda" aria-live="polite"></div>
    <p class="legenda centro">Não tem os PDFs à mão?</p>
    <div class="dupla">
      <button id="digitar">✏️ Prefiro digitar os valores</button>
      <button id="exemplo">🔍 Ver um exemplo</button>
    </div>
    <p class="legenda centro">🔒 As contas são lidas no próprio aparelho e não são enviadas para a internet.</p>`;

  const entrada = document.getElementById("arquivos");
  const soltar = document.getElementById("soltar");
  const escolher = (lista) => {
    arquivosEscolhidos = [...lista].filter((a) => a.name.toLowerCase().endsWith(".pdf"));
    document.getElementById("lista").innerHTML = arquivosEscolhidos.map((a) => `<li>${escapar(a.name)}</li>`).join("");
    document.getElementById("ler").disabled = !arquivosEscolhidos.length;
  };
  entrada.addEventListener("change", () => escolher(entrada.files));
  soltar.addEventListener("dragover", (e) => { e.preventDefault(); soltar.classList.add("sobre"); });
  soltar.addEventListener("dragleave", () => soltar.classList.remove("sobre"));
  soltar.addEventListener("drop", (e) => {
    e.preventDefault();
    soltar.classList.remove("sobre");
    escolher(e.dataTransfer.files);
  });

  document.getElementById("ler").addEventListener("click", async (e) => {
    e.target.disabled = true;
    const leituras = [];
    for (const [i, arquivo] of arquivosEscolhidos.entries()) {
      e.target.textContent = `Lendo as contas... (${i + 1} de ${arquivosEscolhidos.length})`;
      leituras.push(await lerPdf(arquivo));
    }
    // Nenhum PDF trouxe unidade com demanda (só Grupo B, resumos...): explica e fica na etapa 1
    if (leituras.every((l) => !l.contas.length)) {
      e.target.textContent = "Ler as contas e continuar ➜";
      document.getElementById("sem-demanda").innerHTML = `
        <div class="aviso alerta"><strong>Nenhuma unidade com demanda contratada foi encontrada nestes PDFs.</strong>
          ${leituras.map((l) => `<p>📄 <strong>${escapar(l.arquivo)}</strong>${l.distribuidora ? ` (${escapar(l.distribuidora)})` : ""}:
            ${escapar([...l.avisos, ...(l.semDemanda ?? []).map(textoSemDemanda)].join(" ") || "não reconheci os dados da conta.")}</p>`).join("")}
          <p>A otimização de demanda vale para unidades do Grupo A (média e alta tensão). Se quiser, digite os valores.</p></div>`;
      return;
    }
    estado.leituras = leituras;
    estado.unidades = unidadesDasLeituras(leituras);
    estado.tarifasRef = tarifasDasLeituras(leituras);
    estado.atual = 0;
    estado.filtro = "Todas";
    irPara(2);
  });
  document.getElementById("digitar").addEventListener("click", () => {
    estado.leituras = [];
    const unidade = novaUnidade("manual", "Unidade");
    unidade.linhas = ultimosMeses().map((mes) => linhaVazia(mes));
    estado.unidades = [unidade];
    estado.tarifasRef = {};
    estado.filtro = "Todas";
    estado.atual = 0;
    irPara(2);
  });
  document.getElementById("exemplo").addEventListener("click", () => {
    estado.leituras = [];
    const unidade = novaUnidade("exemplo", "Exemplo");
    unidade.linhas = ultimosMeses().map((mes, i) => ({
      mes, arquivo: "exemplo", contratada: 500, medida: EXEMPLO_MEDIDA[i], contratada_p: 250, medida_p: EXEMPLO_PONTA[i],
      consumo_p: EXEMPLO_PONTA[i] * 45, consumo_fp: EXEMPLO_MEDIDA[i] * 280,
    }));
    estado.tarifasRef = structuredClone(TARIFAS_EXEMPLO);
    estado.filtro = "Todas";
    estado.unidades = [unidade];
    estado.atual = 0;
    irPara(2);
  });
}

// ---------------------------------------------------------------- etapa 2

/** Unidade fora da análise ("400061760 (sem cobrança de demanda)"); aceita o formato antigo (só o número). */
const textoSemDemanda = (s) => (typeof s === "string" ? s : `${s.instalacao} (${s.motivo})`);

function htmlLeituras(leituras) {
  if (!leituras.length) return "";
  const comAviso = leituras.filter((l) => l.avisos.length).length;
  let titulo = `Leitura dos arquivos: ${leituras.length - comAviso} ok`;
  if (comAviso) titulo += `, ${comAviso} precisam de atenção`;
  const itens = leituras.map((l) => {
    const meses = [...new Set(l.contas.map((c) => c.mes).filter(Boolean))];
    const descricao = [
      l.distribuidora,
      meses.join(", "),
      l.contas.length > 1 ? `${l.contas.length} unidades` : l.contas[0]?.modalidade && `tarifa ${l.contas[0].modalidade}`,
    ].filter(Boolean).join(" · ");
    const semDemanda = l.semDemanda?.length
      ? `<p class="legenda">Fora da análise: ${escapar(l.semDemanda.map(textoSemDemanda).join("; "))}.</p>` : "";
    return l.avisos.length
      ? `<div class="aviso alerta">⚠️ <strong>${escapar(l.arquivo)}</strong> ${escapar(descricao)}
           ${l.avisos.map((a) => `<p>${escapar(a)}</p>`).join("")}${semDemanda}</div>`
      : `<div class="aviso ok">✅ <strong>${escapar(l.arquivo)}</strong> — ${escapar(descricao)}${semDemanda}</div>`;
  }).join("");
  const lidos = leituras.filter((l) => l.texto);
  const texto = lidos.length ? `
    <details class="caixa">
      <summary>Ver o texto extraído dos PDFs (para suporte)</summary>
      <select id="texto-arquivo">${lidos.map((l, i) => `<option value="${i}">${escapar(l.arquivo)}</option>`).join("")}</select>
      <pre id="texto-extraido">${escapar(lidos[0].texto)}</pre>
    </details>` : "";
  return `<details class="caixa" ${comAviso ? "open" : ""}><summary>${titulo}</summary>${itens}</details>${texto}`;
}

function htmlSeletorUnidade() {
  if (estado.unidades.length < 2) return "";
  const opcao = (u, i) => {
    const meses = u.linhas.length;
    return `<option value="${i}" ${i === estado.atual ? "selected" : ""}>${escapar(u.rotulo)} (${u.modalidade}, ${meses} ${meses === 1 ? "mês" : "meses"})</option>`;
  };
  const grupos = distribuidoras();
  const opcoes = grupos.length > 1
    ? grupos.map((d) => `<optgroup label="${escapar(d)}">${estado.unidades.map((u, i) => (nomeDistribuidora(u) === d ? opcao(u, i) : "")).join("")}</optgroup>`).join("")
    : estado.unidades.map(opcao).join("");
  return `
    <label class="campo destaque-campo">Unidade consumidora (${estado.unidades.length} encontradas)
      <select id="unidade">${opcoes}</select>
      <span class="legenda">Confira cada unidade. No resultado, aparece um resumo de todas.</span>
    </label>`;
}

/** Distribuidoras presentes na análise, em ordem alfabética. */
const distribuidoras = () => [...new Set(estado.unidades.map(nomeDistribuidora))].sort();

function colunasVisiveis(azul) {
  // Na verde, a medida da ponta é opcional: serve para simular a azul com mais precisão
  const demanda = azul ? ["contratada_p", "medida_p", "contratada", "medida"] : ["contratada", "medida", "medida_p"];
  return ["mes", ...demanda, "consumo_p", "consumo_fp"];
}

function rotulo(coluna, azul) {
  if (azul && coluna === "contratada") return "Contratada fora ponta (kW)";
  if (azul && coluna === "medida") return "Medida fora ponta (kW)";
  if (!azul && coluna === "medida") return "Medida (kW, maior do mês)";
  if (!azul && coluna === "medida_p") return "Medida ponta (kW, opcional)";
  return ROTULOS[coluna];
}

function htmlTabela(linhasDaTabela, azul) {
  const colunas = colunasVisiveis(azul);
  const ajuda = (c) => (c === "mes" ? "Mês de referência da conta, no formato MM/AAAA."
    : c.startsWith("contratada") ? AJUDA_CONTRATADA : c.startsWith("consumo") ? AJUDA_CONSUMO : AJUDA_MEDIDA);
  const cabecalho = colunas.map((c) => `<th title="${ajuda(c)}">${rotulo(c, azul)}</th>`).join("");
  const linhas = linhasDaTabela.map((linha, i) => `
    <tr>
      ${colunas.map((c, j) => `<td><input data-linha="${i}" data-col="${j}" data-campo="${c}"
          ${c === "mes" ? 'placeholder="MM/AAAA" inputmode="numeric"' : 'inputmode="decimal"'}
          aria-label="${rotulo(c, azul)}, linha ${i + 1}"
          value="${escapar(c === "mes" ? linha.mes : mostrarNumero(linha[c]))}"></td>`).join("")}
      <td class="arquivo" title="${escapar(linha.arquivo)}">${escapar(linha.arquivo)}</td>
      <td><button class="remover" data-remover="${i}" aria-label="Remover linha ${i + 1}" title="Remover esta linha">✕</button></td>
    </tr>`).join("");
  return `
    <div class="tabela-rolagem">
      <table class="editavel">
        <thead><tr>${cabecalho}<th>Arquivo</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <button id="adicionar" class="pequeno">＋ Adicionar mês</button>`;
}

/**
 * Tarifas das duas modalidades de cada distribuidora, usadas para dizer se vale a pena trocar de
 * modalidade. Quando lidas das contas, são as tarifas sem tributos (iguais para todas as unidades da
 * distribuidora); cada unidade recebe os tributos da sua própria conta.
 */
function htmlTarifasModalidades() {
  const nomes = [...new Set([...distribuidoras(), nomeDistribuidora(unidadeAtual())])];
  const faltando = [];
  const blocos = nomes.map((nome) => {
    const ref = estado.tarifasRef?.[nome] ?? {};
    const grupo = (modalidade) => {
      const t = ref[modalidade] ?? {};
      if (CAMPOS_TARIFAS[modalidade].some(([c]) => !(t[c] > 0))) faltando.push(`${modalidade.toLowerCase()} (${nome})`);
      const origem = t.mes ? `conta de ${t.mes}, ${t.semTributos ? "sem tributos" : "com tributos"}` : "com tributos";
      return `
        <fieldset class="tarifas-modalidade">
          <legend>Tarifa ${modalidade} <span class="legenda">(${origem})</span></legend>
          ${CAMPOS_TARIFAS[modalidade].map(([campo, rotuloCampo]) => `
            <label class="campo">${rotuloCampo}
              <input data-tarifa="${escapar(nome)}|${modalidade}|${campo}" inputmode="decimal"
                value="${mostrarNumero(t[campo] != null ? Math.round(t[campo] * 1e6) / 1e6 : null)}"></label>`).join("")}
        </fieldset>`;
    };
    return `${nomes.length > 1 ? `<h4>${escapar(nome)}</h4>` : ""}<div class="dupla">${grupo("Verde")}${grupo("Azul")}</div>`;
  }).join("");
  return `
    <details class="caixa" ${faltando.length ? "open" : ""}>
      <summary>⚖️ Comparar as modalidades verde e azul${faltando.length ? ` — faltam tarifas: ${escapar(faltando.join(", "))}` : ""}</summary>
      <p class="legenda">O app calcula o custo de demanda <strong>e de energia</strong> nas duas modalidades, cada uma com a demanda
        contratada ideal, e diz qual sai mais barata, usando os consumos (kWh) da tabela e as tarifas abaixo. As tarifas lidas
        das contas são as <strong>sem tributos</strong> (iguais para todas as unidades da distribuidora); cada unidade recebe
        os tributos da própria conta, o que considera, por exemplo, unidades isentas de ICMS. Se digitar, use valores com tributos.</p>
      ${blocos}
    </details>`;
}

/** Limpa as linhas e devolve [linhas, lista de erros]. */
function validar(linhas, azul) {
  linhas = linhas.map((l) => ({ ...l, mes: String(l.mes ?? "").trim() })).filter((l) => l.mes);
  if (!linhas.length) return [linhas, ["Preencha pelo menos um mês na tabela."]];

  const medidas = azul ? ["medida", "medida_p"] : ["medida"];
  const contratadas = azul ? ["contratada", "contratada_p"] : ["contratada"];
  const erros = [];
  const formatoErrado = linhas.filter((l) => !/^\d{2}\/\d{4}$/.test(l.mes) || ordemDoMes(l.mes) % 100 > 12
    || ordemDoMes(l.mes) % 100 === 0).map((l) => l.mes);
  if (formatoErrado.length) {
    erros.push(`Escreva o mês no formato MM/AAAA (ex.: 09/2026). Verifique: ${formatoErrado.join(", ")}.`);
  }
  const vistos = new Set();
  const repetidos = new Set();
  for (const l of linhas) (vistos.has(l.mes) ? repetidos : vistos).add(l.mes);
  if (repetidos.size) erros.push(`Cada mês deve aparecer uma vez só. Repetido(s): ${[...repetidos].join(", ")}.`);
  const semMedida = linhas.filter((l) => medidas.some((c) => l[c] == null)).map((l) => l.mes);
  if (semMedida.length) erros.push(`Falta a demanda medida em: ${semMedida.join(", ")}.`);
  for (const c of contratadas) {
    if (linhas.every((l) => l[c] == null)) {
      erros.push(`Preencha a coluna "${rotulo(c, azul)}" em pelo menos um mês (de preferência no mais recente).`);
    }
  }
  return [ordenar(linhas), erros];
}

/** Erros da unidade inteira: tabela + tarifas. */
function validarUnidade(u) {
  const azul = u.modalidade === "Azul";
  const [linhas, erros] = validar(u.linhas, azul);
  if (!erros.length && (!(u.tarifa > 0) || (azul && !(u.tarifa_p > 0)))) {
    erros.push("Informe a tarifa de demanda (valor maior que zero).");
  }
  return [linhas, erros];
}

function etapaConferir() {
  const u = unidadeAtual();
  const azul = u.modalidade === "Azul";
  conteudo.innerHTML = `
    <h2>Confira os valores</h2>
    ${htmlLeituras(estado.leituras)}
    ${htmlSeletorUnidade()}

    <fieldset class="segmentado">
      <legend>Modalidade tarifária</legend>
      <label><input type="radio" name="modalidade" value="Verde" ${azul ? "" : "checked"}> Verde</label>
      <label><input type="radio" name="modalidade" value="Azul" ${azul ? "checked" : ""}> Azul</label>
    </fieldset>
    <p class="legenda"><strong>Verde:</strong> um único valor de demanda contratada.
      <strong>Azul:</strong> um valor para o horário de ponta e outro para fora de ponta.
      Está escrita na conta, perto de "Modalidade tarifária" ou "Subgrupo".</p>

    <h3>Demandas de cada mês</h3>
    <p class="legenda">Corrija o que estiver errado e preencha as células vazias. Você também pode colar
      valores copiados do Excel. A demanda contratada <strong>atual</strong> é a do mês mais recente da tabela.</p>
    ${htmlTabela(u.linhas, azul)}

    <h3>Tarifas de demanda</h3>
    <p class="legenda">${u.tarifasDaConta
      ? "✓ Preenchidas com o preço por kW (com tributos) da conta mais recente desta unidade. Confira se quiser."
      : "Na conta, procure a linha de <em>Demanda</em> e use o preço por kW (R$/kW), de preferência já com impostos."}
      A tarifa <strong>não muda</strong> qual é a demanda recomendada — ela só serve para calcular a economia em reais.</p>
    <div class="${azul ? "dupla" : ""}">
      ${azul ? `<label class="campo">Tarifa na ponta (R$/kW)
        <input id="tarifa_p" inputmode="decimal" value="${mostrarNumero(u.tarifa_p)}"></label>` : ""}
      <label class="campo">${azul ? "Tarifa fora de ponta (R$/kW)" : "Tarifa de demanda (R$/kW)"}
        <input id="tarifa" inputmode="decimal" value="${mostrarNumero(u.tarifa)}"></label>
    </div>
    <label class="campo">Crescimento de carga previsto (%)
      <input id="crescimento" inputmode="decimal" value="${mostrarNumero(estado.crescimento)}">
      <span class="legenda">Use se houver previsão de novos equipamentos, expansão ou redução de atividades.
        Ex.: 10 = a demanda vai crescer 10% em relação aos meses da tabela.${estado.unidades.length > 1 ? " Vale para todas as unidades." : ""}</span>
    </label>

    ${htmlTarifasModalidades()}

    <div id="erros"></div>
    <div class="dupla">
      <button id="voltar">⬅ Voltar</button>
      <button id="calcular" class="primario">Calcular ➜</button>
    </div>`;

  const seletorTexto = document.getElementById("texto-arquivo");
  seletorTexto?.addEventListener("change", () => {
    document.getElementById("texto-extraido").textContent = estado.leituras.filter((l) => l.texto)[seletorTexto.value].texto;
  });
  document.getElementById("unidade")?.addEventListener("change", (e) => {
    lerParametros();
    estado.atual = Number(e.target.value);
    salvarEstado();
    etapaConferir();
  });

  for (const radio of conteudo.querySelectorAll('input[name="modalidade"]')) {
    radio.addEventListener("change", () => { lerParametros(); u.modalidade = radio.value; salvarEstado(); etapaConferir(); });
  }

  const tabela = conteudo.querySelector("table.editavel");
  tabela.addEventListener("input", (e) => {
    const campo = e.target.dataset.campo;
    if (!campo) return;
    const linha = u.linhas[e.target.dataset.linha];
    linha[campo] = campo === "mes" ? e.target.value : lerNumero(e.target.value);
    salvarEstado();
  });
  tabela.addEventListener("paste", (e) => colar(e, u, azul));
  tabela.addEventListener("click", (e) => {
    const i = e.target.dataset.remover;
    if (i === undefined) return;
    lerParametros();
    u.linhas.splice(Number(i), 1);
    salvarEstado();
    etapaConferir();
  });
  document.getElementById("adicionar").addEventListener("click", () => {
    lerParametros();
    u.linhas.push(linhaVazia());
    salvarEstado();
    etapaConferir();
    conteudo.querySelector(`input[data-linha="${u.linhas.length - 1}"]`).focus();
  });

  function lerParametros() {
    u.tarifa = lerNumero(document.getElementById("tarifa").value) ?? 0;
    if (azul) u.tarifa_p = lerNumero(document.getElementById("tarifa_p").value) ?? 0;
    estado.crescimento = lerNumero(document.getElementById("crescimento").value) ?? 0;
    salvarEstado();
  }
  for (const id of ["tarifa", "tarifa_p", "crescimento"]) document.getElementById(id)?.addEventListener("input", lerParametros);
  for (const campo of conteudo.querySelectorAll("[data-tarifa]")) {
    campo.addEventListener("input", () => {
      const [nome, modalidade, chave] = campo.dataset.tarifa.split("|");
      estado.tarifasRef ??= {};
      estado.tarifasRef[nome] ??= {};
      estado.tarifasRef[nome][modalidade] ??= { semTributos: false };
      estado.tarifasRef[nome][modalidade][chave] = lerNumero(campo.value);
      salvarEstado();
    });
  }

  document.getElementById("voltar").addEventListener("click", () => irPara(1));
  document.getElementById("calcular").addEventListener("click", () => {
    lerParametros();
    const [linhas, erros] = validarUnidade(u);
    if (!erros.length && (estado.crescimento < -50 || estado.crescimento > 200)) {
      erros.push("O crescimento de carga deve ficar entre -50% e 200%.");
    }
    if (erros.length) {
      document.getElementById("erros").innerHTML = erros.map((erro) => `<div class="aviso erro">✋ ${escapar(erro)}</div>`).join("");
      document.getElementById("erros").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    u.linhas = linhas;
    irPara(3);
  });
}

/** Colar um bloco copiado do Excel a partir da célula selecionada. */
function colar(e, u, azul) {
  const alvo = e.target;
  if (!alvo.dataset.campo) return;
  const texto = e.clipboardData.getData("text/plain");
  if (!/[\t\n]/.test(texto.trim())) return; // um valor só: deixa o navegador colar normalmente
  e.preventDefault();
  const colunas = colunasVisiveis(azul);
  const linhaInicial = Number(alvo.dataset.linha);
  const colunaInicial = Number(alvo.dataset.col);
  texto.replace(/\r/g, "").replace(/\n+$/, "").split("\n").forEach((textoLinha, i) => {
    const linha = (u.linhas[linhaInicial + i] ??= linhaVazia());
    textoLinha.split("\t").forEach((valor, j) => {
      const campo = colunas[colunaInicial + j];
      if (campo) linha[campo] = campo === "mes" ? valor.trim() : lerNumero(valor);
    });
  });
  salvarEstado();
  etapaConferir();
}

// ---------------------------------------------------------------- etapa 3

/** Analisa uma unidade. Retorna null se os dados dela estiverem incompletos. */
function analisarUnidade(u) {
  const [linhas, erros] = validarUnidade(u);
  if (erros.length) return null;
  const fator = 1 + estado.crescimento / 100;
  const analisar = (campoMedida, campoContratada, tarifa) => {
    const medidas = linhas.map((l) => l[campoMedida] * fator);
    const atual = linhas.map((l) => l[campoContratada]).filter((v) => v != null).at(-1);
    const resultado = analisarPosto(medidas, tarifa, atual);
    // Contratada de cada mês (meses em branco repetem o mês anterior), para os gráficos
    let anterior = linhas.find((l) => l[campoContratada] != null)[campoContratada];
    resultado.contratadasMes = linhas.map((l) => (anterior = l[campoContratada] ?? anterior));
    return resultado;
  };
  const resultados = u.modalidade === "Azul"
    ? { "Ponta": analisar("medida_p", "contratada_p", u.tarifa_p), "Fora de ponta": analisar("medida", "contratada", u.tarifa) }
    : { "Demanda": analisar("medida", "contratada", u.tarifa) };
  const economiaDemanda = Object.values(resultados).reduce((total, r) => total + r.economia, 0);
  // Verde x azul: custo de demanda + energia de cada modalidade, com a demanda ideal de cada uma
  const comparacao = compararModalidades(linhas, tarifasDaUnidade(u), { modalidadeAtual: u.modalidade, subgrupo: u.subgrupo, fator });
  const trocar = comparacao.disponivel && comparacao.melhor !== u.modalidade;
  return {
    resultados, meses: linhas.map((l) => l.mes), linhas, comparacao, trocar, economiaDemanda,
    modalidadeRecomendada: trocar ? comparacao.melhor : u.modalidade,
    // Economia da melhor opção: trocar de modalidade, ou só ajustar a demanda na modalidade atual
    economia: trocar ? comparacao.economia : economiaDemanda,
  };
}

/** Contratos recomendados: [[posto, kW]] na modalidade recomendada. */
function contratosRecomendados(a) {
  return a.trocar
    ? Object.entries(a.comparacao.opcoes[a.comparacao.melhor].postos).map(([posto, p]) => [posto, p.contratada])
    : Object.entries(a.resultados).map(([posto, r]) => [posto, r.otima]);
}

const textoContratos = (contratos) => (contratos.length > 1
  ? contratos.map(([posto, valor]) => `${posto.toLowerCase()} ${kw(valor)}`).join(" e ")
  : kw(contratos[0][1]));

/** Quadro "Modalidade tarifária": situação atual x verde x azul, cada uma com a demanda ideal. */
function htmlModalidade(u, a) {
  const comp = a.comparacao;
  if (!comp.disponivel) {
    return `<div class="aviso info">⚖️ <strong>Modalidade tarifária:</strong> não foi possível comparar verde e azul.
      ${escapar(comp.motivo)} <button class="pequeno" id="ir-tarifas">Completar na etapa 2</button></div>`;
  }
  const ultima = (campo) => a.linhas.map((l) => l[campo]).filter((v) => v != null).at(-1);
  const contratosAtuais = u.modalidade === "Azul"
    ? `ponta ${kw(ultima("contratada_p"))}, fora de ponta ${kw(ultima("contratada"))}` : kw(ultima("contratada"));
  const linha = (nome, contratos, v, melhor) => `<tr class="${melhor ? "melhor" : ""}"><td>${nome}</td>
    <td data-rotulo="Demanda contratada">${contratos}</td><td data-rotulo="Custo de demanda">${reais(v.custoDemanda)}</td>
    <td data-rotulo="Custo de energia">${reais(v.custoEnergia)}</td><td data-rotulo="Total no período">${reais(v.total)}</td></tr>`;
  const opcoes = Object.entries(comp.opcoes).map(([m, v]) => linha(`${m} com a demanda ideal`,
    textoContratos(Object.entries(v.postos).map(([posto, p]) => [posto, p.contratada])), v, m === comp.melhor)).join("");
  const notas = [];
  if (!comp.verdePermitida) notas.push(`O subgrupo ${escapar(u.subgrupo)} não pode optar pela tarifa verde.`);
  if (comp.faltaOutraModalidade) {
    notas.push(`Faltam as tarifas da modalidade ${u.modalidade === "Azul" ? "verde" : "azul"} para comparar. Preencha-as na etapa 2.`);
  }
  if (comp.pontaEstimada && comp.opcoes.Azul) {
    notas.push("Na tarifa verde a demanda na ponta não é medida separadamente; para simular a azul ela foi considerada igual à " +
      "demanda máxima do mês. Por isso, a simulação da azul é conservadora.");
  }
  const conclusao = a.trocar
    ? `<strong>Vale a pena trocar para a tarifa ${comp.melhor}:</strong> com a demanda ideal, o custo no período cai de
        ${reais(comp.atual.total)} para ${reais(comp.opcoes[comp.melhor].total)}.`
    : comp.diferencaEntreModalidades != null
      ? `<strong>A tarifa ${u.modalidade} atual é a mais econômica:</strong> a ${u.modalidade === "Azul" ? "verde" : "azul"}
          custaria ${reais(comp.diferencaEntreModalidades)} a mais no período, mesmo com a demanda ideal.`
      : `<strong>Tarifa ${u.modalidade}.</strong>`;
  return `
    <div class="modalidade-card">
      <h3>⚖️ Modalidade tarifária</h3>
      <p>${conclusao}</p>
      <div class="tabela-rolagem">
        <table class="comparacao">
          <thead><tr><th>Opção</th><th>Demanda contratada</th><th>Custo de demanda</th><th>Custo de energia</th><th>Total no período</th></tr></thead>
          <tbody>${linha(`Hoje (${u.modalidade})`, contratosAtuais, comp.atual, false)}${opcoes}</tbody>
        </table>
      </div>
      <div class="grafico" id="grafico-modalidade"></div>
      ${notas.map((n) => `<p class="legenda">${n}</p>`).join("")}
    </div>`;
}

function fraseRecomendacao(nome, r) {
  const atual = kw(r.atual);
  const otima = kw(r.otima);
  if (r.otima < r.atual) {
    return `<strong>${nome}:</strong> reduzir de ${atual} para <strong>${otima}</strong>. ` +
      "Hoje é paga uma demanda maior do que a realmente usada.";
  }
  if (r.otima > r.atual) {
    const n = r.mesesUltrapassagemAtual;
    return `<strong>${nome}:</strong> aumentar de ${atual} para <strong>${otima}</strong>. ` +
      `Com o contrato atual houve multa de ultrapassagem em ${n} ${n === 1 ? "mês" : "meses"}, ` +
      `somando ${reais(r.multaAtual)}. Contratar um pouco mais sai mais barato que pagar a multa.`;
  }
  return `<strong>${nome}:</strong> manter ${atual}. O valor atual já é o mais econômico.`;
}

/** Tabela com todas as unidades, da que mais economiza para a que menos. */
/** A unidade aparece no filtro de distribuidora escolhido no resultado? */
const visivel = (u) => !estado.filtro || estado.filtro === "Todas" || nomeDistribuidora(u) === estado.filtro;

/** Botões para ver todas as distribuidoras ou uma só, com a economia de cada uma. */
function htmlFiltro(analises) {
  const nomes = distribuidoras();
  if (nomes.length < 2) return "";
  const economia = (nome) => estado.unidades.reduce((s, u, i) =>
    s + (nome === "Todas" || nomeDistribuidora(u) === nome ? analises[i]?.economia ?? 0 : 0), 0);
  const quantas = (nome) => estado.unidades.filter((u) => nome === "Todas" || nomeDistribuidora(u) === nome).length;
  return `<div class="filtros" role="group" aria-label="Distribuidora">${["Todas", ...nomes].map((nome) => `
    <button class="filtro" data-filtro="${escapar(nome)}" aria-pressed="${(estado.filtro ?? "Todas") === nome}">
      <strong>${escapar(nome)}</strong> <span>${quantas(nome)} ${quantas(nome) === 1 ? "unidade" : "unidades"} · ${reais(economia(nome))}</span>
    </button>`).join("")}</div>`;
}

function htmlResumo(analises) {
  const ordem = estado.unidades.map((u, i) => i).filter((i) => visivel(estado.unidades[i]))
    .sort((a, b) => (analises[b]?.economia ?? -1) - (analises[a]?.economia ?? -1));
  const total = ordem.reduce((soma, i) => soma + (analises[i]?.economia ?? 0), 0);
  const variasDistribuidoras = distribuidoras().length > 1;
  const nomeUnidade = (u) => `${escapar(u.rotulo)}${variasDistribuidoras ? `<br><span class="legenda">${escapar(nomeDistribuidora(u))}</span>` : ""}`;
  const linhas = ordem.map((i) => {
    const u = estado.unidades[i];
    const a = analises[i];
    const atual = i === estado.atual ? ' class="selecionada"' : "";
    if (!a) {
      return `<tr${atual}><td>${nomeUnidade(u)}</td><td>${u.modalidade}</td><td colspan="2">Dados incompletos</td>
        <td><button class="pequeno" data-corrigir="${i}">Corrigir</button></td></tr>`;
    }
    const contratos = contratosRecomendados(a);
    const mudanca = a.trocar
      ? contratos.map(([nome, valor]) => `${contratos.length > 1 ? `${nome}: ` : ""}<strong>${kw(valor)}</strong>`).join("<br>")
      : Object.entries(a.resultados).map(([nome, r]) =>
        `${a.resultados.Ponta ? `${nome}: ` : ""}${kw(r.atual)} → <strong>${kw(r.otima)}</strong>`).join("<br>");
    const modalidade = a.trocar ? `${u.modalidade} → <strong>${a.modalidadeRecomendada}</strong>` : u.modalidade;
    return `<tr${atual}><td>${nomeUnidade(u)}</td><td>${modalidade}</td><td>${mudanca}</td>
      <td>${a.economia > 0.5 ? reais(a.economia) : "—"}</td>
      <td><button class="pequeno" data-ver="${i}">${i === estado.atual ? "Exibindo" : "Ver"}</button></td></tr>`;
  }).join("");
  return `
    <h2>${estado.filtro && estado.filtro !== "Todas" ? `Unidades da ${escapar(estado.filtro)}` : "Todas as unidades"}</h2>
    ${htmlFiltro(analises)}
    <p>Economia estimada somando ${ordem.length === 1 ? "a unidade" : `as ${ordem.length} unidades`}:
      <strong>${reais(total)}</strong> no período analisado.</p>
    ${ordem.some((i) => analises[i]?.trocar) ? `<p class="legenda">Nas unidades em que vale a pena trocar de modalidade, a economia
      considera demanda e energia; nas demais, só o ajuste de demanda.</p>` : ""}
    <div class="grafico grafico-economia" id="grafico-economia"></div>
    <div class="tabela-rolagem">
      <table class="resumo">
        <thead><tr><th>Unidade</th><th>Modalidade</th><th>Demanda contratada recomendada</th><th>Economia</th><th></th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>
    <hr>`;
}

function htmlPosto(id, meses, r) {
  const percentual = r.custoAtual ? (r.economia / r.custoAtual).toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 }) : "";
  const linhas = meses.map((mes, i) => {
    const a = r.detalheAtual[i];
    const o = r.detalheOtimo[i];
    return `<tr class="${a.multa > 0 ? "com-multa" : ""}"><td>${mes}</td><td>${a.medida.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td>
      <td>${reais(a.custo)}</td><td>${reais(a.multa)}</td><td>${reais(o.custo)}</td><td>${reais(o.multa)}</td></tr>`;
  }).join("");
  return `
    <div class="metricas">
      <div class="metrica" title="Valor do mês mais recente da tabela."><span>Contratada atual</span><strong>${kw(r.atual)}</strong></div>
      <div class="metrica" title="Valor que resulta no menor custo total no período, considerando as multas de ultrapassagem.">
        <span>Recomendada</span><strong>${kw(r.otima)}</strong></div>
      <div class="metrica" title="Custo atual ${reais(r.custoAtual)} − custo com a recomendada ${reais(r.custoOtimo)}.">
        <span>Economia no período</span><strong>${reais(r.economia)}</strong>
        ${r.economia > 0.5 ? `<small class="positivo">↓ ${percentual} do custo de demanda</small>` : ""}</div>
    </div>

    <h3>Demanda medida mês a mês</h3>
    <div class="grafico" id="grafico-mes-${id}"></div>
    <p class="legenda">Cada barra é a maior demanda registrada no mês. <strong>Barras laranja</strong> são meses com multa
      de ultrapassagem no contrato atual. A <strong>linha verde</strong> é a demanda recomendada, e a faixa verde mostra até
      onde a demanda pode chegar sem multa (5% acima da contratada).</p>

    <h3>Quanto custaria cada opção</h3>
    <div class="grafico" id="grafico-curva-${id}"></div>
    <p class="legenda">Cada ponto da curva mostra quanto seria pago de demanda no período para cada valor contratado.
      <strong>À esquerda</strong> do ponto verde, as multas de ultrapassagem encarecem a conta; <strong>à direita</strong>,
      paga-se por uma demanda que não é usada.</p>

    <h3>Custo de cada mês: atual x recomendada</h3>
    <div class="grafico" id="grafico-custo-${id}"></div>
    <p class="legenda">Custo de demanda de cada mês com o contrato atual (laranja) e com o valor recomendado (verde).
      A parte mais escura de cada barra é a multa de ultrapassagem.</p>

    <details class="caixa">
      <summary>Ver detalhes mês a mês</summary>
      <div class="tabela-rolagem">
        <table class="detalhe">
          <thead><tr><th>Mês</th><th>Medida (kW)</th><th>Custo atual (${kw(r.atual)})</th><th>Multa atual</th>
            <th>Custo recomendado (${kw(r.otima)})</th><th>Multa recomendada</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    </details>`;
}

async function desenharGraficos(id, meses, r) {
  try {
    await desenharFigura(document.getElementById(`grafico-mes-${id}`), figDemandaPorMes(meses, r));
    await desenharFigura(document.getElementById(`grafico-curva-${id}`), figCurvaDeCusto(r));
    await desenharFigura(document.getElementById(`grafico-custo-${id}`), figCustoPorMes(meses, r));
  } catch (erro) {
    console.error(erro);
    for (const el of conteudo.querySelectorAll(`#grafico-mes-${id}, #grafico-curva-${id}, #grafico-custo-${id}`)) {
      el.innerHTML = '<p class="aviso alerta">Não consegui carregar o gráfico. Verifique a internet e abra o app de novo.</p>';
    }
  }
}

function etapaResultado() {
  const analises = estado.unidades.map(analisarUnidade);
  // Só as unidades da distribuidora escolhida no filtro (ou todas)
  const indicesVisiveis = estado.unidades.map((_, i) => i).filter((i) => visivel(estado.unidades[i]));
  if (!indicesVisiveis.length) estado.filtro = "Todas";
  if (indicesVisiveis.length && !indicesVisiveis.includes(estado.atual)) {
    estado.atual = indicesVisiveis.find((i) => analises[i]) ?? indicesVisiveis[0];
  }
  const u = unidadeAtual();
  const analise = analises[estado.atual];
  if (!analise) return irPara(2); // dados da unidade escolhida ficaram incompletos
  const { resultados, meses, economiaDemanda, comparacao } = analise;
  const postos = Object.entries(resultados);
  const varias = estado.unidades.length > 1;

  const periodo = `nos ${meses.length} meses analisados (${meses[0]} a ${meses.at(-1)})`;
  const destaque = analise.trocar
    ? `<div class="aviso sucesso"><h2>💡 Trocar para a tarifa ${comparacao.melhor}: economia de ${reais(comparacao.economia)}</h2>
        <p>${periodo}, somando demanda e energia, contratando ${textoContratos(contratosRecomendados(analise))}.</p>
        <ul><li>Só ajustando a demanda e mantendo a tarifa ${u.modalidade}, a economia seria de ${reais(economiaDemanda)}
          (detalhes abaixo).</li></ul></div>`
    : `${economiaDemanda > 0.5
      ? `<div class="aviso sucesso"><h2>💡 Economia estimada de ${reais(economiaDemanda)}</h2>
          <p>${periodo}, ajustando a demanda contratada:</p>`
      : `<div class="aviso info"><h2>👍 A demanda contratada já está no valor mais econômico</h2>
          <p>Não há ajuste que reduza o custo no período analisado.</p>`}
        <ul>${postos.map(([nome, r]) => `<li>${fraseRecomendacao(nome, r)}</li>`).join("")}</ul></div>`;
  const avisos = [];
  if (meses.length < 12) {
    avisos.push(`<div class="aviso alerta">📅 A análise usou só ${meses.length} ${meses.length === 1 ? "mês" : "meses"}. Com menos de 12,
      a recomendação pode não considerar os meses de maior consumo do ano. Se possível, inclua mais contas.</div>`);
  }
  const doHistorico = analise.linhas.filter((l) => l.historico).length;
  if (doHistorico) {
    avisos.push(`<div class="aviso info">🗂️ ${doHistorico} dos ${meses.length} meses vieram do histórico impresso na fatura
      (demanda medida e consumo). A demanda contratada desses meses é considerada igual à atual.</div>`);
  }
  if (estado.crescimento) {
    avisos.push(`<div class="aviso info">📈 As demandas medidas foram ajustadas em
      ${estado.crescimento > 0 ? "+" : ""}${estado.crescimento.toLocaleString("pt-BR")}% para considerar o crescimento de carga previsto.</div>`);
  }

  const abas = postos.length > 1 ? `<div class="abas" role="tablist">${postos.map(([nome], i) =>
    `<button role="tab" data-aba="${i}" aria-selected="${i === 0}">${nome}</button>`).join("")}</div>` : "";

  conteudo.innerHTML = `
    ${varias ? htmlResumo(analises) : ""}
    ${varias ? `<h2 id="unidade-titulo">${escapar(u.rotulo)}</h2>
      <p class="legenda">${u.distribuidora ? `${escapar(u.distribuidora)} · ` : ""}${u.subgrupo ? `Subgrupo ${escapar(u.subgrupo)} · ` : ""}Tarifa ${u.modalidade}</p>` : ""}
    ${destaque}
    ${avisos.join("")}
    ${htmlModalidade(u, analise)}
    <hr>
    <h2>${analise.trocar ? `Se mantiver a tarifa ${u.modalidade}: ajuste de demanda` : "Ajuste de demanda"}</h2>
    ${analise.trocar ? `<ul class="frases">${postos.map(([nome, r]) => `<li>${fraseRecomendacao(nome, r)}</li>`).join("")}</ul>` : ""}
    ${abas}
    ${postos.map(([, r], i) => `<section class="posto" data-posto="${i}" ${i ? "hidden" : ""}>${htmlPosto(i, meses, r)}</section>`).join("")}
    <hr>
    <h3>Relatórios${varias ? ` (${estado.filtro && estado.filtro !== "Todas" ? `${escapar(estado.filtro)}: ` : "todas as "}${indicesVisiveis.length}
      ${indicesVisiveis.length === 1 ? "unidade" : "unidades"})` : ""}</h3>
    <div class="dupla">
      <button id="baixar-pdf" class="primario">📄 Baixar relatório em PDF</button>
      <button id="baixar-excel">📊 Baixar planilha Excel</button>
    </div>
    <p class="legenda" id="progresso-relatorio" aria-live="polite"></p>
    <details class="caixa">
      <summary>ℹ️ Antes de pedir a alteração à distribuidora</summary>
      <ul>
        <li>O ajuste de demanda considera a <strong>parcela de demanda</strong> da conta; a comparação de modalidades
          considera também a <strong>energia</strong> (kWh), com as tarifas da etapa 2.</li>
        <li>A troca de modalidade é pedida à distribuidora; confirme as condições e prazos para a mudança.</li>
        <li>Confirme com a distribuidora os <strong>prazos e condições</strong> para alterar o contrato:
          reduções costumam ter regras de antecedência e carência.</li>
        <li>Se houver previsão de <strong>novos equipamentos ou expansão</strong>, volte à etapa anterior e informe
          o crescimento de carga previsto.</li>
        <li>O menor valor considerado é ${DEMANDA_MINIMA} kW, mínimo do Grupo A.</li>
      </ul>
    </details>
    <div class="dupla">
      <button id="corrigir">⬅ Voltar e corrigir valores</button>
      <button id="nova">🔄 Nova análise</button>
    </div>`;

  for (const botao of conteudo.querySelectorAll("[data-ver]")) {
    botao.addEventListener("click", () => {
      estado.atual = Number(botao.dataset.ver);
      salvarEstado();
      etapaResultado();
      document.getElementById("unidade-titulo")?.scrollIntoView({ behavior: "smooth" });
    });
  }
  for (const botao of conteudo.querySelectorAll("[data-corrigir]")) {
    botao.addEventListener("click", () => {
      estado.atual = Number(botao.dataset.corrigir);
      irPara(2);
    });
  }

  const itens = indicesVisiveis.map((i) => ({ unidade: estado.unidades[i], analise: analises[i] }));
  for (const botao of conteudo.querySelectorAll("[data-filtro]")) {
    botao.addEventListener("click", () => {
      estado.filtro = botao.dataset.filtro;
      salvarEstado();
      etapaResultado();
    });
  }
  if (varias) {
    const elemento = document.getElementById("grafico-economia");
    // Em telas estreitas (celular), só o número da instalação, para sobrar espaço para as barras
    const estreita = elemento.clientWidth < 600;
    const variasDistribuidoras = distribuidoras().length > 1;
    const dados = itens.filter((i) => i.analise).map(({ unidade, analise }) => ({
      nome: estreita ? `${unidade.id}${variasDistribuidoras && unidade.distribuidora ? ` (${unidade.distribuidora})` : ""}`
        : unidade.nomeCurto ?? unidade.rotulo,
      economia: analise.economia,
    }));
    elemento.style.height = `${Math.max(220, 46 * dados.length + 80)}px`;
    desenharFigura(elemento, figEconomiaPorUnidade(dados)).catch((erro) => console.error(erro));
  }
  if (comparacao.disponivel) {
    desenharFigura(document.getElementById("grafico-modalidade"), figComparacaoModalidades(comparacao)).catch((erro) => console.error(erro));
  }
  document.getElementById("ir-tarifas")?.addEventListener("click", () => irPara(2));
  const desenhados = new Set([0]);
  desenharGraficos(0, meses, postos[0][1]);
  for (const aba of conteudo.querySelectorAll("[data-aba]")) {
    aba.addEventListener("click", () => {
      const i = Number(aba.dataset.aba);
      for (const outra of conteudo.querySelectorAll("[data-aba]")) outra.setAttribute("aria-selected", outra === aba);
      for (const secao of conteudo.querySelectorAll("[data-posto]")) secao.hidden = Number(secao.dataset.posto) !== i;
      if (!desenhados.has(i)) {
        desenhados.add(i);
        desenharGraficos(i, meses, postos[i][1]);
      }
    });
  }

  const meta = {
    crescimento: estado.crescimento,
    distribuidoras: [...new Set(itens.map(({ unidade }) => unidade.distribuidora).filter(Boolean))],
    arquivos: estado.leituras.filter((l) => l.contas.some((c) => itens.some(({ unidade }) =>
      unidade.id === (c.instalacao ?? "sem-numero") && unidade.distribuidora === (l.distribuidora ?? null)))).length,
    mesesDoHistorico: itens.some(({ analise }) => analise?.linhas.some((l) => l.historico)),
    versao: VERSAO,
  };
  const baixarRelatorio = async (botao, gerar, extensao) => {
    const botoes = conteudo.querySelectorAll("#baixar-pdf, #baixar-excel");
    const progresso = document.getElementById("progresso-relatorio");
    botoes.forEach((b) => (b.disabled = true));
    try {
      progresso.textContent = "Preparando os gráficos...";
      const imagens = await imagensDosRelatorios(itens, (feitas, total) => {
        progresso.textContent = `Preparando os gráficos... (${feitas} de ${total})`;
      });
      progresso.textContent = "Montando o relatório...";
      const blob = await gerar(itens, imagens, meta);
      const nome = `analise_demanda_${new Date().toISOString().slice(0, 10)}.${extensao}`;
      const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: nome });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60000);
      progresso.textContent = `Pronto: ${nome}`;
    } catch (erro) {
      console.error(erro);
      progresso.textContent = "";
      alert("Não consegui gerar o relatório. Verifique a internet e tente de novo.");
    }
    botoes.forEach((b) => (b.disabled = false));
  };
  document.getElementById("baixar-pdf").addEventListener("click", (e) => baixarRelatorio(e.currentTarget, gerarPdf, "pdf"));
  document.getElementById("baixar-excel").addEventListener("click", (e) => baixarRelatorio(e.currentTarget, gerarExcel, "xlsx"));
  document.getElementById("corrigir").addEventListener("click", () => irPara(2));
  document.getElementById("nova").addEventListener("click", () => {
    estado = novoEstado();
    irPara(1);
  });
}

// ---------------------------------------------------------------- instalação e atualização

function configurarInstalacao() {
  const botao = document.getElementById("instalar");
  const dica = document.getElementById("dica-iphone");
  const instalado = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  let pedido = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    pedido = e;
    botao.hidden = false;
  });
  botao.addEventListener("click", async () => {
    if (!pedido) return;
    pedido.prompt();
    await pedido.userChoice;
    pedido = null;
    botao.hidden = true;
  });
  window.addEventListener("appinstalled", () => (botao.hidden = true));

  // iPhone e iPad não mostram o botão de instalar: explica o caminho pelo menu
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !instalado) dica.hidden = false;
}

function configurarAtualizacao() {
  if (!("serviceWorker" in navigator)) return;
  const jaTinhaVersao = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((registro) => {
    // O app pode ficar dias aberto no celular: procura versão nova sempre que volta à tela
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registro.update().catch(() => {});
    });
  }).catch((erro) => console.error(erro));

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!jaTinhaVersao) return; // primeira instalação, nada mudou na tela
    const emUso = estado.etapa !== 1;
    if (!emUso) return location.reload();
    const aviso = document.getElementById("nova-versao");
    aviso.hidden = false;
    aviso.querySelector("button").addEventListener("click", () => location.reload());
  });
}

// ---------------------------------------------------------------- início

document.getElementById("versao").textContent = `Versão ${VERSAO}`;
configurarInstalacao();
configurarAtualizacao();
desenhar();
