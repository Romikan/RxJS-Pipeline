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
import { filter, map, share } from 'rxjs/operators';
import { ajax } from 'rxjs/ajax';
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
 * wandelt die von rxjs/ajax gelieferten Rohereignisse in ein
 * einheitliches Fortschritts-/Ergebnis-Format um. Unbekannte
 * Ereignistypen (z. B. das interne 'open'-Ereignis) werden verworfen.
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
 * `ajaxFactory` ist standardmäßig das echte `ajax()` aus `rxjs/ajax`,
 * kann aber (z. B. in Tests) durch eine synthetische Quelle ersetzt
 * werden.
 */
export function ajaxWithProgress(config, ajaxFactory = (c) => ajax(c)) {
    return ajaxFactory({
        ...config,
        includeUploadProgress: true,
        includeDownloadProgress: true,
    }).pipe(toProgressEvents(), 
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
