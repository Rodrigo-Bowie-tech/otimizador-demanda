// Aba "Glossário": o usuário busca uma carta pelo nome ou toca na imagem e vê o significado dela,
// sozinha, fora de qualquer tiragem.
(() => {
const el = {
  busca: document.getElementById("glossario-busca"),
  contagem: document.getElementById("glossario-contagem"),
  galeria: document.getElementById("glossario-galeria"),
  vazia: document.getElementById("glossario-vazia"),
  detalhe: document.getElementById("glossario-detalhe")
};

const NOMES_DOS_GRUPOS = {
  acao: "Ação",
  interior: "Introspecção",
  afeto: "Vínculos e cuidado",
  estrutura: "Estrutura",
  transformacao: "Transformação",
  sombra: "Sombra",
  luz: "Luz"
};

const ENERGIAS = {
  1: { classe: "favoravel", rotulo: "Favorável" },
  0: { classe: "equilibrado", rotulo: "Neutra" },
  "-1": { classe: "desafiador", rotulo: "Desafiadora" }
};

let atual = null;

function marcarGaleria() {
  for (const botao of el.galeria.children) {
    botao.setAttribute("aria-pressed", String(atual !== null && Number(botao.dataset.indice) === atual.indice));
  }
}

function combinacoesDa(carta) {
  return COMBINACOES.filter(([a, b]) => a === carta.indice || b === carta.indice).map(([, , texto]) => texto);
}

function botaoVizinho(indice, classe, rotulo) {
  const carta = CARTAS[(indice + CARTAS.length) % CARTAS.length];
  return `<button type="button" class="botao-secundario ${classe}" data-indice="${carta.indice}">${rotulo(carta)}</button>`;
}

function mostrar(carta, rolar = true) {
  atual = carta;
  marcarGaleria();
  const extra = APROFUNDAMENTO[carta.indice];
  const energia = ENERGIAS[carta.tom];
  const temas = ASSUNTOS.map((a) => `
    <dt>${a.icone} ${a.nome}</dt>
    <dd>${maiuscula(carta.temas[a.id])}.</dd>`).join("");
  const combinacoes = combinacoesDa(carta).map((t) => `<li>${t}</li>`).join("");

  el.detalhe.innerHTML = `
    <article class="consulta-carta glossario-carta">
      <figure class="consulta-figura"></figure>
      <div class="consulta-texto">
        <h3 class="glossario-titulo">${carta.numero} · ${carta.nome}</h3>
        <p class="palavras">${carta.palavras.join(" · ")}</p>
        <p class="glossario-etiquetas">
          <span class="selo ${energia.classe}">Energia ${energia.rotulo.toLowerCase()}</span>
          <span class="etiqueta">${NOMES_DOS_GRUPOS[extra.grupo]}</span>
        </p>
        <h4>Em pé</h4>
        <p>${maiuscula(carta.normal)}.</p>
        <h4>Invertida</h4>
        <p>${maiuscula(carta.invertida)}.</p>
        <h4>Conselho</h4>
        <p>${maiuscula(carta.conselho)}.</p>
        <p class="reflexao">${extra.reflexao}</p>
        <p><strong>Na prática:</strong> ${extra.acao}</p>
        <div class="significado-assunto">
          <h4>Em cada assunto</h4>
          <dl class="por-assunto">${temas}</dl>
        </div>
        <h4>Ritmo</h4>
        <p>Quando aparece como Futuro, costuma se manifestar ${RITMOS[extra.ritmo]}.</p>
        ${combinacoes ? `<h4>Combinações marcantes</h4><ul class="achados">${combinacoes}</ul>` : ""}
      </div>
    </article>
    <div class="glossario-navegacao">
      ${botaoVizinho(carta.indice - 1, "anterior", (c) => `← ${c.nome}`)}
      ${botaoVizinho(carta.indice + 1, "proxima", (c) => `${c.nome} →`)}
    </div>`;
  el.detalhe.querySelector("figure").appendChild(frenteDaCarta(carta));
  for (const botao of el.detalhe.querySelectorAll(".glossario-navegacao button")) {
    botao.addEventListener("click", () => mostrar(CARTAS[Number(botao.dataset.indice)]));
  }
  el.detalhe.hidden = false;
  if (rolar) el.detalhe.scrollIntoView({ behavior: "smooth", block: "start" });
}

const filtrar = criarGaleria(el, (carta) => mostrar(carta));

// Digitar até sobrar uma única carta já a mostra; Enter mostra a primeira encontrada.
el.busca.addEventListener("input", () => {
  const visiveis = filtrar();
  if (visiveis.length === 1 && visiveis[0] !== atual) mostrar(visiveis[0], false);
});
el.busca.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const [primeira] = filtrar();
  if (primeira) mostrar(primeira);
});
})();
