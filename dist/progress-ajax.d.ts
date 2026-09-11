/**
 * Generische, RxJS-Pipeline für AJAX-Requests mit Fortschritts-
 * anzeige bei Upload und Download.
 *
 * Aufbau:
 * 1. ajax() aus rxjs/ajax liefert bei aktivierten Optionen
 *    includeUploadProgress bzw. includeDownloadProgress neben
 *    der eigentlichen Response auch Fortschrittsereignisse wie
 *    upload_progress, upload_load, download_progress und
 *    download_load.
 * 2. toProgressEvents() transformiert diese Rohereignisse REIN
 *    und ohne I/O in ein einheitliches, einfach konsumierbares
 *    Format. Dadurch kann die Transformation unabhängig von
 *    echten XHR-Aufrufen, z. B. mit Marble-Tests, getestet werden.
 * 3. ajaxWithProgress() verbindet ajax() mit
 *    toProgressEvents(). Zusätzlich kann eine alternative
 *    "Ajax-Factory" injiziert werden. So lässt sich die komplette
 *    Pipeline ohne echten Netzwerkzugriff testen.
 */
import { Observable } from 'rxjs';
import { AjaxConfig } from 'rxjs/ajax';
export type ProgressDirection = 'upload' | 'download';
export interface AjaxProgressEvent {
    readonly type: 'progress';
    readonly direction: ProgressDirection;
    readonly loaded: number;
    readonly total: number;
    readonly percent: number;
}
export interface AjaxResultEvent<T> {
    readonly type: 'result';
    readonly status: number;
    readonly response: T;
}
export type AjaxProgressOrResult<T> = AjaxProgressEvent | AjaxResultEvent<T>;
/**
 * Reduzierter Ausschnitt der von rxjs/ajax erzeugten Rohereignisse,
 * der für das Mapping relevant ist. Dadurch bleibt toProgressEvents()
 * unabhängig vom konkreten AjaxResponse<T>-Typ und kann in den
 * Marble-Tests mit einfachen Objekten dieser Struktur getestet werden.
 */
export interface RawAjaxEvent<T> {
    type: string;
    loaded?: number;
    total?: number;
    status?: number;
    response?: T;
}
/** Beschreibt eine Funktion, die einen Stream unverarbeiteter Ajax-Ereignisse liefert. */
export type AjaxFactory<T> = (config: AjaxConfig) => Observable<RawAjaxEvent<T>>;
/**
 * Reiner und testbarer Operator:
 * transformiert die von rxjs/ajax gelieferten Rohereignisse in ein
 * einheitliches Format für Fortschritt und Ergebnis. Nicht relevante
 * oder unbekannte Ereignistypen, z. B. das interne open-Ereignis,
 * werden verworfen.
 */
export declare function toProgressEvents<T>(): (source: Observable<RawAjaxEvent<T>>) => Observable<AjaxProgressOrResult<T>>;
/**
 * Generische AJAX-Pipeline mit Unterstützung für Upload- und
 * Download-Fortschritt.
 */
export declare function ajaxWithProgress<T = unknown>(config: AjaxConfig, ajaxFactory?: AjaxFactory<T>): Observable<AjaxProgressOrResult<T>>;
export declare function selectPercent(direction: ProgressDirection): (source: Observable<AjaxProgressOrResult<unknown>>) => Observable<number>;
export declare function selectResult<T>(): (source: Observable<AjaxProgressOrResult<T>>) => Observable<T>;
