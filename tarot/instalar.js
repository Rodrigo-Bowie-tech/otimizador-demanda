// Instalação como aplicativo: registra o service worker e mostra como instalar no celular.
(() => {
const botao = document.getElementById("instalar");
const dica = document.getElementById("instalar-dica");
const fecharDica = document.getElementById("instalar-fechar");

const jaInstalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ehIphone = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// O service worker só funciona em http(s); aberto direto do arquivo, o app segue normal sem ele.
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Sem service worker o app funciona igual, só não abre offline.
  });
}

if (jaInstalado) return;

// Android e computadores com Chrome/Edge: o navegador avisa quando o app pode ser instalado.
let pedido = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  pedido = e;
  botao.hidden = false;
});
window.addEventListener("appinstalled", () => {
  botao.hidden = true;
  pedido = null;
});

// iPhone e iPad: não há botão de instalar; mostra o passo a passo do Safari.
if (ehIphone) botao.hidden = false;

botao.addEventListener("click", async () => {
  if (pedido) {
    pedido.prompt();
    await pedido.userChoice;
    pedido = null;
    botao.hidden = true;
  } else {
    dica.hidden = !dica.hidden;
  }
});
fecharDica.addEventListener("click", () => { dica.hidden = true; });
})();
