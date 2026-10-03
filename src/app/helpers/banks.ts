import { formatTagList, normalizeTag, parseTagList, serializeTagList } from './tag-list';

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
 * El formato comun y el tope de cantidad viven en tag-list.ts.
 */

/** Nombres de una tienda, en el orden en que se guardaron. */
export function parseBanks(banks?: string | null): string[] {
    return parseTagList(banks);
}

/** Texto listo para guardar, o cadena vacia si no quedo ninguno. Ver serializeTagList. */
export function serializeBanks(names: string[]): string {
    return serializeTagList(names);
}

/** Clave de comparacion: minusculas, sin tildes y con los espacios colapsados. */
export function normalizeBank(name: string): string {
    return normalizeTag(name);
}

/**
 * El texto guardado, normalizado para mostrar. Es lo que ve el detalle de la tienda, que lo
 * imprime con los saltos de linea intactos. Cadena vacia si la tienda no tiene bancos cargados.
 */
export function formatBanks(banks?: string | null): string {
    return formatTagList(banks);
}
