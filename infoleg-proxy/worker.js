// Proxy minimo para InfoLEG (Cloudflare Worker).
//
// Antes aceptaba cualquier ?url= y respondia con CORS abierto: era un proxy
// abierto utilizable por cualquiera. Ahora:
//   - solo GET/HEAD,
//   - solo https hacia los hosts de HOSTS_PERMITIDOS,
//   - no sigue redirecciones (evita saltar a un host no permitido),
//   - si definis el secreto PROXY_KEY en el Worker, exige el header X-Proxy-Key,
//   - sin Access-Control-Allow-Origin: *.
const HOSTS_PERMITIDOS = new Set([
  "servicios.infoleg.gob.ar",
  "www.argentina.gob.ar",
]);

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (env.PROXY_KEY && request.headers.get("X-Proxy-Key") !== env.PROXY_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) return new Response("Missing url parameter", { status: 400 });

    let destino;
    try { destino = new URL(target); } catch { return new Response("Invalid url", { status: 400 }); }
    if (destino.protocol !== "https:" || !HOSTS_PERMITIDOS.has(destino.hostname)) {
      return new Response("Host not allowed", { status: 403 });
    }

    const response = await fetch(destino.toString(), {
      method: request.method,
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-AR,es;q=0.9",
        "Referer": "https://servicios.infoleg.gob.ar/infolegInternet/",
      },
    });

    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") || "text/html" },
    });
  },
};
