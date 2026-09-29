// Service worker: guarda o app no celular para abrir mesmo sem internet.
// Ao mudar qualquer arquivo do app, aumente VERSAO para os celulares baixarem a nova versão.
const VERSAO = "tarot-v1";

const ARQUIVOS = [
  "./",
  "index.html",
  "style.css",
  "cartas.js",
  "comum.js",
  "interpretacao.js",
  "tiragem.js",
  "consulta.js",
  "glossario.js",
  "instalar.js",
  "manifest.webmanifest",
  "icones/icone.svg",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png",
  "icones/apple-touch-icon.png",
  ...Array.from({ length: 22 }, (_, i) => `imagens/${String(i).padStart(2, "0")}.jpg`)
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Responde com o que está guardado; se não estiver, busca na rede e guarda para a próxima vez.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    caches.match(evento.request, { ignoreSearch: true }).then((guardado) => {
      if (guardado) return guardado;
      return fetch(evento.request).then((resposta) => {
        if (resposta.ok && new URL(evento.request.url).origin === self.location.origin) {
          const copia = resposta.clone();
          caches.open(VERSAO).then((cache) => cache.put(evento.request, copia));
        }
        return resposta;
      });
    })
  );
});
