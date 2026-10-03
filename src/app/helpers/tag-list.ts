/**
 * Listas de etiquetas guardadas en una sola columna de texto, separadas por salto de linea.
 *
 *     'Banco Industrial\nBanrural\nG&T Continental'
 *
 * Es el formato de establishment.banks y establishment.expense_tags. Cada lista tiene su propio
 * archivo (banks.ts, expense-tags.ts); la logica comun vive aca para que ninguna parta o arme el
 * texto por su cuenta.
 *
 * Los topes son de interfaz, no de la base: las columnas de la tienda son text. Los aplica el
 * modal al agregar y al guardar.
 */

/** Cantidad maxima de etiquetas por lista. */
export const TAG_LIST_MAX_ITEMS = 30;

/**
 * Largo maximo de una etiqueta. Sale de shop_sale_payment.bank, varchar(50), donde termina
 * guardado el banco elegido en un pago. Las etiquetas de gastos usan el mismo tope aunque
 * store_expense.title es text: ahi se guardan varias juntas y no hay columna que lo exija.
 */
export const TAG_MAX_LENGTH = 50;

/**
 * Nombres en el orden en que se guardaron. Recorta espacios al inicio y al final de cada uno y
 * descarta los vacios, que aparecen cuando el texto trae lineas de mas o termina en salto de linea.
 */
export function parseTagList(text?: string | null): string[] {
    if (!text) return [];
    return text
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => name.length > 0);
}

/**
 * Texto listo para guardar, o cadena vacia si no quedo ninguno —los endpoints la convierten en
 * NULL con nullif—.
 *
 * Sanea lo que el modal pudo dejar pasar:
 *  - recorta espacios y descarta vacios;
 *  - colapsa cualquier salto de linea de adentro de un nombre pegado desde afuera, que lo partiria
 *    en dos al volver a leerlo;
 *  - corta cada nombre a TAG_MAX_LENGTH;
 *  - deduplica sin distinguir mayusculas ni tildes.
 *
 * No corta por cantidad: si la lista pasa del tope, el modal no deja guardar. Cortar aca borraria
 * en silencio etiquetas que la tienda ya tenia.
 */
export function serializeTagList(names: string[]): string {
    const seen = new Set<string>();
    const clean: string[] = [];

    for (const raw of names || []) {
        const name = (raw ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, TAG_MAX_LENGTH).trim();
        if (!name) continue;

        const key = normalizeTag(name);
        if (seen.has(key)) continue;

        seen.add(key);
        clean.push(name);
    }

    return clean.join('\n');
}

/**
 * Clave de comparacion: minusculas, sin tildes y con los espacios colapsados. NFD separa la letra
 * de su tilde y el reemplazo borra la tilde suelta.
 */
export function normalizeTag(name: string): string {
    return (name ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** El texto guardado, normalizado para mostrar: sin lineas vacias ni espacios sobrantes. */
export function formatTagList(text?: string | null): string {
    return parseTagList(text).join('\n');
}
