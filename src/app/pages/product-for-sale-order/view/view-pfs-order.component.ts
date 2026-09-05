import { ChangeDetectionStrategy, Component, Inject, OnInit} from '@angular/core';
import { first } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { AccountService, AlertService, CAPABILITIES, DataService, PdfService, pfsFactoryOrderStatusValues, pfsStoreOrderStatusValues } from '@app/services';
import { OPERATOR_CHIP_COLOR, parseOperators, serializeOperators } from '@app/helpers';
import { OperatorCustomer } from '@app/components';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { ProductForSaleStoreOrder } from '@app/models/product-for-sale/product-for-sale-store-order.model';
import { Status } from '@app/models';
import { MatButtonModule } from '@angular/material/button';

/**
 * Un paso del diagrama de estados. `done` lo pinta en naranja, `current` le
 * agrega el halo y `failed` lo pinta en rojo (Devuelto / Cancelado).
 *
 * `lineBefore` y `lineAfter` son los dos medios tramos de la línea que une los
 * círculos; se calculan acá y no en CSS porque el tramo derecho de un paso
 * depende de si el SIGUIENTE está cumplido.
 */
interface OrderStep {
    label: string;
    date?: string;
    done: boolean;
    current: boolean;
    failed: boolean;
    lineBefore: boolean;
    lineAfter: boolean;
}

/** Definición de un paso antes de resolver si está cumplido. */
interface StepSource {
    label: string;
    statusId: number;
    date?: string;
}

@Component({
    selector: 'page-pfs-order-provider',
    templateUrl: 'view-pfs-order.component.html',
    styleUrls: ['view-pfs-order.component.scss']
})
export class ViewProductForSaleOrderComponent implements OnInit{

    id?: string;
    viewOption = '';
    storeId?: string;
    storeName = '';
    productForSaleOrder?: ProductForSaleStoreOrder;
    submitting = false;
    loading = false;
    isFactory = false;
    /** Modo consulta: el detalle solo se ve y se exporta a PDF, sin acciones sobre el pedido. */
    readOnly = false;

    /** Diagrama de estados, recalculado en cada carga del pedido. */
    steps: OrderStep[] = [];

    // Acciones disponibles según estado, vista y permisos
    releaseOption = false;
    readyOption = false;
    verifyOption = false;
    unprepareOption = false;
    receiveOption = false;
    returnOption = false;
    confirmReceiveOption = false;
    editOption = false;
    deleteOption = false;

    confirmDialogTitle = '...';
    confirmDialogText = '...';
    confirmDialogId = 0;
    errorMessage = '';

    // Operadores: quiénes prepararon el pedido en bodega. Se muestran siempre y se
    // editan desde acá, que es lo que permite ponerle operadores a un pedido que
    // pasó de Pendiente a Listo directo y nunca estuvo En curso.
    readonly operatorChipColor = OPERATOR_CHIP_COLOR;
    operatorsDialogOpen = false;
    operatorCustomers: OperatorCustomer[] = [];
    loadingOperatorCustomers = false;
    savingOperators = false;


    constructor(private dataService: DataService, private alertService: AlertService, private accountService: AccountService,
        private route: ActivatedRoute, private pdfService: PdfService, private router: Router, private dialog: MatDialog) {
    }

    ngOnInit(): void {

        this.id = this.route.snapshot.params['id'];
        this.readOnly = !!this.route.snapshot.data['readOnly'];

        this.route.queryParams.subscribe(params => {
            this.viewOption = params['opt'];
            this.storeId = params['store'];
            this.storeName = params['name'];
        });

        this.isFactory = this.viewOption === 'factory';

        if (this.id){
            this.loadOrder();
        }
    }

    private loadOrder(){
        this.loading = true;
        this.dataService.getProductForSaleOrderById(this.id!)
            .pipe(first())
            .subscribe({
                next: (response: any) => {
                    this.productForSaleOrder = this.dataService.findJsonValue(response, 'json_result') || {};
                    this.resetOptions();
                    this.setElementOptions(this.productForSaleOrder!);
                    this.steps = this.buildSteps(this.productForSaleOrder!);
                    this.loading = false;
                },
                error: () => {
                    this.alertService.error('No se pudo cargar el pedido. Intenta de nuevo.');
                    this.loading = false;
                }
            });
    }

