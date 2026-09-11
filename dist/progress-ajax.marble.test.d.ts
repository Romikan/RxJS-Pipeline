/**
 * progress-ajax.marble.test.ts
 * ------------------------------------------------------------------
 * Marble-Tests für die generische Upload-/Download-Fortschritts-
 * Pipeline aus `progress-ajax.ts`.
 *
 * Bewusste Design-Entscheidung: Wir testen NICHT das echte
 * `XMLHttpRequest` (das würde einen echten Browser/Server voraussetzen
 * und ist damit für synchrone Marble-Tests ungeeignet). Stattdessen:
 *
 *  a) Wir testen `toProgressEvents()` direkt – das ist die komplette
 *     fachliche Logik (Mapping Rohereignis -> Fortschritt/Ergebnis)
 *     und eine reine Funktion.
 *  b) Wir testen `ajaxWithProgress()` End-to-End, indem wir per
 *     Dependency Injection eine synthetische "Ajax-Factory"
 *     (eine `cold()`-Marble-Quelle) einspeisen.
 *
 * Test-Runner: der in Node.js eingebaute `node:test` (kein externes
 * Test-Framework nötig) zusammen mit `node:assert` und RxJS'
 * eigenem `TestScheduler`.
 *
 * Ausführen (nach `npm install` im Projektordner):
 *   npm test
 */
export {};
