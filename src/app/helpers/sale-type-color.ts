/**
 * Colores de los badges de tipo de venta (efectivo, credito, deposito, cheque).
 *
 * Vive aca y no dentro de la pantalla de historial de ventas porque la capsula de OPERADOR de los
 * pedidos reusa el tono de credito: si cada pantalla tuviera su copia del hex, un retoque en una
 * dejaria la otra desalineada sin que nadie lo note.
 */
export const SALE_TYPE_COLORS: { [type: string]: { bg_color: string, color: string } } = {
    'Crédito': { bg_color: '#fff3cd', color: '#856404' },
    'Efectivo': { bg_color: '#d4edda', color: '#155724' },
    'Depósito': { bg_color: '#cfe2ff', color: '#084298' },
    'Cheque': { bg_color: '#e2d9f3', color: '#432874' }
};

/** Sin entrada en el mapa, gris neutro. */
export const DEFAULT_SALE_TYPE_COLOR = { bg_color: '#eef0f3', color: '#4b5563' };

/**
 * Color de las capsulas de operador de un pedido. Es el ambar de credito.
 *
 * Todos los operadores del pedido salen del mismo color, vengan del catalogo de clientes o
 * escritos a mano: una vez guardados son indistinguibles, porque `operators` es texto y no
 * conserva la FK del cliente. La distincion por origen existe solo DENTRO del modal de edicion,
 * mientras se arma la lista.
 *
 * El ambar tambien lo separa de la capsula de tienda, que usa la paleta saturada de
 * `store-color` con texto blanco.
 */
export const OPERATOR_CHIP_COLOR = SALE_TYPE_COLORS['Crédito'];