    openDialog(error_message: String): void {
        this.dialog.open(DialogComponent, {
          data: {
            error_message: error_message
          }
        });
    }

    // ── Diagrama de estados ──────────────────────────────────────────────────

    /**
     * Arma el diagrama según la vista: bodega sigue factory_status_id y tienda
     * store_status_id, que son secuencias distintas —la tienda no ve "En curso",
     * porque mientras bodega prepara el pedido para la tienda sigue Pendiente.
     *
     * Hay pasos OPCIONALES —"Preparado" y "En camino"— que se omiten cuando no
     * tienen fecha: el pedido pudo saltarlos por un camino perfectamente válido,
     * y un paso gris permanente en medio del diagrama daría a entender que algo
     * quedó sin hacer. Si el pedido está parado justo en uno de ellos sí se
     * muestra, aunque sea un pedido viejo sin la fecha registrada.
     *
     * "Preparado" solo lo produce el tablero; el diagrama lo sabe dibujar para
     * que la vista no rompa, pero acá no hay botón que lleve a ese estado.
     */
    private buildSteps(order: ProductForSaleStoreOrder): OrderStep[] {
        const currentId = (this.isFactory ? order.factoryStatus?.id : order.storeStatus?.id) ?? -1;
        const f = pfsFactoryOrderStatusValues;
        const s = pfsStoreOrderStatusValues;

        const sources: StepSource[] = this.isFactory
            ? [
                { label: 'Pendiente',  statusId: f.pendiente.status.id,  date: order.creationDate },
                { label: 'En curso',   statusId: f.en_curso.status.id,   date: order.startDate },
                { label: 'Preparado',  statusId: f.preparado.status.id,  date: order.preparedDate },
                { label: 'Listo',      statusId: f.listo.status.id,      date: order.readyDate },
                { label: 'En camino',  statusId: f.en_camino.status.id,  date: order.inTransitDate },
                { label: 'Entregado',  statusId: f.entregado.status.id,  date: order.receivedDate },
              ]
            : [
                { label: 'Pendiente',  statusId: s.pendiente.status.id,  date: order.creationDate },
                { label: 'Listo',      statusId: s.listo.status.id,      date: order.readyDate },
                { label: 'En camino',  statusId: s.en_camino.status.id,  date: order.inTransitDate },
                { label: 'Recibido',   statusId: s.recibido.status.id,   date: order.receivedDate },
              ];

        // Un paso opcional se dibuja solo si dejó fecha o si el pedido está ahí.
        const optional: StepSource[] = this.isFactory
            ? [
                { label: 'Preparado', statusId: f.preparado.status.id, date: order.preparedDate },
                { label: 'En camino', statusId: f.en_camino.status.id, date: order.inTransitDate },
              ]
            : [
                { label: 'En camino', statusId: s.en_camino.status.id, date: order.inTransitDate },
              ];

        const visible = sources.filter(step => {
            const opt = optional.find(o => o.statusId === step.statusId);
            return !opt || !!opt.date || currentId === step.statusId;
        });

        const currentIndex = visible.findIndex(step => step.statusId === currentId);
        const terminal = this.getTerminalStep(order, currentIndex);

        // Con el pedido en un estado terminal (Devuelto/Cancelado) el estado
        // actual no está en la secuencia, así que no hay índice del cual
        // deducir lo cumplido: se toma como cumplido lo que dejó fecha. El
        // primer paso siempre lo está, porque creation_date nunca es nulo.
        const steps: OrderStep[] = visible.map((step, index) => ({
            label: step.label,
            date: step.date,
            done: currentIndex >= 0 ? index <= currentIndex : (index === 0 || !!step.date),
            current: currentIndex >= 0 && index === currentIndex && !terminal,
            failed: false,
            lineBefore: false,
            lineAfter: false
        }));

        if (terminal) steps.push(terminal);

        // Los pedidos anteriores a estas columnas no tienen fechas propias. La
        // única que se puede afirmar es la del ÚLTIMO paso alcanzado, que es el
        // movimiento que dejó grabado updated_date; los intermedios se quedan
        // sin fecha antes que mostrar la misma repetida por todo el diagrama.
        const lastDone = steps.map(step => step.done).lastIndexOf(true);
        if (lastDone >= 0 && !steps[lastDone].date) {
            steps[lastDone].date = order.updatedDate;
        }

        steps.forEach((step, index) => {
            step.lineBefore = step.done;
            step.lineAfter = steps[index + 1]?.done ?? false;
        });

        return steps;
    }

