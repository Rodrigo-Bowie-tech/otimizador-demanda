// Funções usadas pelas duas abas: utilidades, seletor de assunto, interpretação e abas.

function escaparHtml(texto) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function maiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function semAcentos(texto) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

// ---------- Seletor de assunto ----------

// Monta os botões de assunto em `container` e liga ao campo de assunto livre.
// Tocar de novo no assunto marcado desmarca. Retorna uma função que devolve o assunto atual
// ({ id, nome, padrao }) ou null.
function criarSeletorAssunto(container, inputLivre, aoMudar) {
  let selecionado = null; // id de ASSUNTOS, ou null quando o assunto é digitado

  function marcar(id) {
    selecionado = id;
    for (const botao of container.children) {
      botao.setAttribute("aria-checked", String(botao.dataset.id === id));
    }
  }

  for (const assunto of ASSUNTOS) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "assunto";
    botao.setAttribute("role", "radio");
    botao.setAttribute("aria-checked", "false");
    botao.dataset.id = assunto.id;
    botao.textContent = `${assunto.icone} ${assunto.nome}`;
    botao.addEventListener("click", () => {
      marcar(selecionado === assunto.id ? null : assunto.id);
      inputLivre.value = "";
      aoMudar();
    });
    container.appendChild(botao);
  }

  inputLivre.addEventListener("input", () => {
    if (inputLivre.value.trim()) marcar(null);
    aoMudar();
  });

  return function assuntoAtual() {
    if (selecionado) {
      const assunto = ASSUNTOS.find((a) => a.id === selecionado);
      return { id: assunto.id, nome: assunto.nome, padrao: true };
    }
    const livre = inputLivre.value.trim();
    return livre ? { id: null, nome: livre, padrao: false } : null;
  };
}

// ---------- Interpretação ----------

// Invertida, uma carta favorável perde força e uma neutra pesa;
// cartas desafiadoras invertidas indicam libertação do problema.
function tomEfetivo({ carta, invertida }) {
  if (!invertida) return carta.tom;
  return carta.tom === 0 ? -1 : 0;
}

// comGeral = false omite o significado geral invertido, para quem já o exibe à parte.
function textoDaCarta({ carta, invertida }, assunto, comGeral = true) {
  if (!assunto.padrao) {
    const sentido = invertida ? carta.invertida : carta.normal;
    return `Em relação a “${escaparHtml(assunto.nome)}”, a carta fala de ${sentido}.`;
  }
  const doTema = carta.temas[assunto.id];
  if (invertida) {
    let complemento = "";
    if (doTema) {
      const area = assunto.nome.toLowerCase();
      complemento = carta.tom < 0
        ? ` Em ${area}, a sombra desta carta (${doTema}) começa a perder força.`
        : ` Em ${area}, o lado luminoso desta carta (${doTema}) ainda encontra resistência.`;
    }
    return comGeral ? `Invertida, aponta ${carta.invertida}.${complemento}` : complemento.trim();
  }
  return maiuscula(doTema || carta.normal) + ".";
}

// Linha com o assunto e a pergunta, no topo da leitura.
function contextoDaLeitura(assunto, pergunta) {
  return `<p class="contexto">Assunto: <strong>${escaparHtml(assunto.nome)}</strong>` +
    (pergunta ? ` · Pergunta: <em>${escaparHtml(pergunta)}</em>` : "") + "</p>";
}

// Resultado provável de uma tiragem de três cartas, na ordem Passado, Presente, Futuro.
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

// ---------- Face da carta ----------

// Frente com a imagem da carta; se a imagem não carregar, mostra número, símbolo e nome.
function frenteDaCarta(carta) {
  const conteudo = document.createElement("div");
  conteudo.className = "frente-conteudo com-imagem";
  const img = document.createElement("img");
  img.src = carta.imagem;
  img.alt = carta.nome;
  img.addEventListener("error", () => {
    conteudo.className = "frente-conteudo";
    conteudo.innerHTML = `
      <span class="frente-numero">${carta.numero}</span>
      <span class="frente-simbolo" aria-hidden="true">${carta.simbolo}</span>
      <span class="frente-nome">${carta.nome}</span>`;
  });
  conteudo.appendChild(img);
  return conteudo;
}

// ---------- Abas ----------

(function montarAbas() {
  const botoes = [...document.querySelectorAll("[role=tab]")];

  function abrir(botao, focar) {
    for (const b of botoes) {
      const ativa = b === botao;
      b.setAttribute("aria-selected", String(ativa));
      b.tabIndex = ativa ? 0 : -1;
      document.getElementById(b.getAttribute("aria-controls")).hidden = !ativa;
    }
    if (focar) botao.focus();
    try {
      history.replaceState(null, "", "#" + botao.dataset.aba);
    } catch {
      // Alguns navegadores embutidos não deixam alterar o endereço; a aba abre do mesmo jeito.
    }
  }

  botoes.forEach((botao, i) => {
    botao.addEventListener("click", () => abrir(botao));
    botao.addEventListener("keydown", (e) => {
      const passo = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (passo) abrir(botoes[(i + passo + botoes.length) % botoes.length], true);
    });
  });

  const inicial = botoes.find((b) => "#" + b.dataset.aba === location.hash) || botoes[0];
  abrir(inicial);
})();
