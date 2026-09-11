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
import { filter, map, share } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
function toPercent(loaded, total) {
    if (!total || total <= 0) {
        return 0;
    }
    return Math.min(100, Math.round((loaded / total) * 100));
}
/**
 * Reiner und testbarer Operator:
 * transformiert die von rxjs/ajax gelieferten Rohereignisse in ein
 * einheitliches Format für Fortschritt und Ergebnis. Nicht relevante
 * oder unbekannte Ereignistypen, z. B. das interne open-Ereignis,
 * werden verworfen.
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
                // Upload technisch abgeschlossen – Fortschritt wird auf 100 % gesetzt.
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
                // Enthält die vom Server zurückgelieferte Antwort.
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
/**
 * Generische AJAX-Pipeline mit Unterstützung für Upload- und
 * Download-Fortschritt.
 */
export function ajaxWithProgress(config, ajaxFactory = (c) => ajax(c)) {
    return ajaxFactory({
        ...config,
        includeUploadProgress: true,
        includeDownloadProgress: true,
    }).pipe(toProgressEvents(), 
    // `share()` stellt sicher, dass mehrere Abonnenten (z. B. UI-Fortschrittsbalken
    // und Ergebnis-Handler) denselben Request gemeinsam nutzen.
    share());
}
// Extrahiert die Prozentwerte einer Richtung als Zahlen-Stream.
export function selectPercent(direction) {
    return (source) => source.pipe(filter((event) => event.type === 'progress' && event.direction === direction), map((event) => event.percent));
}
// Extrahiert ausschließlich das finale Ergebnis, also den Response-Body.
export function selectResult() {
    return (source) => source.pipe(filter((event) => event.type === 'result'), map((event) => event.response));
}