    /** Devuelto y Cancelado no están en la línea: cierran el diagrama en rojo. */
    private getTerminalStep(order: ProductForSaleStoreOrder, currentIndex: number): OrderStep | undefined {
        if (currentIndex >= 0) return undefined;

        const currentId = (this.isFactory ? order.factoryStatus?.id : order.storeStatus?.id) ?? -1;
        const label = this.isFactory
            ? (currentId === pfsFactoryOrderStatusValues.devuelto.status.id ? 'Devuelto' : 'Cancelado')
            : (currentId === pfsStoreOrderStatusValues.devuelto.status.id ? 'Devuelto' : 'Cancelado');

        return {
            label,
            date: order.updatedDate,
            done: true,
            current: true,
            failed: true,
            lineBefore: false,
            lineAfter: false
        };
    }

    // ── Acciones disponibles ─────────────────────────────────────────────────

    private resetOptions(){
        this.releaseOption = this.readyOption = false;
        this.verifyOption = this.unprepareOption = false;
        this.receiveOption = this.returnOption = this.confirmReceiveOption = false;
        this.editOption = this.deleteOption = false;
    }

    /**
     * ¿El pedido ya está firmado? La verificación NO es un estado: convive con
     * factoryStatus, así que un pedido puede estar Preparado y verificado o
     * Preparado y sin verificar.
     */
    get isVerified(): boolean {
        return !!this.productForSaleOrder?.verifiedUser?.id;
    }

    /**
     * ¿El usuario puede marcar como Listo un pedido que está En curso? Misma regla
     * que el tablero y que el procedure: el encargado que lo tomó, o quien pueda
     * pasar por encima del encargado.
     */
    get isOwner(): boolean {
        if (this.accountService.can(CAPABILITIES.ordersBoardOverrideOwner)) return true;
        const assignedId = this.productForSaleOrder?.assignedUser?.id;
        return !assignedId || assignedId === this.accountService.userValue.uuid;
    }

    /**
     * ¿El usuario puede devolver el pedido de En curso a Pendiente? Misma regla que
     * el tablero: el permiso orders.release —que el rol Sistema tiene siempre— o ser
     * el encargado que lo tomó.
     *
     * Un pedido En curso sin encargado queda solo para quien tenga el permiso. No
     * debería existir: el tablero es el único que lleva a En curso y siempre asigna.
     */
    get canRelease(): boolean {
        if (this.accountService.can(CAPABILITIES.ordersRelease)) return true;
        const assignedId = this.productForSaleOrder?.assignedUser?.id;
        return !!assignedId && assignedId === this.accountService.userValue.uuid;
    }

