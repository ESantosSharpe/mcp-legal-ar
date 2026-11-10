import fs from "fs";
import os from "os";
import path from "path";

// ---------------------------------------------------------------------------
// Rutas de salida seguras.
//
// Varias herramientas del hub escriben archivos (PDFs, sentencias, partes
// diarios, exportes a la boveda). La ruta de destino la puede decidir el modelo,
// y el modelo lee contenido externo (fallos, edictos, paginas web): un texto
// malicioso podria inducirlo a escribir fuera de lugar. Este modulo limita el
// destino a un conjunto de carpetas permitidas.
//
// Carpetas permitidas (cualquiera de ellas):
//   - Descargas y Documentos del usuario.
//   - La boveda de casos (variable LEGAL_BOVEDA, o el default historico).
//   - Las carpetas listadas en MCP_LEGAL_OUTPUT_DIRS (separadas por ";" o ",").
//   - La carpeta base que cada herramienta declare para rutas relativas.
//
// Una ruta relativa se ancla a esa base. Cualquier ruta que, ya resuelta
// (incluyendo enlaces simbolicos y "..") quede fuera de las permitidas, se
// rechaza con un error que explica como habilitarla.
// ---------------------------------------------------------------------------

export const BOVEDA_DEFAULT = process.env.LEGAL_BOVEDA || "D:\\DERECHO\\Cerebro Digital\\Casos";

const esWin = process.platform === "win32";
const norm = (p) => (esWin ? p.toLowerCase() : p);

/** realpath de la ruta; si no existe, del ancestro existente mas cercano + el resto. */
function realpathProfundo(p) {
    const resto = [];
    let actual = path.resolve(p);
    for (;;) {
        try {
            const real = fs.realpathSync.native(actual);
            return resto.length ? path.join(real, ...resto.reverse()) : real;
        } catch {
            const padre = path.dirname(actual);
            if (padre === actual) return path.resolve(p);
            resto.push(path.basename(actual));
            actual = padre;
        }
    }
}

function dentroDe(raiz, ruta) {
    const rel = path.relative(norm(raiz), norm(ruta));
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function carpetasPermitidas(extra = []) {
    const home = os.homedir();
    const deEnv = (process.env.MCP_LEGAL_OUTPUT_DIRS || "")
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    const lista = [
        path.join(home, "Downloads"),
        path.join(home, "Documents"),
        BOVEDA_DEFAULT,
        ...deEnv,
        ...extra.filter(Boolean),
    ];
    return lista.map((r) => realpathProfundo(r));
}

/**
 * Valida y resuelve una ruta de salida. Devuelve la ruta absoluta; lanza Error si
 * queda fuera de las carpetas permitidas.
 *
 * @param {string} ruta ruta pedida (absoluta, o relativa a `base`)
 * @param {object} [opts]
 * @param {string} [opts.base] carpeta ancla para rutas relativas (tambien permitida)
 * @param {string[]} [opts.extensiones] extensiones aceptadas (ej. [".md"]); sin lista, cualquiera
 */
export function resolverRutaSalida(ruta, { base = null, extensiones = null } = {}) {
    if (typeof ruta !== "string" || !ruta.trim()) {
        throw new Error("Ruta de salida vacia o invalida.");
    }
    const pedida = ruta.trim();
    const abs = path.isAbsolute(pedida) ? path.resolve(pedida) : path.resolve(base || process.cwd(), pedida);
    const real = realpathProfundo(abs);
    const permitidas = carpetasPermitidas(base ? [base] : []);
    if (!permitidas.some((r) => dentroDe(r, real))) {
        throw new Error(
            `Ruta de salida no permitida: ${abs}. ` +
            `Solo se escribe dentro de Descargas, Documentos, la boveda (LEGAL_BOVEDA) o las carpetas de ` +
            `MCP_LEGAL_OUTPUT_DIRS. Para habilitar otra carpeta, agregala a esa variable de entorno (.env) y reinicia Claude Desktop.`
        );
    }
    if (extensiones && !extensiones.includes(path.extname(real).toLowerCase())) {
        throw new Error(`Extension no permitida para ${abs}. Se aceptan: ${extensiones.join(", ")}.`);
    }
    return abs;
}
