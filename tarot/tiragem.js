// Aba "Tirar cartas": escolha do assunto, sorteio das três cartas e leitura.
(() => {
const PAUSA_EMBARALHAR = 1100;
const PAUSA_DISTRIBUIR = 250;
const PAUSA_ANTES_DE_VIRAR = 700;
const PAUSA_ENTRE_VIRADAS = 1200;

const el = {
  etapaAssunto: document.getElementById("etapa-assunto"),
  pergunta: document.getElementById("pergunta"),
  instrucao: document.getElementById("instrucao"),
  baralho: document.getElementById("baralho"),
  tiragem: document.getElementById("tiragem"),
  resultado: document.getElementById("resultado"),
  leitura: document.getElementById("leitura"),
  novaLeitura: document.getElementById("nova-leitura")
};

let lendo = false;

const assuntoAtual = criarSeletorAssunto(
  document.getElementById("assuntos"),
  document.getElementById("assunto-livre"),
  atualizarBaralho
);

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function aleatorio(max) {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function atualizarBaralho() {
  const pronto = assuntoAtual() !== null && !lendo && el.tiragem.children.length === 0;
  el.baralho.disabled = !pronto;
  el.baralho.classList.toggle("sem-assunto", assuntoAtual() === null);
  if (lendo) return;
  el.instrucao.textContent = pronto
    ? "2. Concentre-se na sua questão e toque no baralho"
    : el.tiragem.children.length ? "2. As cartas foram lançadas" : "2. Escolha um assunto para liberar o baralho";
}

// ---------- Tiragem ----------

function criarCarta(sorteada) {
  const { carta, invertida } = sorteada;
  const div = document.createElement("div");
  div.className = "carta" + (invertida ? " invertida" : "");
  div.innerHTML = `
    <div class="carta-miolo">
      <div class="face carta-verso"></div>
      <div class="face frente"></div>
    </div>`;
  div.querySelector(".frente").appendChild(frenteDaCarta(carta));
  return div;
}

async function tirarCartas() {
  const assunto = assuntoAtual();
  if (!assunto || lendo) return;
  lendo = true;
  el.baralho.disabled = true;
  el.etapaAssunto.classList.add("bloqueado");
  el.instrucao.textContent = "Embaralhando…";

  el.baralho.classList.add("embaralhando");
  await esperar(PAUSA_EMBARALHAR);
  el.baralho.classList.remove("embaralhando");

  const sorteadas = embaralhar(CARTAS).slice(0, 3).map((carta) => ({ carta, invertida: aleatorio(2) === 1 }));

  el.instrucao.textContent = "Distribuindo as cartas…";
  const elementos = [];
  for (let i = 0; i < sorteadas.length; i++) {
    const posicao = document.createElement("div");
    posicao.className = "posicao";
    posicao.innerHTML = `<span class="posicao-nome">${POSICOES[i].nome}</span>`;
    const carta = criarCarta(sorteadas[i]);
    const estado = document.createElement("span");
    estado.className = "estado";
    posicao.append(carta, estado);
    el.tiragem.appendChild(posicao);
    elementos.push({ carta, estado });
    await esperar(PAUSA_DISTRIBUIR);
  }

  await esperar(PAUSA_ANTES_DE_VIRAR);
  for (let i = 0; i < sorteadas.length; i++) {
    el.instrucao.textContent = `Revelando: ${POSICOES[i].nome}…`;
    elementos[i].carta.classList.add("virada");
    await esperar(PAUSA_ENTRE_VIRADAS);
    elementos[i].estado.textContent = sorteadas[i].carta.nome + (sorteadas[i].invertida ? " · invertida" : "");
  }

  el.instrucao.textContent = "2. As cartas foram lançadas";
  mostrarLeitura(assunto, el.pergunta.value.trim(), sorteadas);
  lendo = false;
}

function sintese(sorteadas, assunto) {
  // O futuro pesa mais por ser a tendência da questão.
  const pesos = [1, 1, 1.5];
  const pontos = sorteadas.reduce((soma, s, i) => soma + tomEfetivo(s) * pesos[i], 0);
  const nomeAssunto = assunto.padrao ? assunto.nome.toLowerCase() : `“${escaparHtml(assunto.nome)}”`;

  let tom, rotulo, texto;
  if (pontos >= 1.5) {
    tom = "favoravel";
    rotulo = "Favorável";
    texto = `As energias são positivas para ${nomeAssunto}. O caminho tende a se abrir, e as suas atitudes estão alinhadas com o que deseja. Aproveite o momento para agir.`;
  } else if (pontos <= -1.5) {
    tom = "desafiador";
    rotulo = "Desafiador";
    texto = `As cartas mostram obstáculos em ${nomeAssunto}. Não é um “não” definitivo, mas um alerta: há padrões a rever e decisões que pedem cautela antes de avançar.`;
  } else {
    tom = "equilibrado";
    rotulo = "Em equilíbrio";
    texto = `A situação em ${nomeAssunto} está em aberto, com forças que se equilibram. O resultado depende muito das escolhas que você fizer a partir de agora.`;
  }

  const trechos = sorteadas.map(({ carta, invertida }) => {
    const palavra = carta.palavras[0];
    if (!invertida) return palavra;
    return carta.tom < 0 ? `superação de ${palavra}` : `${palavra} em desequilíbrio`;
  });
  const narrativa = `Você vem de um período marcado por <strong>${trechos[0]}</strong>, vive agora um momento de <strong>${trechos[1]}</strong> e caminha para <strong>${trechos[2]}</strong>.`;
  const conselhoFinal = maiuscula(sorteadas[2].carta.conselho);

  return `
    <div class="sintese">
      <h3>Resultado provável <span class="selo ${tom}">${rotulo}</span></h3>
      <p>${narrativa}</p>
      <p>${texto}</p>
      <p><strong>Conselho final:</strong> ${conselhoFinal}.</p>
    </div>`;
}

function mostrarLeitura(assunto, pergunta, sorteadas) {
  const contexto = `Assunto: <strong>${escaparHtml(assunto.nome)}</strong>` +
    (pergunta ? ` · Pergunta: <em>${escaparHtml(pergunta)}</em>` : "");

  const cartas = sorteadas.map((s, i) => `
    <article class="leitura-carta">
      <h3>${POSICOES[i].nome}: ${s.carta.nome}${s.invertida ? " (invertida)" : ""}
        <small>— ${POSICOES[i].descricao}</small></h3>
      <p class="palavras">${s.carta.palavras.join(" · ")}</p>
      <p>${textoDaCarta(s, assunto)}</p>
      <p><strong>Conselho:</strong> ${maiuscula(s.carta.conselho)}.</p>
    </article>`).join("");

  el.leitura.innerHTML = `<p class="contexto">${contexto}</p>${cartas}${sintese(sorteadas, assunto)}`;
  el.resultado.hidden = false;
  el.resultado.scrollIntoView({ behavior: "smooth", block: "start" });
}

function reiniciar() {
  el.tiragem.innerHTML = "";
  el.leitura.innerHTML = "";
  el.resultado.hidden = true;
  el.etapaAssunto.classList.remove("bloqueado");
  atualizarBaralho();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

el.baralho.addEventListener("click", tirarCartas);
el.novaLeitura.addEventListener("click", reiniciar);
atualizarBaralho();
})();
