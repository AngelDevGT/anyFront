/**
 * Operadores de un pedido: quienes lo prepararon en bodega.
 *
 * En la base viven en una sola columna de texto, separados por pipe:
 *
 *     'Juan Perez|Maria Lopez|Carlos'
 *
 * Se guarda el NOMBRE y no la FK del cliente a proposito. Evita resolver los nombres en cada
 * lectura de pedido —tablero, listado, detalle y PDF— y hace que un pedido conserve el nombre que
 * el cliente tenia cuando se preparo, que es lo correcto para un registro historico. El precio es
 * que un operador del catalogo y uno escrito a mano son indistinguibles una vez guardados.
 *
 * Todo el formato vive aca: el modal, la tarjeta, el detalle, las tablas y el PDF pasan por estas
 * dos funciones y ninguno parte el texto por su cuenta.
 */

/** Tope de la columna. text no tiene limite en Postgres; el corte es para que un pegado accidental no llene la fila. */
export const OPERATORS_MAX_LENGTH = 500;

/** Tope de un nombre suelto, alineado con customer."name". */
export const OPERATOR_MAX_LENGTH = 100;

/**
 * Nombres de un pedido, en el orden en que se guardaron. Descarta los vacios, que aparecen cuando
 * el texto trae pipes de mas ('Juan||Maria') o termina en pipe.
 */
export function parseOperators(operators?: string | null): string[] {
    if (!operators) return [];
    return operators
        .split('|')
        .map(name => name.trim())
        .filter(name => name.length > 0);
}

/**
 * Texto listo para guardar, o cadena vacia si no quedo ninguno —el endpoint la convierte en NULL
 * con nullif—.
 *
 * Sanea lo que el modal pudo dejar pasar:
 *  - recorta espacios y descarta vacios;
 *  - quita el pipe de adentro de un nombre escrito a mano, que rompería el formato;
 *  - deduplica sin distinguir mayusculas ni tildes, para que "Jose" y "José" no entren dos veces;
 *  - corta el largo total.
 */
export function serializeOperators(names: string[]): string {
    const seen = new Set<string>();
    const clean: string[] = [];

    for (const raw of names || []) {
        const name = (raw ?? '').replace(/\|/g, ' ').trim().slice(0, OPERATOR_MAX_LENGTH);
        if (!name) continue;

        const key = normalizeOperator(name);
        if (seen.has(key)) continue;

        seen.add(key);
        clean.push(name);
    }

    const text = clean.join('|');
    if (text.length <= OPERATORS_MAX_LENGTH) return text;

    // Se corta por nombre completo: partir uno a la mitad dejaria un operador inventado.
    const kept: string[] = [];
    for (const name of clean) {
        const next = kept.length ? kept.join('|') + '|' + name : name;
        if (next.length > OPERATORS_MAX_LENGTH) break;
        kept.push(name);
    }
    return kept.join('|');
}

/**
 * Clave de comparacion: minusculas, sin tildes y con los espacios colapsados. NFD separa la letra
 * de su tilde y el reemplazo borra la tilde suelta.
 */
export function normalizeOperator(name: string): string {
    return (name ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Los operadores de un pedido en una linea, para las tablas y el PDF. Cadena vacia si no tiene. */
export function formatOperators(operators?: string | null): string {
    return parseOperators(operators).join(', ');
}
