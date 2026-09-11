/**
 * progress-ajax.ts
 * ------------------------------------------------------------------
 * Generische, framework-freie RxJS-Pipeline für AJAX-Requests
 * (Upload UND Download) mit prozentualem Fortschritt.
 *
 * Diese Version verwendet bewusst KEIN `rxjs/ajax`, sondern einen
 * selbst geschriebenen, dünnen Wrapper (`xhrRequest`) um die native
 * `XMLHttpRequest`-API. Das ist die Web-Technologie, die im Browser
 * für Upload-/Download-Fortschritt zuständig ist (`xhr.upload.onprogress`
 * und `xhr.onprogress`); `fetch()` bietet dafür bislang keine
 * gleichwertige, breit unterstützte Fortschritts-API.
 *
 * Architektur (bewusst in zwei Schichten getrennt):
 *
 * 1. `xhrRequest()` – IMPURE. Erzeugt ein `XMLHttpRequest`, verdrahtet
 *    dessen Events und gibt sie als Observable von rohen Ereignissen
 *    (`RawAjaxEvent<T>`) aus. Bei `unsubscribe()` wird der Request via
 *    `xhr.abort()` sauber abgebrochen.
 * 2. `toProgressEvents()` – REIN (kein I/O). Wandelt die rohen
 *    Ereignisse in ein einheitliches, leicht konsumierbares Format
 *    um. Weil sie rein ist, lässt sie sich mit Marble-Tests prüfen,
 *    unabhängig von echtem XHR/Netzwerk.
 * 3. `ajaxWithProgress()` verdrahtet `xhrRequest()` mit
 *    `toProgressEvents()` und erlaubt zusätzlich das Injizieren einer
 *    alternativen "Request-Factory" (Dependency Injection), damit auch
 *    die komplette Pipeline ohne echten Netzwerkzugriff testbar ist.
 */
import { Observable } from 'rxjs';
export type ProgressDirection = 'upload' | 'download';
/** Ein einzelnes Fortschritts-Ereignis (Upload ODER Download). */
export interface AjaxProgressEvent {
    readonly type: 'progress';
    readonly direction: ProgressDirection;
    readonly loaded: number;
    readonly total: number;
    /** Ganzzahliger Prozentwert 0–100 (0, falls `total` unbekannt ist). */
    readonly percent: number;
}
/** Das finale Ergebnis des Requests. */
export interface AjaxResultEvent<T> {
    readonly type: 'result';
    readonly status: number;
    readonly response: T;
}
export type AjaxProgressOrResult<T> = AjaxProgressEvent | AjaxResultEvent<T>;
/**
 * Minimaler Ausschnitt der von `xhrRequest()` gelieferten Rohereignisse,
 * den wir für das Mapping benötigen. Damit ist `toProgressEvents()`
 * unabhängig von einer konkreten Quelle testbar (siehe Marble-Tests:
 * dort werden einfache Objekte dieser Form verwendet).
 */
export interface RawAjaxEvent<T> {
    type: string;
    loaded?: number;
    total?: number;
    status?: number;
    response?: T;
}
/** Konfiguration für einen Request – bewusst schlank gehalten. */
export interface XhrRequestConfig {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: XMLHttpRequestBodyInit | Document | null;
    responseType?: XMLHttpRequestResponseType;
    withCredentials?: boolean;
}
/** Signatur einer Funktion, die einen "rohen" Ereignis-Stream liefert. */
export type RequestFactory<T> = (config: XhrRequestConfig) => Observable<RawAjaxEvent<T>>;
/**
 * Führt einen Request über `new XMLHttpRequest()` aus und meldet dabei
 * Upload- UND Download-Fortschritt als Observable-Ereignisse.
 *
 * Ereignistypen (angelehnt an die native XHR-Terminologie):
 *  - 'upload_progress'   -> xhr.upload.onprogress
 *  - 'upload_load'       -> xhr.upload.onload (Upload technisch fertig)
 *  - 'download_progress' -> xhr.onprogress
 *  - 'download_load'     -> xhr.onload (enthält die Server-Antwort)
 *
 * Bricht den Request automatisch ab, wenn das Observable "unsubscribed"
 * wird (z. B. weil der Nutzer die Ansicht verlässt).
 */
export declare function xhrRequest<T = unknown>(config: XhrRequestConfig): Observable<RawAjaxEvent<T>>;
/**
 * Reiner, testbarer Operator:
 * wandelt die von `xhrRequest()` gelieferten Rohereignisse in ein
 * einheitliches Fortschritts-/Ergebnis-Format um. Unbekannte
 * Ereignistypen werden verworfen.
 */
export declare function toProgressEvents<T>(): (source: Observable<RawAjaxEvent<T>>) => Observable<AjaxProgressOrResult<T>>;
/**
 * Generische AJAX-Pipeline mit Upload- UND Download-Fortschritt.
 * Funktioniert unverändert für:
 *  - Uploads (z. B. POST/PUT mit FormData/Blob als `body`)
 *  - Downloads (z. B. GET einer großen Datei)
 * Die Richtung ergibt sich implizit daraus, welche Ereignistypen
 * der Browser tatsächlich feuert.
 *
 * `requestFactory` ist standardmäßig `xhrRequest` (echtes XHR), kann
 * aber (z. B. in Tests) durch eine synthetische Quelle ersetzt werden.
 */
export declare function ajaxWithProgress<T = unknown>(config: XhrRequestConfig, requestFactory?: RequestFactory<T>): Observable<AjaxProgressOrResult<T>>;
/** Hilfsoperator: nur die Prozentwerte EINER Richtung als Zahlen-Stream. */
export declare function selectPercent(direction: ProgressDirection): (source: Observable<AjaxProgressOrResult<unknown>>) => Observable<number>;
/** Hilfsoperator: nur das finale Ergebnis (Response-Body). */
export declare function selectResult<T>(): (source: Observable<AjaxProgressOrResult<T>>) => Observable<T>;