    setElementOptions(pfsOrder: ProductForSaleStoreOrder){
        // En modo consulta ninguna acción queda habilitada; solo se deja el botón de PDF
        if (this.readOnly) return;

        const elemStatus = pfsOrder.factoryStatus;
        if (!elemStatus) return;

        const f = pfsFactoryOrderStatusValues;

        if (this.isFactory){
            // Pendiente -> Listo directo. Es EL flujo de esta vista: acá no se toma
            // el pedido, el paso por En curso es exclusivo del tablero. El procedure
            // v3 rellena encargado, hora de inicio y hora de fin con quien lo marca.
            if (elemStatus.id == f.pendiente.status.id){
                this.readyOption = true;
            }

            // Un pedido que el tablero dejó En curso o Preparado también se cierra
            // desde acá, pero solo por su encargado: el procedure rechaza al resto
            // y el usuario terminaría viendo el diálogo de error. Esta vista no
            // lleva pedidos a Preparado —eso es del tablero—, pero sí tiene que
            // poder cerrar uno que quedó ahí.
            if ((elemStatus.id == f.en_curso.status.id || elemStatus.id == f.preparado.status.id) && this.isOwner){
                this.readyOption = true;
            }

            if (elemStatus.id == f.en_curso.status.id && this.canRelease){
                this.releaseOption = true;
            }

            // Preparado -> En curso: deshacer el paso para corregir el pedido.
            // Misma regla que el tablero y que el guard del UPDATE: el encargado.
            // No pide orders.release, porque el pedido no vuelve al pool.
            if (elemStatus.id == f.preparado.status.id && this.isOwner){
                this.unprepareOption = true;
            }

            // Verificar sin cerrar el pedido: solo desde Preparado, solo si no
            // tiene firma —no se reemplaza— y solo con la capacidad orders.verify.
            // Que no aparezca no bloquea a nadie: "Marcar listo" pide la firma
            // igual, y ese camino no mira capacidades.
            if (elemStatus.id == f.preparado.status.id && !this.isVerified
                && this.accountService.can(CAPABILITIES.ordersVerify)){
                this.verifyOption = true;
            }
        } else {
            if (elemStatus.id == f.listo.status.id || elemStatus.id == f.en_camino.status.id){
                this.receiveOption = true;
                this.returnOption = true;
            }
            if (pfsOrder.establishment?.receivePendingOrdersEnabled && elemStatus.id == f.pendiente.status.id){
                this.confirmReceiveOption = true;
            }
        }

        // Verificar un pedido Listo(13) que quedó sin firma. Solo pasa por un camino:
        // editarlo. Cambiar los productos de un pedido Listo le quita la verificación,
        // porque la firma anterior certificaba otra lista. Volver a firmarlo es
        // OPCIONAL —recibir y devolver no piden verificación—, así que esto es un botón
        // y no un bloqueo. Va fuera del if de bodega a proposito: el pedido se pudo
        // editar desde cualquiera de las dos vistas y desde ahí mismo se corrige.
        if (elemStatus.id == f.listo.status.id && !this.isVerified
            && this.accountService.can(CAPABILITIES.ordersVerify)){
            this.verifyOption = true;
        }

        if (elemStatus.id == f.pendiente.status.id){
            this.deleteOption = true;
        }

        // Editar pide orders.edit SIEMPRE, incluso con el pedido Pendiente: la tienda lo
        // crea y a partir de ahi solo lo corrige quien tenga el permiso.
        // orders.editAfterPending es la extension, para seguir editando pasado Pendiente.
        // orders.editReady es un escalon mas, solo para Listo: ahi editar mueve inventario
        // -el producto ya salio de bodega- y le quita la verificacion al pedido.
        if (!(elemStatus.id == f.cancelado.status.id || elemStatus.id == f.recibido.status.id || elemStatus.id == f.eliminado.status.id)){
            if(this.accountService.can(CAPABILITIES.ordersEdit)
                && (elemStatus.id == f.pendiente.status.id || this.accountService.can(CAPABILITIES.ordersEditAfterPending))
                && (elemStatus.id != f.listo.status.id || this.accountService.can(CAPABILITIES.ordersEditReady))){
                this.editOption = true;
            }
        }
    }

    // ── Transiciones ─────────────────────────────────────────────────────────

