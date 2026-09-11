# RxJS AJAX-Fortschritts-Pipeline für Upload und Download

Eine generische, framework-freie RxJS-Pipeline für AJAX-Requests mit einheitlicher, prozentualer Fortschrittsanzeige bei **Uploads und Downloads**.

## Architektur

Die Pipeline besteht aus einer reinen Transformationslogik und einer Anbindung an `rxjs/ajax`:

```text
src/progress-ajax.ts

├── toProgressEvents()  – transformiert Rohereignisse in { progress | result }
├── ajaxWithProgress()  – verbindet rxjs/ajax mit toProgressEvents()
├── selectPercent(dir)  – extrahiert die Prozentwerte einer Richtung
└── selectResult()      – extrahiert die finale Server-Antwort
```

Bei aktivierten Optionen `includeUploadProgress` bzw. `includeDownloadProgress` liefert `rxjs/ajax` neben der eigentlichen Antwort zusätzliche Zwischenereignisse, unter anderem:

* `upload_progress`
* `upload_load`
* `download_progress`
* `download_load`

`toProgressEvents()` transformiert diese Rohereignisse in ein einheitliches Modell:

```ts
type AjaxProgressOrResult<T> =
  | {
      type: 'progress';
      direction: 'upload' | 'download';
      loaded: number;
      total: number;
      percent: number;
    }
  | {
      type: 'result';
      status: number;
      response: T;
    };
```

Der Fortschritt wird anhand der geladenen und übertragenen Daten berechnet:

```ts
Math.round(loaded / total * 100)
```

Ist die Gesamtgröße (`total`) nicht bekannt, wird `0` als Prozentwert verwendet. Das kann beispielsweise bei `chunked` Transfer-Encoding ohne `Content-Length` der Fall sein.

## Verwendung

### Upload

```ts
import {
  ajaxWithProgress,
  selectPercent,
  selectResult,
} from './progress-ajax';

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
```

### Download

```ts
const download$ = ajaxWithProgress<Blob>({
  url: '/api/files/report.pdf',
  responseType: 'blob',
});

download$.pipe(selectPercent('download')).subscribe((percent) => {
  // Fortschrittsanzeige aktualisieren
});

download$.pipe(selectResult()).subscribe((blob) => {
  // Download verarbeiten
});
```

### Gemeinsame Nutzung des Requests

`ajaxWithProgress()` verwendet intern `share()`. Dadurch können mehrere Subscriber denselben Request gemeinsam nutzen, beispielsweise ein Subscriber für die Fortschrittsanzeige und ein weiterer für das finale Ergebnis.

Der HTTP-Request wird dabei nicht für jeden Subscriber erneut ausgeführt.

## Testbarkeit

### Warum ist die Pipeline trotz AJAX testbar?

Echte HTTP-/XHR-Aufrufe eignen sich nicht für synchrone Marble-Tests, da dafür eine Browserumgebung und ein tatsächlicher Netzwerkaufruf erforderlich wären.

Deshalb ist die fachliche Transformationslogik in `toProgressEvents()` als reine Funktion umgesetzt. Sie kann unabhängig von echten HTTP-Aufrufen direkt getestet werden.

Zusätzlich unterstützt `ajaxWithProgress()` eine injizierbare `ajaxFactory`. Dadurch kann für Tests eine synthetische RxJS-Quelle verwendet werden, anstatt tatsächlich `ajax()` aufzurufen.

Im Marble-Test wird beispielsweise eine `cold()`-Quelle als Ersatz für die echte Ajax-Factory verwendet.

Damit können sowohl

* die reine Mapping-Logik von `toProgressEvents()`
* als auch die vollständige Pipeline von `ajaxWithProgress()`

ohne Netzwerkzugriff getestet werden.

## Tests ausführen

Voraussetzung ist **Node.js ≥ 18**. Der Test-Runner `node:test` ist Bestandteil von Node.js, sodass kein zusätzliches Test-Framework wie Jest, Mocha oder Jasmine erforderlich ist.

```bash
npm install
npm test
```

`npm test` kompiliert zunächst das TypeScript-Projekt nach `dist/` und führt anschließend die generierten `*.marble.test.js`-Dateien mit `node --test` aus.

Für die Assertions wird `node:assert` verwendet. Der RxJS `TestScheduler` übernimmt das Marble-Parsing und die Ausführung mit virtueller Zeit.

## Browser-Demo

Unter `demo/index.html` und `demo/app.js` befindet sich eine framework-freie Browser-Demo der Pipeline.

Die Demo zeigt:

* einen Datei-Upload mit Fortschrittsanzeige
* einen Datei-Download mit Fortschrittsanzeige

Die Oberfläche verwendet ausschließlich HTML, CSS und native DOM-APIs. Frameworks wie Angular, React, Vue oder jQuery werden nicht benötigt.

RxJS wird als ES-Modul direkt über ein CDN geladen. Dadurch kann die Demo ohne vorherigen Build-Schritt direkt im Browser ausgeführt werden.

Für den produktiven Einsatz müssen die verwendeten Endpunkte, insbesondere `/api/upload` und die Download-URL, an die jeweilige Anwendung angepasst werden.
