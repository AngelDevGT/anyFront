import { formatTagList, parseTagList, serializeTagList } from './tag-list';

/**
 * Etiquetas de gastos de una tienda: las opciones que se ofrecen al registrar un gasto.
 *
 * Mismo formato que los bancos (ver banks.ts y tag-list.ts): una columna de texto,
 * establishment.expense_tags, con los nombres separados por salto de linea. Se cargan desde el
 * boton "Gastos" en Sistema > Tiendas.
 */

/** Etiquetas de una tienda, en el orden en que se guardaron. */
export function parseExpenseTags(tags?: string | null): string[] {
    return parseTagList(tags);
}

/** Texto listo para guardar, o cadena vacia si no quedo ninguna. Ver serializeTagList. */
export function serializeExpenseTags(names: string[]): string {
    return serializeTagList(names);
}

/** El texto guardado, normalizado para mostrar en el detalle de la tienda. */
export function formatExpenseTags(tags?: string | null): string {
    return formatTagList(tags);
}
