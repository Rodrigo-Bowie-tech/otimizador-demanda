// Otimizador de Demanda Contratada — app em 3 etapas, que roda inteiro no aparelho.
//
// Uma análise pode ter várias unidades consumidoras (UCs): as faturas agrupadas
// trazem uma UC por página. Cada UC tem sua modalidade, tarifas e meses.

import { analisarPosto, DEMANDA_MINIMA } from "./calculo.js";
import { desenhar as desenharFigura, figCurvaDeCusto, figCustoPorMes, figDemandaPorMes, figEconomiaPorUnidade,
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

// Colunas da tabela de conferência. Na tarifa verde só "contratada" e "medida" são usadas;
// na azul elas representam o "fora de ponta".
const ROTULOS = {
  mes: "Mês",
  contratada: "Contratada (kW)",
  medida: "Medida (kW)",
  contratada_p: "Contratada ponta (kW)",
  medida_p: "Medida ponta (kW)",
};
const CAMPOS_DEMANDA = ["contratada", "medida", "contratada_p", "medida_p"];
const AJUDA_CONTRATADA = "Valor de demanda que consta no contrato com a distribuidora naquele mês.";
const AJUDA_MEDIDA = "Maior demanda registrada pelo medidor no mês (também chamada de demanda registrada ou lida).";

const conteudo = document.getElementById("conteudo");
let estado = carregarEstado();
let arquivosEscolhidos = [];

// ---------------------------------------------------------------- utilidades

function novoEstado() {
  return { etapa: 1, leituras: [], unidades: [], atual: 0, crescimento: 0 };
}

function novaUnidade(id, rotulo) {
  return { id, rotulo, modalidade: "Verde", ...TARIFAS_PADRAO, tarifasDaConta: false, linhas: [] };
}

const unidadeAtual = () => estado.unidades[estado.atual];

// O estado fica guardado no aparelho para não se perder se o app for fechado no meio
function carregarEstado() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO));
    if (salvo?.etapa && salvo.unidades?.length) return { ...novoEstado(), ...salvo };
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

const ordenar = (linhas) => [...linhas].sort((a, b) => ordemDoMes(a.mes) - ordemDoMes(b.mes));

function irPara(etapa) {
  estado.etapa = etapa;
  salvarEstado();
  desenhar();
  window.scrollTo({ top: 0 });
}

function linhaVazia(mes = "", arquivo = "digitado") {
  return { mes, arquivo, contratada: null, medida: null, contratada_p: null, medida_p: null };
}

/** Agrupa as contas lidas dos PDFs por unidade consumidora (número da instalação). */
function unidadesDasLeituras(leituras) {
  const unidades = new Map();
  for (const leitura of leituras) {
    for (const conta of leitura.contas) {
      const id = conta.instalacao ?? "sem-numero";
      if (!unidades.has(id)) {
        const rotulo = conta.instalacao
          ? `Instalação ${conta.instalacao}${conta.endereco ? ` — ${conta.endereco}` : ""}`
          : "Unidade sem número de instalação";
        const unidade = novaUnidade(id, rotulo);
        const curto = conta.instalacao ? `${conta.instalacao}${conta.endereco ? ` - ${conta.endereco}` : ""}` : rotulo;
        unidade.nomeCurto = curto.length > 36 ? `${curto.slice(0, 35)}…` : curto;
        unidades.set(id, { ...unidade, mesMaisRecente: -1 });
      }
      const u = unidades.get(id);
      const linha = { mes: conta.mes ?? "", arquivo: leitura.arquivo };
      for (const campo of CAMPOS_DEMANDA) linha[campo] = conta[campo] ?? null;
      // O mesmo mês enviado duas vezes (mesmo PDF repetido) entra uma vez só
      const repetida = u.linhas.some((l) => l.mes && l.mes === linha.mes && CAMPOS_DEMANDA.every((c) => l[c] === linha[c]));
      if (!repetida) u.linhas.push(linha);
      // Modalidade e tarifas: as da conta mais recente
      const ordem = ordemDoMes(conta.mes);
      if (ordem >= u.mesMaisRecente) {
        u.mesMaisRecente = ordem;
        if (conta.modalidade) u.modalidade = conta.modalidade;
        if (conta.tarifa) Object.assign(u, { tarifa: arredondar2(conta.tarifa), tarifasDaConta: true });
        if (conta.tarifa_p) u.tarifa_p = arredondar2(conta.tarifa_p);
      }
    }
  }
  const lista = [...unidades.values()].map(({ mesMaisRecente, ...u }) => ({ ...u, linhas: ordenar(u.linhas) }));
  if (lista.length) return lista.sort((a, b) => a.id.localeCompare(b.id));
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
    <p>Escolha os PDFs das contas de energia (Light, Energisa ou Enel). Envie uma conta por mês —
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
    estado.leituras = leituras;
    estado.unidades = unidadesDasLeituras(leituras);
    estado.atual = 0;
    irPara(2);
  });
  document.getElementById("digitar").addEventListener("click", () => {
    estado.leituras = [];
    const unidade = novaUnidade("manual", "Unidade");
    unidade.linhas = ultimosMeses().map((mes) => linhaVazia(mes));
    estado.unidades = [unidade];
    estado.atual = 0;
    irPara(2);
  });
  document.getElementById("exemplo").addEventListener("click", () => {
    estado.leituras = [];
    const unidade = novaUnidade("exemplo", "Exemplo");
    unidade.linhas = ultimosMeses().map((mes, i) => ({
      mes, arquivo: "exemplo", contratada: 500, medida: EXEMPLO_MEDIDA[i], contratada_p: 250, medida_p: EXEMPLO_PONTA[i],
    }));
    estado.unidades = [unidade];
    estado.atual = 0;
    irPara(2);
  });
}

