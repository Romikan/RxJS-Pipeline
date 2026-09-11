/**
 * Marble-Tests für die generische Upload-/Download-Fortschrittspipeline
 * aus progress-ajax.ts.
 *
 * Bewusste Design-Entscheidung: Der echte ajax()-Aufruf wird nicht
 * getestet, da dafür ein Browser, XHR und gegebenenfalls ein Server
 * erforderlich wären. Das wäre für synchrone Marble-Tests ungeeignet.
 *
 * Stattdessen werden zwei Ebenen getestet:
 *  a) toProgressEvents() wird direkt getestet. Der Operator enthält
 *     die fachliche Transformationslogik und wandelt Rohereignisse
 *     in Fortschritts- und Ergebnisereignisse um.
 *  b) ajaxWithProgress() wird End-to-End getestet. Über Dependency
 *     Injection wird eine synthetische Ajax-Factory in Form einer
 *     cold()-Marble-Quelle bereitgestellt.
 *
 * Test-Runner: Node.js' integriertes node:test ohne externes
 * Test-Framework, zusammen mit node:assert und dem RxJS
 * TestScheduler.
 *
 * Ausführen (nach npm install im Projektverzeichnis):
 * npm test
 */
export {};
