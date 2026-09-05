/**
 * Bancos de una tienda: con cuales trabaja.
 *
 * En la base viven en una sola columna de texto, separados por salto de linea:
 *
 *     'Banco Industrial\nBanrural\nG&T Continental'
 *
 * El separador es \n y no el pipe que usan los operadores (ver operators.ts) porque el detalle de
 * la tienda imprime el texto tal cual: con saltos de linea ya se lee como listado, sin formatear
 * nada.
 *
 * Es una lista de etiquetas y no un catalogo: nada referencia un banco, no se filtra por el y no
 * existe como entidad en el resto del sistema.
 *
 * Todo el formato vive aca: el modal y el detalle pasan por estas funciones y ninguno parte el
 * texto por su cuenta.
 */

/** Tope de la columna. text no tiene limite en Postgres; el corte es para que un pegado accidental no llene la fila. */
export const BANKS_MAX_LENGTH = 500;

/** Tope de un nombre suelto. Da de sobra para el nombre mas largo de un banco local. */
export const BANK_MAX_LENGTH = 100;

/**
 * Nombres de una tienda, en el orden en que se guardaron. Recorta espacios al inicio y al final de
 * cada uno y descarta los vacios, que aparecen cuando el texto trae lineas de mas o termina en
 * salto de linea.
 */
export function parseBanks(banks?: string | null): string[] {
    if (!banks) return [];
    return banks
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
}

/**
 * Texto listo para guardar, o cadena vacia si no quedo ninguno —el endpoint la convierte en NULL
 * con nullif—.
 *
 * Sanea lo que el modal pudo dejar pasar:
 *  - recorta espacios y descarta vacios;
 *  - colapsa cualquier salto de linea de adentro de un nombre pegado desde afuera, que partiria el
 *    banco en dos al volver a leerlo;
 *  - deduplica sin distinguir mayusculas ni tildes, para que "Banrural" y "banrural" no entren dos
 *    veces;
 *  - corta el largo total.
 */
export function serializeBanks(names: string[]): string {
    const seen = new Set<string>();
    const clean: string[] = [];

    for (const raw of names || []) {
        const name = (raw ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, BANK_MAX_LENGTH).trim();
        if (!name) continue;

        const key = normalizeBank(name);
        if (seen.has(key)) continue;

        seen.add(key);
        clean.push(name);
    }

    const text = clean.join('\n');
    if (text.length <= BANKS_MAX_LENGTH) return text;

    // Se corta por nombre completo: partir uno a la mitad dejaria un banco inventado.
    const kept: string[] = [];
    for (const name of clean) {
        const next = kept.length ? kept.join('\n') + '\n' + name : name;
        if (next.length > BANKS_MAX_LENGTH) break;
        kept.push(name);
    }
    return kept.join('\n');
}

/**
 * Clave de comparacion: minusculas, sin tildes y con los espacios colapsados. NFD separa la letra
 * de su tilde y el reemplazo borra la tilde suelta.
 */
export function normalizeBank(name: string): string {
    return (name ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * El texto guardado, normalizado para mostrar: sin lineas vacias ni espacios sobrantes. Es lo que
 * ve el detalle de la tienda, que lo imprime con los saltos de linea intactos. Cadena vacia si la
 * tienda no tiene bancos cargados.
 */
export function formatBanks(banks?: string | null): string {
    return parseBanks(banks).join('\n');
}