    actionOrder(action: number){
        switch (action) {
            case 1:
                this.confirmDialogTitle = 'Recibir Pedido';
                this.confirmDialogText = '¿Deseas marcar el pedido como RECIBIDO?';
                break;
            case 2:
                this.confirmDialogTitle = 'Pedido listo';
                this.confirmDialogText = '¿Deseas marcar el pedido como LISTO? Esto descuenta el producto terminado de bodega.'
                    // Cerrar el pedido es también verificarlo cuando nadie lo firmó
                    // antes, y conviene saberlo antes de confirmar.
                    + (this.isVerified ? '' : ' El pedido queda además registrado como verificado por ti.');
                break;
            case 4:
                this.confirmDialogTitle = 'Devolver pedido';
                this.confirmDialogText = '¿Deseas DEVOLVER el pedido?';
                break;
            case 5:
                this.confirmDialogTitle = 'Confirmar y recibir pedido';
                this.confirmDialogText = '¿Deseas CONFIRMAR y marcar el pedido como RECIBIDO?';
                break;
            case 6:
                this.confirmDialogTitle = 'Eliminar pedido';
                this.confirmDialogText = '¿Deseas ELIMINAR el pedido? Esta acción no se puede deshacer.';
                break;
            case 7:
                // Solo se llega acá con el pedido verificado: sin firma que perder,
                // el botón llama a unprepareOrder() directo, sin confirmación.
                this.confirmDialogTitle = 'Devolver el pedido a En curso';
                this.confirmDialogText = 'El pedido vuelve a EN CURSO para poder corregirlo, y conserva'
                    + ' su encargado y sus operadores. Se quita la verificación de '
                    + (this.productForSaleOrder?.verifiedUser?.name ?? 'quien lo verificó')
                    + ': al volver a marcarlo como preparado o listo habrá que verificarlo de nuevo.';
                break;
            case 8:
                this.confirmDialogTitle = 'Verificar pedido';
                this.confirmDialogText = 'El pedido queda registrado como verificado por ti, con la fecha y hora'
                    + ' de ahora. La verificación no se puede cambiar después: solo se borra si el pedido vuelve'
                    + ' a En curso o si se editan sus productos.';
                break;
            default:
                break;
        }
        this.confirmDialogId = action;
    }

    onConfirmDialog(){
        const orderId = this.productForSaleOrder?.id;
        if (!orderId) return;

        switch (this.confirmDialogId) {
            case 1:
                this.runAndLeave(this.dataService.manageProductForSaleOrderStateReceived(orderId),
                    'Pedido recibido', 'Error al recibir el pedido');
                break;
            case 2:
                this.runAndLeave(this.dataService.manageProductForSaleOrderStateReady(orderId),
                    'Pedido marcado como listo', 'Error al marcar el pedido como Listo');
                break;
            case 4:
                this.runAndLeave(this.dataService.manageProductForSaleOrderStateReturned(orderId),
                    'Pedido devuelto', 'Error al devolver el pedido');
                break;
            case 5:
                this.runAndLeave(this.dataService.confirmAndReceivePFSOrder(orderId),
                    'Pedido confirmado y recibido', 'Error al confirmar y recibir el pedido');
                break;
            case 6:
                this.runAndLeave(this.dataService.deleteProductForSaleOrder(orderId),
                    'Pedido eliminado', 'Error al eliminar el pedido');
                break;
            case 7:
                this.unprepareOrder();
                break;
            case 8:
                this.verifyOrder();
                break;
        }
    }

    /**
     * Preparado -> En curso, para corregir un pedido que no debió avanzar. Como
     * liberar, no mueve inventario y deja al usuario en la pantalla viendo el
     * diagrama retroceder.
     *
     * La confirmación solo se ofrece cuando el pedido está verificado, que es el
     * único caso en que se pierde algo: la firma se borra porque los productos se
     * pueden editar mientras el pedido está En curso.
     */
    unprepareOrder(){
        this.runAndReload(this.dataService.unprepareProductForSaleOrder(this.productForSaleOrder!.id!),
            'Pedido devuelto a En curso', 'No se pudo devolver el pedido a En curso');
    }

    /**
     * Devolver el pedido a Pendiente es la única transición de esta vista que no
     * mueve inventario, así que no pide confirmación y deja al usuario en la
     * pantalla viendo el diagrama retroceder.
     *
     * Solo aplica a pedidos que el tablero puso En curso: esta vista va de
     * Pendiente directo a Listo y nunca produce ese estado.
     */
    releaseOrder(){
        this.runAndReload(this.dataService.releaseProductForSaleOrder(this.productForSaleOrder!.id!),
            'Pedido liberado', 'No se pudo liberar el pedido');
    }

    private runAndLeave(request: Observable<any>, successMessage: string, errorMessage: string){
        this.submitting = true;
        request.pipe(first()).subscribe({
            next: () => {
                this.alertService.success(successMessage, { keepAfterRouteChange: true });
                this.navigateWithParams();
            },
            error: error => {
                this.submitting = false;
                this.errorMessage = this.dataService.getErrorMessageResponse(error, errorMessage);
                this.openDialog(this.errorMessage);
            }
        });
    }

