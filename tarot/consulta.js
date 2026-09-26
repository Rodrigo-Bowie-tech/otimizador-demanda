// Aba "Consultar cartas": busca na galeria e significado das cartas escolhidas conforme o assunto.
(() => {
const el = {
  busca: document.getElementById("busca"),
  contagem: document.getElementById("busca-contagem"),
  galeria: document.getElementById("galeria"),
  nenhuma: document.getElementById("galeria-vazia"),
  resultado: document.getElementById("consulta-resultado"),
  lista: document.getElementById("consulta-lista"),
  limpar: document.getElementById("consulta-limpar")
};

// Cartas escolhidas, na ordem em que foram adicionadas: { carta, invertida }.
let selecionadas = [];

const assuntoAtual = criarSeletorAssunto(
  document.getElementById("consulta-assuntos"),
  document.getElementById("consulta-assunto-livre"),
  () => desenharSelecionadas()
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
    botao.innerHTML = `<span class="miniatura-imagem"></span><span class="miniatura-nome">${carta.numero} · ${carta.nome}</span>`;
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

function alternar(carta) {
  const ja = selecionadas.some((s) => s.carta === carta);
  selecionadas = ja ? selecionadas.filter((s) => s.carta !== carta) : [...selecionadas, { carta, invertida: false }];
  desenharSelecionadas();
  if (!ja) {
    el.lista.lastElementChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function marcarGaleria() {
  for (const botao of el.galeria.children) {
    const marcada = selecionadas.some((s) => s.carta.indice === Number(botao.dataset.indice));
    botao.setAttribute("aria-pressed", String(marcada));
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
    <p><strong>Conselho:</strong> ${maiuscula(carta.conselho)}.</p>`;
}

function desenharSelecionadas() {
  marcarGaleria();
  el.resultado.hidden = selecionadas.length === 0;
  el.lista.innerHTML = "";
  const assunto = assuntoAtual();

  for (const s of selecionadas) {
    const artigo = document.createElement("article");
    artigo.className = "consulta-carta";
    artigo.innerHTML = `
      <figure class="consulta-figura${s.invertida ? " invertida" : ""}"></figure>
      <div class="consulta-texto">
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
        desenharSelecionadas();
      });
    }
    el.lista.appendChild(artigo);
  }
}

el.busca.addEventListener("input", filtrar);
el.limpar.addEventListener("click", () => {
  selecionadas = [];
  desenharSelecionadas();
});
montarGaleria();
filtrar();
desenharSelecionadas();
})();
