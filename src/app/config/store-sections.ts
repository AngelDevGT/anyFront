import { Establishment } from '@app/models/establishment.model';

/**
 * Catalogo de las secciones que se trabajan sobre una tienda. Es la unica fuente de verdad de:
 *
 *   1. los hijos del grupo "Tienda" del menu lateral (AccountService),
 *   2. a donde se navega al cambiar de tienda (StoreContextService),
 *   3. que seccion esta activa segun la URL (barra de contexto).
 *
 * Las URLs no cambian respecto de como estaban cuando se entraba desde el listado de tiendas: la
 * tienda sigue viajando en la ruta (o en query params, en el caso de pedidos). Eso mantiene validos
 * los patrones de `role.paths` que ya tiene cada rol en la base y los enlaces guardados.
 *
 * Este archivo no importa servicios a proposito, para que lo puedan usar tanto AccountService como
 * StoreContextService sin ciclos de importacion.
 */

/**
 * Segmento que ocupa el lugar de la tienda mientras no hay ninguna elegida. Se navega a el desde el
 * menu lateral para que la seccion abra igual y muestre el selector en grande, conservando la forma
 * de la ruta ("/store/inventory/<algo>") para que los patrones de role.paths sigan validando.
 */
export const STORE_PLACEHOLDER = 'seleccionar';

/** Tienda ficticia con la que se evaluan los patrones de role.paths al armar el menu. */
const SAMPLE_STORE_ID = '00000000-0000-0000-0000-000000000000';

export interface StoreSectionLink {
    path: any[];
    query?: { [key: string]: string };
}

export interface StoreSection {
    /** Llave interna; es la que llevan los hijos del menu lateral. */
    key: string;
    label: string;
    icon: string;
    /** Ruta de muestra con la que se evaluan los patrones de role.paths del usuario. */
    matchRoute: string;
    /** ¿La URL pertenece a la seccion? Incluye sus detalles (ver, crear, editar). */
    matches: (path: string, params: URLSearchParams) => boolean;
    /** ¿Es el listado de la seccion? Es el unico lugar donde tiene sentido cambiar de tienda. */
    isListing: (path: string, params: URLSearchParams) => boolean;
    /** Enlace al listado de la seccion para una tienda; sin tienda usa el placeholder. */
    link: (store?: Establishment) => StoreSectionLink;
}

export const STORE_SECTIONS: StoreSection[] = [
    {
        key: 'inventory',
        label: 'Inventario',
        icon: 'inventory_2',
        matchRoute: `/store/inventory/${SAMPLE_STORE_ID}`,
        matches: path => /^\/store\/inventory\//.test(path),
        isListing: path => /^\/store\/inventory\/[^/]+$/.test(path),
        link: store => ({ path: ['/store/inventory', store?.id ?? STORE_PLACEHOLDER] })
    },
    {
        key: 'sales',
        label: 'Ventas',
        icon: 'shopping_bag',
        matchRoute: `/store/sales/history/${SAMPLE_STORE_ID}`,
        // "create" y "history/edit|view" son los detalles de la misma seccion
        matches: path => /^\/store\/sales\/(history|create)/.test(path),
        isListing: path => /^\/store\/sales\/history\/[^/]+$/.test(path),
        link: store => ({ path: ['/store/sales/history', store?.id ?? STORE_PLACEHOLDER] })
    },
    {
        key: 'orders',
        label: 'Pedidos',
        icon: 'local_shipping',
        matchRoute: `/productsForSale/order?opt=store&store=${SAMPLE_STORE_ID}`,
        // La misma ruta la usa bodega con opt=factory, que despacha a tiendas que el usuario no
        // tiene asignadas: ahi la tienda la manda el tablero y esta seccion no interviene.
        matches: (path, params) => /^\/productsForSale\/order/.test(path) && params.get('opt') === 'store',
        isListing: (path, params) => path === '/productsForSale/order' && params.get('opt') === 'store',
        // Unica seccion donde la tienda viaja en query params y no en la ruta
        link: store => {
            const query: { [key: string]: string } = { opt: 'store' };
            if (store?.id) {
                query['store'] = store.id;
                query['name'] = store.name ?? '';
            }
            return { path: ['/productsForSale/order'], query };
        }
    },
    {
        key: 'expenses',
        label: 'Gastos',
        icon: 'money_off',
        matchRoute: `/store/expenses/history/${SAMPLE_STORE_ID}`,
        matches: path => /^\/store\/expenses\//.test(path),
        isListing: path => /^\/store\/expenses\/history\/[^/]+$/.test(path),
        link: store => ({ path: ['/store/expenses/history', store?.id ?? STORE_PLACEHOLDER] })
    },
    {
        key: 'customers',
        label: 'Clientes',
        icon: 'group',
        matchRoute: `/store/customers/${SAMPLE_STORE_ID}`,
        matches: path => /^\/store\/customers\//.test(path),
        // "/store/customers/payments" tiene la misma forma que el listado pero es un detalle
        isListing: path => /^\/store\/customers\/(?!payments$)[^/]+$/.test(path),
        link: store => ({ path: ['/store/customers', store?.id ?? STORE_PLACEHOLDER] })
    },
    {
        key: 'cashClosing',
        label: 'Caja',
        icon: 'dns',
        matchRoute: `/cashClosing/${SAMPLE_STORE_ID}`,
        matches: path => /^\/cashClosing\//.test(path),
        isListing: path => /^\/cashClosing\/[^/]+$/.test(path),
        link: store => ({ path: ['/cashClosing', store?.id ?? STORE_PLACEHOLDER] })
    }
];

export function findStoreSection(key?: string): StoreSection | undefined {
    return key ? STORE_SECTIONS.find(section => section.key === key) : undefined;
}

/** Parte una URL del router en ruta y query params. */
function splitUrl(url: string): { path: string, params: URLSearchParams } {
    const withoutFragment = url.split('#')[0];
    const [path, query] = withoutFragment.split('?');
    return { path, params: new URLSearchParams(query ?? '') };
}

/** La seccion a la que pertenece una URL. */
export function storeSectionForUrl(url: string): StoreSection | undefined {
    const { path, params } = splitUrl(url);
    return STORE_SECTIONS.find(section => section.matches(path, params));
}

/** ¿La URL es el listado de la seccion (y no uno de sus detalles)? */
export function isStoreSectionListing(url: string, section: StoreSection): boolean {
    const { path, params } = splitUrl(url);
    return section.isListing(path, params);
}

/** El id de tienda de una ruta; `undefined` cuando trae el placeholder o no trae nada. */
export function storeIdFromRoute(value?: string | null): string | undefined {
    return value && value !== STORE_PLACEHOLDER ? value : undefined;
}
