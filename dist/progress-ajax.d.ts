/**
 * progress-ajax.ts
 * ------------------------------------------------------------------
 * Generische, framework-freie RxJS-Pipeline für AJAX-Requests
 * (Upload UND Download) mit prozentualem Fortschritt.
 *
 * Design-Idee:
 * 1. `ajax()` aus `rxjs/ajax` liefert bei aktiviertem
 *    `includeUploadProgress` / `includeDownloadProgress` zusätzlich
 *    zu der eigentlichen Antwort auch Zwischenereignisse vom Typ
 *    'upload_progress', 'upload_load', 'download_progress' und
 *    'download_load'.
 * 2. `toProgressEvents()` ist eine REINE Transformation (kein I/O),
 *    die diese Rohereignisse in ein einheitliches, leicht
 *    konsumierbares Format überführt. Weil sie rein ist, lässt sie
 *    sich hervorragend mit Marble-Tests prüfen – unabhängig von
 *    echten XHR-Aufrufen.
 * 3. `ajaxWithProgress()` verdrahtet `ajax()` mit `toProgressEvents()`
 *    und erlaubt zusätzlich das Injizieren einer alternativen
 *    "Ajax-Factory" (Dependency Injection), damit auch die komplette
 *    Pipeline ohne echten Netzwerkzugriff testbar ist.
 */
import { Observable } from 'rxjs';
import { AjaxConfig } from 'rxjs/ajax';
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
 * Minimaler Ausschnitt der von `rxjs/ajax` gelieferten Rohereignisse,
 * den wir für das Mapping benötigen. Damit ist `toProgressEvents()`
 * unabhängig vom konkreten `AjaxResponse<T>`-Typ testbar (siehe
 * Marble-Tests: dort werden einfache Objekte dieser Form verwendet).
 */
export interface RawAjaxEvent<T> {
    type: string;
    loaded?: number;
    total?: number;
    status?: number;
    response?: T;
}
/** Signatur einer Funktion, die einen "rohen" Ajax-Event-Stream liefert. */
export type AjaxFactory<T> = (config: AjaxConfig) => Observable<RawAjaxEvent<T>>;
/**
 * Reiner, testbarer Operator:
 * wandelt die von rxjs/ajax gelieferten Rohereignisse in ein
 * einheitliches Fortschritts-/Ergebnis-Format um. Unbekannte
 * Ereignistypen (z. B. das interne 'open'-Ereignis) werden verworfen.
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
 * `ajaxFactory` ist standardmäßig das echte `ajax()` aus `rxjs/ajax`,
 * kann aber (z. B. in Tests) durch eine synthetische Quelle ersetzt
 * werden.
 */
export declare function ajaxWithProgress<T = unknown>(config: AjaxConfig, ajaxFactory?: AjaxFactory<T>): Observable<AjaxProgressOrResult<T>>;
/** Hilfsoperator: nur die Prozentwerte EINER Richtung als Zahlen-Stream. */
export declare function selectPercent(direction: ProgressDirection): (source: Observable<AjaxProgressOrResult<unknown>>) => Observable<number>;
/** Hilfsoperator: nur das finale Ergebnis (Response-Body). */
export declare function selectResult<T>(): (source: Observable<AjaxProgressOrResult<T>>) => Observable<T>;
