#!/usr/bin/env node
/**
 * saij-suggest-probe.mjs - Diagnostico del HTTP 500 de saij_suggest_terms.
 *
 * El conector hoy llama GET /suggest?key=<termino>&amount=N&suggesterName=suggest
 * y SAIJ responde 500. Este script prueba variantes de nombre de parametro y de
 * suggesterName desde TU maquina (el portal bloquea IPs no argentinas) y muestra
 * cual devuelve un 200 con sugerencias, para corregir search-service.js con un dato
 * verificado en lugar de adivinar.
 *
 * Uso:  cd servers/legal-mcp && node scripts/saij-suggest-probe.mjs [termino]
 * Solo lee (GET). No escribe archivos.
 */
import axios from "axios";

const BASE = "https://www.saij.gob.ar";
const TERMINO = process.argv[2] || "sociedad";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const nombresParam = ["key", "q", "term", "r", "s", "query", "text"];
const suggesters = ["suggest", "suggester", "voces", "tesauro", undefined];
const rutas = ["/suggest", "/suggest.json", "/buscador/suggest"];

const variantes = [];
for (const ruta of rutas)
    for (const p of nombresParam)
        for (const sg of suggesters) {
            const params = { [p]: TERMINO, amount: "5" };
            if (sg) params.suggesterName = sg;
            variantes.push({ ruta, params });
        }

const corto = (d) => (typeof d === "string" ? d : JSON.stringify(d)).replace(/\s+/g, " ").slice(0, 160);
let ok = 0;
for (const v of variantes) {
    try {
        const r = await axios.get(BASE + v.ruta, {
            params: v.params,
            timeout: 20000,
            validateStatus: () => true,
            headers: { "User-Agent": UA, "Accept": "application/json,text/plain,*/*", "Referer": BASE + "/" },
        });
        const etiqueta = `${v.ruta} ${JSON.stringify(v.params)}`;
        if (r.status === 200) {
            ok++;
            console.log(`200  ${etiqueta}\n     -> ${corto(r.data)}`);
        } else if (process.env.VERBOSE) {
            console.log(`${r.status}  ${etiqueta}`);
        }
    } catch (e) {
        if (process.env.VERBOSE) console.log(`ERR  ${v.ruta} ${JSON.stringify(v.params)}: ${e.message}`);
    }
    await new Promise((res) => setTimeout(res, 150)); // no saturar el portal
}
console.log(ok ? `\n${ok} variante(s) respondieron 200. Pasame esta salida y ajusto search-service.js.`
               : "\nNinguna variante respondio 200 (corre con VERBOSE=1 para ver los codigos). Puede que el autocompletado haya cambiado de endpoint: abri www.saij.gob.ar, escribi en el buscador con F12 > Network y pasame la URL que se dispara.");