    private runAndReload(request: Observable<any>, successMessage: string, errorMessage: string){
        this.submitting = true;
        request.pipe(first()).subscribe({
            next: () => {
                this.alertService.success(successMessage);
                this.submitting = false;
                this.loadOrder();
            },
            error: () => {
                this.submitting = false;
                this.alertService.error(errorMessage);
            }
        });
    }

    // ── Navegación ───────────────────────────────────────────────────────────

    editOrder(){
        this.router.navigate(['/productsForSale/order/edit/' + this.productForSaleOrder?.id], {
            queryParams: this.viewOption
                ? { opt: this.viewOption, store: this.storeId, name: this.storeName }
                : {}
        });
    }

    navigateWithParams(){
        if (!this.viewOption){
            this.router.navigateByUrl('/productsForSale/order');
            return;
        }
        const queryParams: any = { opt: this.viewOption };
        if (this.storeId){
            queryParams.store = this.storeId;
            queryParams.name = this.storeName;
        }
        this.router.navigate(['/productsForSale/order'], { queryParams });
    }

    generatePDF() {
        this.pdfService.generateProductForSaleOrderPDF(this.productForSaleOrder!, this.viewOption);
    }

    // ── Presentación ─────────────────────────────────────────────────────────

    formatDate(utcTime?: string): string {
        if (!utcTime) return '--';
        return this.dataService.getLocalDateTimeFromUTCTime(utcTime);
    }

    /**
     * Fecha corta para el diagrama: DD/MM HH:mm. Con la fecha completa cada paso
     * ocupa el doble de ancho y el diagrama deja de caber; la completa queda en
     * el panel de detalles.
     */
    formatStepDate(utcTime?: string): string {
        if (!utcTime) return '';
        const [date, time] = this.dataService.getLocalDateTimeFromUTCTime(utcTime).split(' ');
        const [day, month] = date.split('/');
        return `${day}/${month} ${time.slice(0, 5)}`;
    }

    price(value?: string | number): string {
        return this.dataService.getFormatedPrice(Number(value) || 0);
    }

    /**
     * El estado que le corresponde a la vista. Son dos secuencias distintas y
     * mostrar ambas confundía: mientras bodega tiene el pedido En curso, para la
     * tienda sigue Pendiente, y ninguna de las dos necesita ver la otra.
     */
    get orderStatus(): Status | undefined {
        return this.isFactory ? this.productForSaleOrder?.factoryStatus : this.productForSaleOrder?.storeStatus;
    }

    /** '--' es el marcador de "sin notas" que guarda la pantalla de creación. */
    get orderComment(): string {
        const comment = this.productForSaleOrder?.comment?.trim();
        return !comment || comment === '--' ? '' : comment;
    }

    // ── Operadores ───────────────────────────────────────────────────────────

    /**
     * ¿Se muestra el bloque de operadores? Solo en la vista de bodega.
     *
     * Es un dato interno: la tienda no tiene por qué saber quién le está
     * preparando el pedido. La misma pantalla sirve a las dos vistas —cambia
     * `opt`—, así que la separación se hace acá y no con dos componentes.
     */
    get showOperators(): boolean {
        return this.isFactory;
    }

    get operators(): string[] {
        return parseOperators(this.productForSaleOrder?.operators);
    }

    /**
     * Un pedido que YA tiene operadores no se puede dejar sin ninguno: vaciar la
     * lista sería perder el dato sin querer, y el tablero tampoco permite tomar
     * un pedido sin ellos. Uno que no tiene todavía sí se puede cerrar sin
     * agregar nada, porque agregarlos acá es opcional.
     *
     * Se mide contra lo GUARDADO, no contra lo que el usuario esté editando: la
     * exigencia no cambia mientras el modal está abierto.
     */
    get operatorsRequired(): boolean {
        return this.operators.length > 0;
    }