// ---------------------------------------------------------------- etapa 2

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
      ? `<p class="legenda">Sem cobrança de demanda, fora da análise: ${escapar(l.semDemanda.join(", "))}.</p>` : "";
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
  const opcoes = estado.unidades.map((u, i) => {
    const meses = u.linhas.length;
    return `<option value="${i}" ${i === estado.atual ? "selected" : ""}>${escapar(u.rotulo)} (${u.modalidade}, ${meses} ${meses === 1 ? "mês" : "meses"})</option>`;
  }).join("");
  return `
    <label class="campo destaque-campo">Unidade consumidora (${estado.unidades.length} encontradas)
      <select id="unidade">${opcoes}</select>
      <span class="legenda">Confira cada unidade. No resultado, aparece um resumo de todas.</span>
    </label>`;
}

function colunasVisiveis(azul) {
  return azul ? ["mes", "contratada_p", "medida_p", "contratada", "medida"] : ["mes", "contratada", "medida"];
}

function rotulo(coluna, azul) {
  if (azul && coluna === "contratada") return "Contratada fora ponta (kW)";
  if (azul && coluna === "medida") return "Medida fora ponta (kW)";
  return ROTULOS[coluna];
}

function htmlTabela(linhasDaTabela, azul) {
  const colunas = colunasVisiveis(azul);
  const ajuda = (c) => (c === "mes" ? "Mês de referência da conta, no formato MM/AAAA."
    : c.startsWith("contratada") ? AJUDA_CONTRATADA : AJUDA_MEDIDA);
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
  const economia = Object.values(resultados).reduce((total, r) => total + r.economia, 0);
  return { resultados, meses: linhas.map((l) => l.mes), linhas, economia };
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
function htmlResumo(analises) {
  const ordem = estado.unidades.map((u, i) => i)
    .sort((a, b) => (analises[b]?.economia ?? -1) - (analises[a]?.economia ?? -1));
  const total = analises.reduce((soma, a) => soma + (a?.economia ?? 0), 0);
  const linhas = ordem.map((i) => {
    const u = estado.unidades[i];
    const a = analises[i];
    const atual = i === estado.atual ? ' class="selecionada"' : "";
    if (!a) {
      return `<tr${atual}><td>${escapar(u.rotulo)}</td><td>${u.modalidade}</td><td colspan="2">Dados incompletos</td>
        <td><button class="pequeno" data-corrigir="${i}">Corrigir</button></td></tr>`;
    }
    const mudanca = Object.entries(a.resultados).map(([nome, r]) =>
      `${a.resultados.Ponta ? `${nome}: ` : ""}${kw(r.atual)} → <strong>${kw(r.otima)}</strong>`).join("<br>");
    return `<tr${atual}><td>${escapar(u.rotulo)}</td><td>${u.modalidade}</td><td>${mudanca}</td>
      <td>${a.economia > 0.5 ? reais(a.economia) : "—"}</td>
      <td><button class="pequeno" data-ver="${i}">${i === estado.atual ? "Exibindo" : "Ver"}</button></td></tr>`;
  }).join("");
  return `
    <h2>Todas as unidades</h2>
    <p>Economia estimada somando todas: <strong>${reais(total)}</strong> no período analisado.</p>
    <div class="grafico grafico-economia" id="grafico-economia"></div>
    <div class="tabela-rolagem">
      <table class="resumo">
        <thead><tr><th>Unidade</th><th>Modalidade</th><th>Contratada atual → recomendada</th><th>Economia</th><th></th></tr></thead>
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
  const u = unidadeAtual();
  const analise = analises[estado.atual];
  if (!analise) return irPara(2); // dados da unidade escolhida ficaram incompletos
  const { resultados, meses, economia } = analise;
  const postos = Object.entries(resultados);
  const varias = estado.unidades.length > 1;

  const destaque = economia > 0.5
    ? `<div class="aviso sucesso"><h2>💡 Economia estimada de ${reais(economia)}</h2>
        <p>nos ${meses.length} meses analisados (${meses[0]} a ${meses.at(-1)}), ajustando a demanda contratada:</p>`
    : `<div class="aviso info"><h2>👍 A demanda contratada já está no valor mais econômico</h2>
        <p>Não há ajuste que reduza o custo no período analisado.</p>`;
  const avisos = [];
  if (meses.length < 12) {
    avisos.push(`<div class="aviso alerta">📅 A análise usou só ${meses.length} ${meses.length === 1 ? "mês" : "meses"}. Com menos de 12,
      a recomendação pode não considerar os meses de maior consumo do ano. Se possível, inclua mais contas.</div>`);
  }
  if (estado.crescimento) {
    avisos.push(`<div class="aviso info">📈 As demandas medidas foram ajustadas em
      ${estado.crescimento > 0 ? "+" : ""}${estado.crescimento.toLocaleString("pt-BR")}% para considerar o crescimento de carga previsto.</div>`);
  }

  const abas = postos.length > 1 ? `<div class="abas" role="tablist">${postos.map(([nome], i) =>
    `<button role="tab" data-aba="${i}" aria-selected="${i === 0}">${nome}</button>`).join("")}</div>` : "";

  conteudo.innerHTML = `
    ${varias ? htmlResumo(analises) : ""}
    ${varias ? `<h2 id="unidade-titulo">${escapar(u.rotulo)}</h2><p class="legenda">Tarifa ${u.modalidade}</p>` : ""}
    ${destaque}
      <ul>${postos.map(([nome, r]) => `<li>${fraseRecomendacao(nome, r)}</li>`).join("")}</ul>
    </div>
    ${avisos.join("")}
    <hr>
    ${abas}
    ${postos.map(([, r], i) => `<section class="posto" data-posto="${i}" ${i ? "hidden" : ""}>${htmlPosto(i, meses, r)}</section>`).join("")}
    <hr>
    <h3>Relatórios${varias ? ` (todas as ${estado.unidades.length} unidades)` : ""}</h3>
    <div class="dupla">
      <button id="baixar-pdf" class="primario">📄 Baixar relatório em PDF</button>
      <button id="baixar-excel">📊 Baixar planilha Excel</button>
    </div>
    <p class="legenda" id="progresso-relatorio" aria-live="polite"></p>
    <details class="caixa">
      <summary>ℹ️ Antes de pedir a alteração à distribuidora</summary>
      <ul>
        <li>A análise considera apenas a <strong>parcela de demanda</strong> da conta, não o consumo em kWh.</li>
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

  const itens = estado.unidades.map((unidade, i) => ({ unidade, analise: analises[i] }));
  if (varias) {
    const dados = itens.filter((i) => i.analise).map(({ unidade, analise }) => ({ nome: unidade.nomeCurto ?? unidade.rotulo, economia: analise.economia }));
    const elemento = document.getElementById("grafico-economia");
    elemento.style.height = `${Math.max(220, 46 * dados.length + 80)}px`;
    desenharFigura(elemento, figEconomiaPorUnidade(dados)).catch((erro) => console.error(erro));
  }
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
    distribuidoras: [...new Set(estado.leituras.map((l) => l.distribuidora).filter(Boolean))],
    arquivos: estado.leituras.length,
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
