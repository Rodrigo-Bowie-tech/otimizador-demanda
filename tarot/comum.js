// Funções usadas pelas duas abas: utilidades, seletores, face da carta e abas.

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

// Botões de estado de espírito (SENTIMENTOS); tocar de novo desmarca.
// Retorna uma função que devolve o id marcado, ou null.
function criarSeletorSentimento(container, aoMudar) {
  let selecionado = null;
  for (const sentimento of SENTIMENTOS) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "assunto";
    botao.setAttribute("role", "radio");
    botao.setAttribute("aria-checked", "false");
    botao.dataset.id = sentimento.id;
    botao.textContent = sentimento.nome;
    botao.addEventListener("click", () => {
      selecionado = selecionado === sentimento.id ? null : sentimento.id;
      for (const b of container.children) b.setAttribute("aria-checked", String(b.dataset.id === selecionado));
      aoMudar();
    });
    container.appendChild(botao);
  }
  return () => selecionado;
}

// Campo de nome que lembra o último nome digitado neste navegador e fica igual nas duas abas.
const camposDeNome = [];
function ligarCampoNome(input, aoMudar) {
  camposDeNome.push({ input, aoMudar });
  try {
    input.value = localStorage.getItem("tarot-nome") || "";
  } catch {
    // Sem armazenamento disponível, o campo apenas começa vazio.
  }
  input.addEventListener("input", () => {
    try {
      localStorage.setItem("tarot-nome", input.value.trim());
    } catch {
      // Idem: não lembrar o nome não impede a leitura.
    }
    for (const campo of camposDeNome) {
      if (campo.input !== input) campo.input.value = input.value;
      campo.aoMudar();
    }
  });
  return () => input.value.trim();
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
