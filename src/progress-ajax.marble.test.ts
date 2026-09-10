/**
 * progress-ajax.marble.test.ts
 * ------------------------------------------------------------------
 * Marble-Tests für die generische Upload-/Download-Fortschritts-
 * Pipeline aus `progress-ajax.ts`.
 *
 * Bewusste Design-Entscheidung: Wir testen NICHT das echte `ajax()`
 * (das würde einen echten Browser/XHR bzw. Server voraussetzen und
 * ist damit für synchrone Marble-Tests ungeeignet). Stattdessen:
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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestScheduler } from 'rxjs/testing';
import {
  toProgressEvents,
  selectPercent,
  selectResult,
  ajaxWithProgress,
  RawAjaxEvent,
  AjaxProgressOrResult,
} from './progress-ajax.js';

function createScheduler(): TestScheduler {
  return new TestScheduler((actual, expected) => {
    assert.deepStrictEqual(actual, expected);
  });
}

describe('toProgressEvents()', () => {
  it('bildet Download-Fortschritt sowie das finale Ergebnis korrekt ab', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const source$ = cold<RawAjaxEvent<{ ok: boolean }>>('-a-b-c-d|', {
        a: { type: 'download_progress', loaded: 25, total: 100 },
        b: { type: 'download_progress', loaded: 50, total: 100 },
        c: { type: 'download_progress', loaded: 75, total: 100 },
        d: { type: 'download_load', status: 200, response: { ok: true } },
      });

      const expected = '-A-B-C-D|';
      const values = {
        A: { type: 'progress', direction: 'download', loaded: 25, total: 100, percent: 25 },
        B: { type: 'progress', direction: 'download', loaded: 50, total: 100, percent: 50 },
        C: { type: 'progress', direction: 'download', loaded: 75, total: 100, percent: 75 },
        D: { type: 'result', status: 200, response: { ok: true } },
      };

      expectObservable(source$.pipe(toProgressEvents())).toBe(expected, values);
    });
  });

  it('bildet Upload-Fortschritt inklusive Abschlussereignis (upload_load) auf 100 % ab', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const source$ = cold<RawAjaxEvent<unknown>>('-a-b-c|', {
        a: { type: 'upload_progress', loaded: 30, total: 120 },
        b: { type: 'upload_progress', loaded: 90, total: 120 },
        c: { type: 'upload_load', total: 120 },
      });

      const expected = '-A-B-C|';
      const values = {
        A: { type: 'progress', direction: 'upload', loaded: 30, total: 120, percent: 25 },
        B: { type: 'progress', direction: 'upload', loaded: 90, total: 120, percent: 75 },
        C: { type: 'progress', direction: 'upload', loaded: 120, total: 120, percent: 100 },
      };

      expectObservable(source$.pipe(toProgressEvents())).toBe(expected, values);
    });
  });

  it('rundet korrekt und liefert 0 %, falls "total" unbekannt (0) ist', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const source$ = cold<RawAjaxEvent<unknown>>('-a|', {
        a: { type: 'download_progress', loaded: 42, total: 0 },
      });

      const expected = '-A|';
      const values = {
        A: { type: 'progress', direction: 'download', loaded: 42, total: 0, percent: 0 },
      };

      expectObservable(source$.pipe(toProgressEvents())).toBe(expected, values);
    });
  });

  it('ignoriert unbekannte/interne Ereignistypen (z. B. "open")', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const source$ = cold<RawAjaxEvent<unknown>>('-a-b|', {
        a: { type: 'open' },
        b: { type: 'download_load', status: 204, response: null },
      });

      const expected = '---B|';
      const values = {
        B: { type: 'result', status: 204, response: null },
      };

      expectObservable(source$.pipe(toProgressEvents())).toBe(expected, values);
    });
  });
});

describe('selectPercent()', () => {
  it('liefert ausschließlich die Prozentwerte der angegebenen Richtung', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const sourceValues: Record<string, AjaxProgressOrResult<unknown>> = {
        a: { type: 'progress', direction: 'download', loaded: 25, total: 100, percent: 25 },
        b: { type: 'progress', direction: 'download', loaded: 50, total: 100, percent: 50 },
        c: { type: 'progress', direction: 'upload', loaded: 10, total: 100, percent: 10 },
        d: { type: 'result', status: 200, response: {} },
      };
      const source$ = cold('-a-b-c-d|', sourceValues);

      const expected = '-x-y----|';
      const expectedValues = { x: 25, y: 50 };

      expectObservable(source$.pipe(selectPercent('download'))).toBe(expected, expectedValues);
    });
  });
});

describe('selectResult()', () => {
  it('liefert ausschließlich das finale Ergebnis und blendet Fortschritt aus', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const sourceValues: Record<string, AjaxProgressOrResult<{ ok: boolean }>> = {
        a: { type: 'progress', direction: 'download', loaded: 50, total: 100, percent: 50 },
        b: { type: 'result', status: 200, response: { ok: true } },
      };
      const source$ = cold('-a-b|', sourceValues);

      const expected = '---b|';
      const expectedValues = { b: { ok: true } };

      expectObservable(source$.pipe(selectResult())).toBe(expected, expectedValues);
    });
  });
});

describe('ajaxWithProgress() – End-to-End mit injizierter Ajax-Factory', () => {
  it('kombiniert Upload-Fortschritt und finales Ergebnis zu einem Stream', () => {
    createScheduler().run(({ cold, expectObservable }) => {
      const fakeAjax = () =>
        cold<RawAjaxEvent<{ id: number }>>('-a-b-c|', {
          a: { type: 'upload_progress', loaded: 50, total: 200 },
          b: { type: 'upload_load', total: 200 },
          c: { type: 'download_load', status: 201, response: { id: 42 } },
        });

      const expected = '-A-B-C|';
      const values = {
        A: { type: 'progress', direction: 'upload', loaded: 50, total: 200, percent: 25 },
        B: { type: 'progress', direction: 'upload', loaded: 200, total: 200, percent: 100 },
        C: { type: 'result', status: 201, response: { id: 42 } },
      };

      expectObservable(
        ajaxWithProgress<{ id: number }>({ url: '/upload', method: 'POST' }, fakeAjax)
      ).toBe(expected, values);
    });
  });

  it('reicht die übergebene Konfiguration inkl. Progress-Flags an die Factory weiter', () => {
    let receivedConfig: unknown;

    createScheduler().run(({ cold, expectObservable }) => {
      const fakeAjax = (config: unknown) => {
        receivedConfig = config;
        return cold<RawAjaxEvent<unknown>>('-a|', {
          a: { type: 'download_load', status: 200, response: 'ok' },
        });
      };

      const expected = '-A|';
      const values = { A: { type: 'result', status: 200, response: 'ok' } };

      expectObservable(
        ajaxWithProgress({ url: '/download', method: 'GET' }, fakeAjax as never)
      ).toBe(expected, values);
    });

    // run() flusht den TestScheduler synchron, bevor es zurückkehrt –
    // an dieser Stelle wurde die Factory also bereits aufgerufen.
    assert.deepEqual(receivedConfig, {
      url: '/download',
      method: 'GET',
      includeUploadProgress: true,
      includeDownloadProgress: true,
    });
  });
});