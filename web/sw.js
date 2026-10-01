// Guarda o app no aparelho para abrir rápido e funcionar sem internet, e
// instala sozinho cada versão nova publicada.
//
// __BUILD__ é trocado pela versão + commit na publicação (.github/workflows/site.yml):
// a cada publicação este arquivo muda, e o navegador baixa a versão nova.

const CACHE_APP = "app-__BUILD__";
// As bibliotecas são grandes e mudam pouco: ficam num cache separado, que só é
// baixado de novo quando o nome abaixo muda (ao trocar a versão de alguma delas)
const CACHE_LIBS = "libs-plotly4.1.1-pdfjs6.3.289-exceljs4.4.0";

const ARQUIVOS_APP = [
  "./", "index.html", "estilo.css", "app.js", "calculo.js", "leitor_pdf.js", "graficos.js", "relatorio.js",
  "versao.js", "manifest.webmanifest", "icones/icone.svg", "icones/icone-192.png", "icones/icone-512.png",
];
const ARQUIVOS_LIBS = ["lib/plotly.min.js", "lib/pdf.min.js", "lib/pdf.worker.min.js", "lib/exceljs.min.js"];

self.addEventListener("install", (evento) => {
  evento.waitUntil((async () => {
    const app = await caches.open(CACHE_APP);
    // cache: "reload" busca direto do site, sem cópias antigas guardadas pelo navegador
    await app.addAll(ARQUIVOS_APP.map((url) => new Request(url, { cache: "reload" })));
    const libs = await caches.open(CACHE_LIBS);
    for (const url of ARQUIVOS_LIBS) {
      if (!(await libs.match(url))) await libs.add(new Request(url, { cache: "reload" }));
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome !== CACHE_APP && nome !== CACHE_LIBS) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith((async () => {
    const guardado = await caches.match(pedido, { ignoreSearch: true });
    return guardado ?? fetch(pedido);
  })());
});
