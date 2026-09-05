import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';

/**
 * Control de recarga automatica: un switch para encenderla y un desplegable para elegir cada
 * cuanto. Emite (refresh) en cada vencimiento y NADA mas; recargar es cosa del host, que es el
 * unico que sabe si en ese momento conviene.
 *
 *   <app-auto-refresh storageKey="board_pfs_auto_refresh" (refresh)="autoRefreshTick()">
 *   </app-auto-refresh>
 *
 * Vive en components/ porque lo usan las dos pantallas de bodega que se dejan puestas en una
 * maquina y se miran de lejos: el tablero de pedidos y la vista de pedidos preparados.
 *
 * LA PREFERENCIA ES POR NAVEGADOR, NO POR USUARIO
 * Se guarda en localStorage bajo `storageKey`, asi que cada maquina de bodega queda configurada
 * como la dejaron, sin importar quien entre despues. Cada pantalla pasa su propia clave: tener el
 * tablero refrescando cada minuto no significa querer lo mismo en la otra vista.
 *
 * EL HOST DECIDE SI RECARGA
 * El componente no sabe de spinners ni de dialogos abiertos. Por eso emite y se desentiende: el
 * host se saltea el turno si hay algo a medio hacer (un movimiento en vuelo, una confirmacion
 * abierta) y el siguiente llega igual.
 */
@Component({
    selector: 'app-auto-refresh',
    templateUrl: './auto-refresh.component.html',
    styleUrls: ['./auto-refresh.component.scss']
})
export class AutoRefreshComponent implements OnInit, OnDestroy {

    /**
     * Clave de localStorage donde se recuerda la preferencia. Sin clave el control funciona igual
     * pero no recuerda nada: es lo que corresponde si el host no quiere persistir.
     */
    @Input() storageKey = '';

    /** Intervalos ofrecidos, en minutos. */
    @Input() options: number[] = [1, 5, 10, 30];

    /** Intervalo inicial, si no hay preferencia guardada. */
    @Input() defaultMinutes = 30;

    /** Vencio el intervalo. El host decide si recarga. */
    @Output() refresh = new EventEmitter<void>();

    enabled = false;
    minutes = 30;
    panelOpen = false;

    private timer?: ReturnType<typeof setInterval>;

    ngOnInit() {
        this.minutes = this.defaultMinutes;
        this.loadPreference();
        this.restart();
    }

    ngOnDestroy() {
        this.stop();
    }

    // ── Preferencia ──────────────────────────────────────────────────────────

    private loadPreference() {
        if (!this.storageKey) return;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const saved = JSON.parse(raw);
            this.enabled = saved?.enabled === true;
            // Un intervalo guardado que ya no este en la lista vuelve al de fabrica.
            if (this.options.includes(saved?.minutes)) {
                this.minutes = saved.minutes;
            }
        } catch {}
    }

    private savePreference() {
        if (!this.storageKey) return;
        try {
            localStorage.setItem(this.storageKey, JSON.stringify({
                enabled: this.enabled,
                minutes: this.minutes
            }));
        } catch {}
    }

    // ── Temporizador ─────────────────────────────────────────────────────────

    /** (Re)arranca el temporizador; cambiar el intervalo reinicia la cuenta. */
    private restart() {
        this.stop();
        if (!this.enabled) return;
        this.timer = setInterval(() => this.refresh.emit(), this.minutes * 60000);
    }

    private stop() {
        if (this.timer === undefined) return;
        clearInterval(this.timer);
        this.timer = undefined;
    }

    // ── Interaccion ──────────────────────────────────────────────────────────

    toggle(event?: Event) {
        event?.stopPropagation();
        this.enabled = !this.enabled;
        this.panelOpen = false;
        this.savePreference();
        this.restart();
    }

    togglePanel(event?: Event) {
        event?.stopPropagation();
        this.panelOpen = !this.panelOpen;
    }

    /** Elegir un intervalo enciende la recarga: es lo que se busca al tocarlo. */
    selectInterval(minutes: number) {
        this.minutes = minutes;
        this.enabled = true;
        this.panelOpen = false;
        this.savePreference();
        this.restart();
    }

    /**
     * Un click en cualquier otro lado cierra el desplegable. Los clicks propios no llegan aca: la
     * plantilla los frena en la capsula, que es ademas lo que evita que el host cierre SUS paneles
     * cuando se toca este control.
     */
    @HostListener('document:click')
    onDocumentClick() {
        if (this.panelOpen) this.panelOpen = false;
    }
}
