// Aba "Consultar cartas": o usuário escolhe na galeria as três cartas da tiragem
// (Passado, Presente, Futuro) e vê o significado de cada uma e o resultado combinado.
(() => {
const el = {
  pergunta: document.getElementById("consulta-pergunta"),
  busca: document.getElementById("busca"),
  contagem: document.getElementById("busca-contagem"),
  progresso: document.getElementById("consulta-progresso"),
  galeria: document.getElementById("galeria"),
  nenhuma: document.getElementById("galeria-vazia"),
  resultado: document.getElementById("consulta-resultado"),
  lista: document.getElementById("consulta-lista"),
  sintese: document.getElementById("consulta-sintese"),
  limpar: document.getElementById("consulta-limpar")
};

// Uma entrada por posição de POSICOES: { carta, invertida }, ou null enquanto está vazia.
let posicoes = POSICOES.map(() => null);
let aviso = "";

const assuntoAtual = criarSeletorAssunto(
  document.getElementById("consulta-assuntos"),
  document.getElementById("consulta-assunto-livre"),
  () => desenhar()
);
const nomeAtual = ligarCampoNome(document.getElementById("consulta-nome"), () => desenharSintese(assuntoAtual()));
const sentimentoAtual = criarSeletorSentimento(
  document.getElementById("consulta-sentimentos"),
  () => desenharSintese(assuntoAtual())
);

// ---------- Galeria e busca ----------

function textoDeBusca(carta) {
  return semAcentos([carta.nome, carta.numero, String(carta.indice), ...carta.palavras].join(" "));
}

function montarGaleria() {
  for (const carta of CARTAS) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "miniatura";
    botao.dataset.indice = carta.indice;
    botao.dataset.busca = textoDeBusca(carta);
    botao.setAttribute("aria-pressed", "false");
    botao.innerHTML = `
      <span class="miniatura-imagem"><span class="miniatura-posicao" hidden></span></span>
      <span class="miniatura-nome">${carta.numero} · ${carta.nome}</span>`;
    botao.querySelector(".miniatura-imagem").appendChild(frenteDaCarta(carta));
    botao.addEventListener("click", () => alternar(carta));
    el.galeria.appendChild(botao);
  }
}

function filtrar() {
  const termos = semAcentos(el.busca.value).split(/\s+/).filter(Boolean);
  let visiveis = 0;
  for (const botao of el.galeria.children) {
    const mostra = termos.every((t) => botao.dataset.busca.includes(t));
    botao.hidden = !mostra;
    if (mostra) visiveis++;
  }
  el.contagem.textContent = `${visiveis} de ${CARTAS.length} cartas`;
  el.nenhuma.hidden = visiveis > 0;
}

// ---------- Seleção ----------

const quantas = () => posicoes.filter(Boolean).length;

// Tocar numa carta escolhida tira ela da sua posição; uma carta nova ocupa a primeira posição vazia.
function alternar(carta) {
  aviso = "";
  const ocupada = posicoes.findIndex((p) => p && p.carta === carta);
  if (ocupada >= 0) {
    posicoes[ocupada] = null;
  } else {
    const livre = posicoes.indexOf(null);
    if (livre < 0) {
      aviso = "Você já escolheu as três cartas. Remova uma para trocar.";
      desenhar();
      return;
    }
    posicoes[livre] = { carta, invertida: false };
  }
  desenhar();
  if (ocupada < 0 && quantas() === POSICOES.length) {
    el.resultado.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function marcarGaleria() {
  for (const botao of el.galeria.children) {
    const i = posicoes.findIndex((p) => p && p.carta.indice === Number(botao.dataset.indice));
    botao.setAttribute("aria-pressed", String(i >= 0));
    const etiqueta = botao.querySelector(".miniatura-posicao");
    etiqueta.hidden = i < 0;
    etiqueta.textContent = i >= 0 ? POSICOES[i].nome : "";
  }
}

function mostrarProgresso() {
  const livre = posicoes.indexOf(null);
  el.progresso.classList.toggle("alerta", Boolean(aviso));
  if (aviso) {
    el.progresso.textContent = aviso;
  } else if (livre < 0) {
    el.progresso.textContent = "Três cartas escolhidas. Veja a leitura abaixo.";
  } else {
    el.progresso.textContent = `Toque na carta do ${POSICOES[livre].nome} (${quantas()} de ${POSICOES.length} escolhidas).`;
  }
}

// ---------- Significado ----------

function significado(s, assunto) {
  const { carta, invertida } = s;
  const geral = maiuscula(invertida ? carta.invertida : carta.normal) + ".";

  let doAssunto;
  if (assunto) {
    const rotulo = assunto.padrao ? assunto.nome : `“${escaparHtml(assunto.nome)}”`;
    doAssunto = `
      <div class="significado-assunto">
        <h4>Para ${rotulo}</h4>
        <p>${textoDaCarta(s, assunto, false)}</p>
      </div>`;
  } else {
    // Sem assunto escolhido, mostra a carta em cada um dos assuntos padrão.
    const itens = ASSUNTOS.filter((a) => carta.temas[a.id]).map((a) => `
      <dt>${a.icone} ${a.nome}</dt>
      <dd>${textoDaCarta(s, { id: a.id, nome: a.nome, padrao: true }, false)}</dd>`).join("");
    doAssunto = `
      <div class="significado-assunto">
        <h4>Em cada assunto</h4>
        <dl class="por-assunto">${itens}</dl>
      </div>`;
  }

  return `
    <p class="palavras">${carta.palavras.join(" · ")}</p>
    <p><strong>Significado geral${invertida ? " (invertida)" : ""}:</strong> ${geral}</p>
    ${doAssunto}
    <p><strong>Conselho:</strong> ${maiuscula(carta.conselho)}.</p>
    ${praticaDaCarta(s)}`;
}

function artigoVazio(i) {
  const artigo = document.createElement("article");
  artigo.className = "consulta-carta";
  artigo.innerHTML = `
    <figure class="consulta-figura vazia" aria-hidden="true">?</figure>
    <div class="consulta-texto">
      <p class="posicao-rotulo">${POSICOES[i].nome} <small>— ${POSICOES[i].descricao}</small></p>
      <p class="nota">Escolha na galeria a carta do ${POSICOES[i].nome}.</p>
    </div>`;
  return artigo;
}

function artigoDaCarta(s, i, assunto) {
  const artigo = document.createElement("article");
  artigo.className = "consulta-carta";
  artigo.innerHTML = `
    <figure class="consulta-figura${s.invertida ? " invertida" : ""}"></figure>
    <div class="consulta-texto">
      <p class="posicao-rotulo">${POSICOES[i].nome} <small>— ${POSICOES[i].descricao}</small></p>
      <div class="consulta-topo">
        <h3>${s.carta.numero} · ${s.carta.nome}</h3>
        <button type="button" class="remover" aria-label="Remover ${s.carta.nome}">✕</button>
      </div>
      <div class="orientacao" role="radiogroup" aria-label="Posição da carta">
        <button type="button" role="radio" aria-checked="${!s.invertida}" data-invertida="false">Em pé</button>
        <button type="button" role="radio" aria-checked="${s.invertida}" data-invertida="true">Invertida</button>
      </div>
      ${significado(s, assunto)}
    </div>`;
  artigo.querySelector("figure").appendChild(frenteDaCarta(s.carta));
  artigo.querySelector(".remover").addEventListener("click", () => alternar(s.carta));
  for (const botao of artigo.querySelectorAll(".orientacao button")) {
    botao.addEventListener("click", () => {
      s.invertida = botao.dataset.invertida === "true";
      desenhar();
    });
  }
  return artigo;
}

function desenharSintese(assunto) {
  const faltam = POSICOES.length - quantas();
  if (faltam > 0) {
    el.sintese.innerHTML = `<p class="nota">Escolha mais ${faltam} carta${faltam > 1 ? "s" : ""} para ver o resultado combinado.</p>`;
  } else if (!assunto) {
    el.sintese.innerHTML = `<p class="nota">Escolha um assunto no passo 1 para ver o resultado combinado.</p>`;
  } else {
    const ctx = { assunto, pergunta: el.pergunta.value.trim(), nome: nomeAtual(), sentimento: sentimentoAtual() };
    el.sintese.innerHTML = aberturaDaLeitura(ctx) + sintese(posicoes, ctx);
  }
}

function desenhar() {
  marcarGaleria();
  mostrarProgresso();
  el.resultado.hidden = quantas() === 0;
  const assunto = assuntoAtual();
  el.lista.replaceChildren(...posicoes.map((s, i) => (s ? artigoDaCarta(s, i, assunto) : artigoVazio(i))));
  desenharSintese(assunto);
}

el.busca.addEventListener("input", filtrar);
el.pergunta.addEventListener("input", () => desenharSintese(assuntoAtual()));
el.limpar.addEventListener("click", () => {
  posicoes = POSICOES.map(() => null);
  aviso = "";
  desenhar();
});
montarGaleria();
filtrar();
desenhar();
})();
