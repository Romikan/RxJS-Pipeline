# RxJS AJAX-Fortschritts-Pipeline (Upload & Download)

Eine generische, framework-freie RxJS-Pipeline, die AJAX-Uploads **und**
-Downloads mit einheitlichem, prozentualem Fortschritt kapselt.

## Architektur

```
src/progress-ajax.ts
├── toProgressEvents()   – reine Transformation: Rohereignis -> {progress|result}
├── ajaxWithProgress()   – verdrahtet rxjs/ajax() mit toProgressEvents()
├── selectPercent(dir)   – Hilfsoperator: nur Prozentwerte einer Richtung
└── selectResult()       – Hilfsoperator: nur die finale Server-Antwort
```

`rxjs/ajax` liefert bei aktiviertem `includeUploadProgress` /
`includeDownloadProgress` zusätzlich zur eigentlichen Antwort
Zwischenereignisse vom Typ `upload_progress`, `upload_load`,
`download_progress` und `download_load`. `toProgressEvents()` bildet diese
auf ein einheitliches Modell ab:

```ts
type AjaxProgressOrResult<T> =
  | { type: 'progress'; direction: 'upload' | 'download'; loaded: number; total: number; percent: number }
  | { type: 'result'; status: number; response: T };
```

Der Prozentwert wird als `Math.round(loaded / total * 100)` berechnet
(0, falls `total` unbekannt ist, z. B. bei `chunked` Transfer-Encoding ohne
`Content-Length`).

### Verwendung

```ts
import { ajaxWithProgress, selectPercent, selectResult } from './progress-ajax';

// Upload
const upload$ = ajaxWithProgress<{ id: number }>({
  url: '/api/upload',
  method: 'POST',
  body: formData, // z. B. aus <input type="file">
});

upload$.pipe(selectPercent('upload')).subscribe((percent) => {
  progressBar.style.width = `${percent}%`;
});

upload$.pipe(selectResult()).subscribe((result) => {
  console.log('Hochgeladen, ID:', result.id);
});

// Download
const download$ = ajaxWithProgress<Blob>({
  url: '/api/files/report.pdf',
  responseType: 'blob',
});

download$.pipe(selectPercent('download')).subscribe((percent) => { /* ... */ });
download$.pipe(selectResult()).subscribe((blob) => { /* ... */ });
```

Da `ajaxWithProgress()` intern `share()` nutzt, teilen sich mehrere
Subscriber (Fortschrittsanzeige + Ergebnis-Handler) denselben Request,
statt ihn zu duplizieren.

## Warum ist das testbar, obwohl AJAX beteiligt ist?

Echte HTTP-/XHR-Aufrufe sind für synchrone Marble-Tests ungeeignet.
Deshalb ist die **gesamte fachliche Logik** (das Mapping der Rohereignisse)
in die reine Funktion `toProgressEvents()` ausgelagert. Zusätzlich
akzeptiert `ajaxWithProgress()` optional eine injizierbare `ajaxFactory`
(Dependency Injection), sodass auch die komplette Pipeline ohne echten
Netzwerkzugriff per Marble-Test geprüft werden kann – im Test wird dort
einfach eine `cold()`-Quelle statt des echten `ajax()` übergeben.

## Tests ausführen

Voraussetzung: Node.js ≥ 18 (bringt den eingebauten Test-Runner
`node:test` mit – es wird also kein zusätzliches Test-Framework wie
Jest/Mocha/Jasmine benötigt).

```bash
npm install
npm test
```

`npm test` kompiliert TypeScript nach `dist/` und führt anschließend alle
`*.marble.test.js`-Dateien mit `node --test` aus. Assertions laufen über
`node:assert`, RxJS' `TestScheduler` übernimmt Marble-Parsing und
virtuelle Zeit.

## Browser-Demo (Vanilla JS, kein Framework)

`demo/index.html` + `demo/app.js` zeigen die Pipeline live im Browser:
ein Datei-Input mit Upload-Fortschrittsbalken und ein URL-Feld mit
Download-Fortschrittsbalken – ausschließlich mit HTML, CSS und
DOM-APIs (kein Angular/React/Vue/jQuery). RxJS wird dort per ESM direkt
von einem CDN geladen, damit kein Build-Schritt nötig ist. Für den
produktiven Einsatz `/api/upload` bzw. die Download-URL an einen echten
Endpunkt anpassen.