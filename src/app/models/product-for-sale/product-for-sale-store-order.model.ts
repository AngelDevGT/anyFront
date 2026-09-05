import { Status } from "../auxiliary/status.model";
import { Establishment } from "../establishment.model";
import { User } from "../system/user.model";
import { ProductForSaleStoreOrderElement } from "./product-for-sale-store-order-element.model";

export class ProductForSaleStoreOrder {
    id?: string;
    /**
     * Correlativo visible del pedido, propio de cada tienda (1, 2, 3...). Lo
     * asigna la base en el INSERT; los pedidos anteriores a la numeración se
     * llenaron de forma retroactiva en orden cronológico.
     */
    orderNumber?: number;
    productForSaleStoreOrderElements?: ProductForSaleStoreOrderElement[];
    name?: string;
    comment?: string;
    establishmentID?: string;
    establishment?: Establishment;
    inventoryID?: string;
    storeStatus?: Status; // Pendiente, En Camino, Recibido,  Cancelado, Eliminado
    factoryStatus?: Status; // Pendiente, Listo, Entregado, Cancelado, Devuelto, Eliminado
    finalAmount?: string;
    creatorUser?: User;
    creationDate?: string;
    updatedDate?: string;
    // Tablero de bodega: se llenan al pasar el pedido a En curso / Listo.
    // Quedan en null para los pedidos anteriores al tablero y para los que
    // pasan a Listo desde la vista de tabla vieja.
    assignedUser?: User;
    startDate?: string;
    /**
     * Paso opcional del tablero entre En curso y Listo. Queda null cuando el
     * pedido va de En curso directo a Listo, que es un camino válido: el
     * diagrama de estados omite el paso "Preparado" cuando falta.
     */
    preparedDate?: string;
    readyDate?: string;
    /**
     * Queda null si el pedido pasó de Listo directo a Recibido, que es un flujo
     * válido. El diagrama de estados omite el paso "En camino" cuando falta.
     */
    inTransitDate?: string;
    receivedDate?: string;
    /**
     * Quién firmó la revisión del pedido. NO es un estado: es una marca de control
     * paralela a factoryStatus, así que un pedido puede estar Preparado y verificado,
     * Preparado y sin verificar, o Listo y verificado. Lo que no existe es un pedido
     * Listo sin verificar: el procedure lo exige para esa transición.
     *
     * Tampoco es necesariamente quien ejecutó la acción. Se elige de una lista de
     * usuarios activos con rol de bodega, sistema o administrador, porque el tablero
     * corre en una máquina compartida y la firma tiene que ser explícita.
     *
     * Queda null en los pedidos sin verificar y en todos los anteriores a esta
     * función, que no se rellenaron. Una vez escrito no se reemplaza.
     * Ver src/database/migrations/2026-08-29-verificacion-pedidos-bodega.sql
     */
    verifiedUser?: User;
    /** Hora de la verificación. Se escribe junto con verifiedUser, nunca por separado. */
    verifiedDate?: string;
    /**
     * Quiénes prepararon el pedido en bodega, como texto separado por pipes:
     * 'Juan Pérez|María López|Carlos'. Mezcla clientes marcados como Operador
     * con nombres escritos a mano, sin distinguir el origen.
     *
     * Se guarda el NOMBRE y no la FK del cliente a propósito: evita resolver los
     * nombres en cada lectura de pedido, y hace que un pedido conserve el nombre
     * que el cliente tenía cuando se preparó, que es lo que corresponde a un
     * registro histórico.
     *
     * Queda null en los pedidos anteriores a esta función y en los que se marcan
     * como Listo desde la vista de detalle, que no los pide. Usar parseOperators
     * de @app/helpers para leerlo.
     */
    operators?: string;
}