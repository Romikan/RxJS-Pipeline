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
import { filter, map, share } from 'rxjs/operators';
// ---------------------------------------------------------------------------
// XMLHttpRequest-Wrapper (impur – kapselt den einzigen Seiteneffekt)
// ---------------------------------------------------------------------------
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
export function xhrRequest(config) {
    return new Observable((subscriber) => {
        const xhr = new XMLHttpRequest();
        xhr.open(config.method ?? 'GET', config.url, true);
        if (config.responseType) {
            xhr.responseType = config.responseType;
        }
        if (config.withCredentials !== undefined) {
            xhr.withCredentials = config.withCredentials;
        }
        if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
                xhr.setRequestHeader(key, value);
            }
        }
        xhr.upload.onprogress = (event) => {
            subscriber.next({ type: 'upload_progress', loaded: event.loaded, total: event.total });
        };
        xhr.upload.onload = (event) => {
            subscriber.next({ type: 'upload_load', total: event.total });
        };
        xhr.onprogress = (event) => {
            subscriber.next({ type: 'download_progress', loaded: event.loaded, total: event.total });
        };
        xhr.onload = () => {
            subscriber.next({
                type: 'download_load',
                status: xhr.status,
                response: xhr.response,
            });
            subscriber.complete();
        };
        xhr.onerror = () => {
            subscriber.error(new Error(`Netzwerkfehler bei ${config.method ?? 'GET'} ${config.url}`));
        };
        xhr.ontimeout = () => {
            subscriber.error(new Error(`Timeout bei ${config.method ?? 'GET'} ${config.url}`));
        };
        xhr.onabort = () => {
            subscriber.error(new Error(`Request abgebrochen: ${config.method ?? 'GET'} ${config.url}`));
        };
        xhr.send(config.body ?? null);
        // Teardown-Funktion: läuft bei unsubscribe() bzw. sobald complete/error
        // gefeuert hat. XHR ist danach bereits DONE, ein erneutes abort() ist
        // dann ein No-op.
        return () => {
            if (xhr.readyState !== XMLHttpRequest.DONE) {
                xhr.abort();
            }
        };
    });
}
// ---------------------------------------------------------------------------
// Reine Hilfsfunktionen
// ---------------------------------------------------------------------------
function toPercent(loaded, total) {
    if (!total || total <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((loaded / total) * 100));
}
/**
 * Reiner, testbarer Operator:
 * wandelt die von `xhrRequest()` gelieferten Rohereignisse in ein
 * einheitliches Fortschritts-/Ergebnis-Format um. Unbekannte
 * Ereignistypen werden verworfen.
 */
export function toProgressEvents() {
    return (source) => source.pipe(map((event) => {
        switch (event.type) {
            case 'upload_progress':
                return {
                    type: 'progress',
                    direction: 'upload',
                    loaded: event.loaded ?? 0,
                    total: event.total ?? 0,
                    percent: toPercent(event.loaded ?? 0, event.total ?? 0),
                };
            case 'upload_load':
                // Upload technisch abgeschlossen -> garantiert 100 %.
                return {
                    type: 'progress',
                    direction: 'upload',
                    loaded: event.total ?? 0,
                    total: event.total ?? 0,
                    percent: 100,
                };
            case 'download_progress':
                return {
                    type: 'progress',
                    direction: 'download',
                    loaded: event.loaded ?? 0,
                    total: event.total ?? 0,
                    percent: toPercent(event.loaded ?? 0, event.total ?? 0),
                };
            case 'download_load':
                // Enthält die eigentliche Server-Antwort.
                return {
                    type: 'result',
                    status: event.status ?? 0,
                    response: event.response,
                };
            default:
                return null;
        }
    }), filter((event) => event !== null));
}
// ---------------------------------------------------------------------------
// Öffentliche Pipeline
// ---------------------------------------------------------------------------
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
export function ajaxWithProgress(config, requestFactory = xhrRequest) {
    return requestFactory(config).pipe(toProgressEvents(), 
    // share(): mehrere Abonnenten (z. B. UI-Fortschrittsbalken UND
    // Ergebnis-Handler) sollen sich einen einzigen Request teilen.
    share());
}
/** Hilfsoperator: nur die Prozentwerte EINER Richtung als Zahlen-Stream. */
export function selectPercent(direction) {
    return (source) => source.pipe(filter((event) => event.type === 'progress' && event.direction === direction), map((event) => event.percent));
}
/** Hilfsoperator: nur das finale Ergebnis (Response-Body). */
export function selectResult() {
    return (source) => source.pipe(filter((event) => event.type === 'result'), map((event) => event.response));
}
// ---------------------------------------------------------------------------
// Beispiel-Verwendung (nicht Teil der Bibliothek, nur zur Dokumentation)
// ---------------------------------------------------------------------------
/*
// Upload eines Files mit Fortschrittsanzeige:
const upload$ = ajaxWithProgress<{ id: number }>({
  url: '/api/upload',
  method: 'POST',
  body: formData,
});

upload$.pipe(selectPercent('upload')).subscribe((percent) => {
  progressBar.style.width = `${percent}%`;
});

upload$.pipe(selectResult()).subscribe((result) => {
  console.log('Hochgeladen, ID:', result.id);
});

// Download mit Fortschrittsanzeige:
const download$ = ajaxWithProgress<Blob>({
  url: '/api/files/report.pdf',
  method: 'GET',
  responseType: 'blob',
});

download$.pipe(selectPercent('download')).subscribe((percent) => {
  downloadProgressBar.style.width = `${percent}%`;
});
*/ 