    /**
     * Solo mientras el pedido siga en bodega: Pendiente(11), En curso(12) o
     * Preparado(64). Desde Listo(13) el pedido ya salió y sus operadores son un
     * registro histórico de quién lo preparó, así que no se reescriben.
     *
     * Antes se ofrecía en casi todo el ciclo de vida —la base solo rechaza
     * Eliminado(10) y Cancelado(15)—, lo que permitía ponerle operadores a un
     * pedido que se cerró desde esta misma vista, que va de Pendiente a Listo
     * directo y nunca los pide. Ese caso ahora hay que atenderlo ANTES de marcar
     * el pedido como Listo.
     *
     * La lista blanca es deliberada: cualquier estado que se agregue al ciclo de
     * vida nace sin permitir la edición, que es el lado seguro.
     */
    get canEditOperators(): boolean {
        // En modo consulta y en la vista de tienda no se editan: la tienda ni
        // siquiera los ve.
        if (this.readOnly || !this.showOperators) return false;
        const statusId = this.productForSaleOrder?.factoryStatus?.id;
        if (statusId === undefined) return false;
        const f = pfsFactoryOrderStatusValues;
        return statusId === f.pendiente.status.id
            || statusId === f.en_curso.status.id
            || statusId === f.preparado.status.id;
    }

    /** El catálogo se pide al abrir el modal, no al cargar la vista: casi nunca se usa. */
    openOperatorsDialog() {
        this.operatorsDialogOpen = true;
        if (this.operatorCustomers.length || this.loadingOperatorCustomers) return;

        this.loadingOperatorCustomers = true;
        this.dataService.getOperatorCustomers()
            .pipe(first())
            .subscribe({
                next: (result: any) => {
                    this.operatorCustomers = this.dataService.findJsonValue(result, 'json_result') || [];
                },
                error: () => {
                    // Sin catálogo el modal sigue sirviendo para los operadores manuales.
                    this.operatorCustomers = [];
                },
                complete: () => { this.loadingOperatorCustomers = false; }
            });
    }

    onOperatorsCancelled() {
        this.operatorsDialogOpen = false;
    }

    onOperatorsConfirmed(names: string[]) {
        const orderId = this.productForSaleOrder?.id;
        if (!orderId) return;

        const operators = serializeOperators(names);
        this.savingOperators = true;
        this.dataService.updateProductForSaleOrderOperators(orderId, operators)
            .pipe(first())
            .subscribe({
                next: () => {
                    this.alertService.success('Operadores actualizados');
                    this.operatorsDialogOpen = false;
                    this.savingOperators = false;
                    this.loadOrder();
                },
                error: (error) => {
                    this.savingOperators = false;
                    this.alertService.error(
                        this.dataService.getErrorMessageResponse(error, 'No se pudieron guardar los operadores')
                    );
                }
            });
    }

    // ── Verificación ─────────────────────────────────────────────────────────

    /**
     * Firma el pedido a nombre del usuario actual, sin moverlo de estado. Deja al
     * usuario en la pantalla: el pedido no se movió y lo que cambió —la firma— se
     * ve acá mismo.
     *
     * La confirmación la pide el modal de siempre (caso 8), porque la firma queda
     * a nombre de quien la confirma y no se puede cambiar después.
     */
    verifyOrder(){
        this.runAndReload(this.dataService.verifyPreparedProductForSaleOrder(this.productForSaleOrder!.id!),
            'Pedido verificado', 'No se pudo verificar el pedido');
    }

    /** ¿Hay algún botón de transición que mostrar debajo del diagrama? */
    get hasActions(): boolean {
        return this.releaseOption || this.readyOption || this.verifyOption || this.unprepareOption
            || this.receiveOption || this.returnOption || this.confirmReceiveOption;
    }
}

@Component({
    selector: 'dialog-component',
    template: `
        <h2 mat-dialog-title>ERROR</h2>
        <mat-dialog-content>{{data.error_message}}</mat-dialog-content>
        <mat-dialog-actions>
        <button mat-button mat-dialog-close>Cerrar</button>
        </mat-dialog-actions>
    `,
    standalone: true,
    imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  })
  export class DialogComponent {
    constructor(
        public dialogRef: MatDialogRef<DialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any, private router: Router) {}

    ngOnInit() {
        // Subscribirse al evento de cierre del diálogo
        this.dialogRef.afterClosed().subscribe(() => {
          this.reloadPage(); // Recargar la página cuando se cierre el diálogo
        });
      }

      // Método para recargar la página
      reloadPage(): void {
        window.location.reload(); // Recarga la página completa
        // O también puedes usar: location.reload(); -> Alternativa
    }

  }
