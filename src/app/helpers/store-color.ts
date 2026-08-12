/**
 * Color de identidad de cada tienda. `establishment` no tiene columna de color, asi que se deriva
 * del id: se hashea el id completo y no la inicial del nombre, si no dos tiendas con la misma
 * letra saldrian iguales.
 *
 * Vive aca y no dentro de un componente para que el tablero y el dashboard pinten la misma tienda
 * del mismo color; si cada pantalla tuviera su copia, la misma tienda saldria de un color en una
 * y de otro en la otra.
 */
export const storePalette = [
    '#edb400', '#ed7400', '#e82222', '#d50962',
    '#a33788', '#664b90', '#354f7b', '#2f4858',
    '#0092a5', '#55babf', '#00915c', '#008b00',
    '#69c000', '#767d00', '#b86000', '#3a001e'
];

/**
 * Variante de cada color para cuando se usa en TEXTO, indexada igual que la de arriba.
 *
 * Los tonos de relleno funcionan sobre cualquier fondo, pero como texto sobre blanco varios se
 * quedan por debajo del minimo: el dorado (#edb400) llega apenas a 1.9:1 y el turquesa claro
 * (#55babf) a 2.3:1, cuando texto normal necesita 4.5:1 —y el nombre de la tienda va ademas en
 * peso delgado, que lo empeora—. Los seis que ya pasaban se repiten tal cual; los otros diez se
 * oscurecieron conservando el tono.
 */
export const storeTextPalette = [
    '#8a6900', '#b05400', '#c41818', '#d50962',
    '#a33788', '#664b90', '#354f7b', '#2f4858',
    '#00707f', '#2f6f6c', '#007148', '#007a00',
    '#457400', '#656b00', '#8f4a00', '#3a001e'
];

/**
 * Color por POSICION: la primera tarjeta de una rejilla recibe el primer color de la paleta, la
 * segunda el segundo, y asi. Es lo que hace que la paleta se recorra en secuencia en pantalla.
 *
 * El color queda atado al lugar y no a la tienda: si cambia el orden o el filtro, cambia el
 * color. Para donde haga falta que una tienda conserve el suyo esta `getStoreColor`.
 */
export function getStoreColorByIndex(index: number): string {
    return storePalette[index % storePalette.length];
}

export function getStoreTextColorByIndex(index: number): string {
    return storeTextPalette[index % storeTextPalette.length];
}

/**
 * Color por id, para las pantallas que no tienen una posicion estable de donde partir —el tablero
 * reparte los pedidos en columnas por estado, no en una lista—. Se hashea el id completo y no la
 * inicial del nombre, si no dos tiendas con la misma letra saldrian iguales.
 */
export function getStoreColor(establishmentId?: string): string {
    if (!establishmentId) return storePalette[0];
    let hash = 0;
    for (let i = 0; i < establishmentId.length; i++) {
        hash = (hash * 31 + establishmentId.charCodeAt(i)) | 0;
    }
    return storePalette[Math.abs(hash) % storePalette.length];
}
