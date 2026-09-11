/*
* Framework-freie Browser-Demo: bindet die generische Fortschrittspipeline
* über native DOM-APIs (input, button, div) ein. Es wird kein
* Framework wie Angular, React oder Vue benötigt.
*
* Die Demo läuft direkt als ES-Modul im Browser und lädt RxJS über ein CDN.
* Dadurch ist kein Build-Schritt erforderlich.
*
* Die fachliche Transformationslogik entspricht der von
* src/progress-ajax.ts. toProgressEvents() wird dafür als reines
* JavaScript direkt für den Browserbetrieb bereitgestellt.
*/

import { ajax } from 'https://esm.sh/rxjs@7.8.1/ajax';
import { filter, map, share } from 'https://esm.sh/rxjs@7.8.1/operators';

function toPercent(loaded, total) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((loaded / total) * 100));
}

function toProgressEvents() {
  return (source) =>
    source.pipe(
      map((event) => {
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
            return { type: 'result', status: event.status ?? 0, response: event.response };
          default:
            return null;
        }
      }),
      filter((event) => event !== null)
    );
}

function ajaxWithProgress(config) {
  return ajax({
    ...config,
    includeUploadProgress: true,
    includeDownloadProgress: true,
  }).pipe(toProgressEvents(), share());
}

function selectPercent(direction) {
  return (source) =>
    source.pipe(
      filter((e) => e.type === 'progress' && e.direction === direction),
      map((e) => e.percent)
    );
}

function selectResult() {
  return (source) =>
    source.pipe(
      filter((e) => e.type === 'result'),
      map((e) => e.response)
    );
}

// Upload

const uploadInput = document.getElementById('upload-input');
const uploadButton = document.getElementById('upload-button');
const uploadFill = document.getElementById('upload-fill');
const uploadStatus = document.getElementById('upload-status');

uploadButton.addEventListener('click', () => {
  const file = uploadInput.files?.[0];
  if (!file) {
    uploadStatus.textContent = 'Bitte zuerst eine Datei auswählen.';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  uploadFill.style.width = '0%';
  uploadStatus.textContent = 'Upload läuft …';

  const upload$ = ajaxWithProgress({
    url: '/api/upload', // an echten Endpunkt anpassen
    method: 'POST',
    body: formData,
  });

  upload$.pipe(selectPercent('upload')).subscribe({
    next: (percent) => {
      uploadFill.style.width = `${percent}%`;
      uploadStatus.textContent = `Upload: ${percent}%`;
    },
  });

  upload$.pipe(selectResult()).subscribe({
    next: () => {
      uploadStatus.textContent = 'Upload abgeschlossen.';
    },
    error: (err) => {
      uploadStatus.textContent = `Fehler beim Upload: ${err.message ?? err}`;
    },
  });
});

// Download

const downloadUrlInput = document.getElementById('download-url');
const downloadButton = document.getElementById('download-button');
const downloadFill = document.getElementById('download-fill');
const downloadStatus = document.getElementById('download-status');

downloadButton.addEventListener('click', () => {
  const url = downloadUrlInput.value.trim();
  if (!url) {
    downloadStatus.textContent = 'Bitte zuerst eine URL angeben.';
    return;
  }

  downloadFill.style.width = '0%';
  downloadStatus.textContent = 'Download läuft …';

  const download$ = ajaxWithProgress({
    url,
    method: 'GET',
    responseType: 'blob',
  });

  download$.pipe(selectPercent('download')).subscribe({
    next: (percent) => {
      downloadFill.style.width = `${percent}%`;
      downloadStatus.textContent = `Download: ${percent}%`;
    },
  });

  download$.pipe(selectResult()).subscribe({
    next: (blob) => {
      downloadStatus.textContent = 'Download abgeschlossen.';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = url.split('/').pop() || 'download';
      link.click();
      URL.revokeObjectURL(objectUrl);
    },
    error: (err) => {
      downloadStatus.textContent = `Fehler beim Download: ${err.message ?? err}`;
    },
  });
});