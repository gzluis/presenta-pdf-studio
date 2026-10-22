'use strict';

const $ = selector => document.querySelector(selector);
const state = { mode: 'auto', jobTimer: null, sessionId: null, busy: false };

function showStatus(title, message, kind = 'info', count = '') {
  $('#status').classList.remove('hidden');
  $('#status').classList.toggle('error', kind === 'error');
  $('#status-title').textContent = title;
  $('#status-message').textContent = message;
  $('#status-symbol').textContent = kind === 'error' ? '!' : kind === 'success' ? '✓' : '◌';
  $('#status-count').textContent = count;
}
function showDownload(url, total) {
  $('#download-box').classList.remove('hidden');
  $('#download-details').textContent = `${total} página(s) · proporción original`;
  $('#download-link').href = url;
}
function options() {
  return {
    url: $('#url').value.trim(),
    delayMs: Number($('#delay').value),
    quality: Number($('#quality').value),
    maxSlides: Number($('#maxslides').value)
  };
}
async function request(url, method = 'GET', payload) {
  const res = await fetch(url, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  let data;
  try { data = await res.json(); } catch { throw new Error('Respuesta inesperada del servidor.'); }
  if (!res.ok) throw new Error(data.error || `Error HTTP ${res.status}`);
  return data;
}
function setBusy(busy) {
  state.busy = busy;
  $('#start-auto').disabled = busy;
  $('#start-manual').disabled = busy;
}
function selectMode(mode) {
  if (state.busy) return;
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach(el => {
    const active = el.dataset.mode === mode;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });
  $('#auto-panel').hidden = mode !== 'auto';
  $('#manual-panel').hidden = mode !== 'manual';
  $('#maxslides-container').hidden = mode !== 'auto';
}

async function startAutomatic() {
  setBusy(true);
  $('#download-box').classList.add('hidden');
  showStatus('Abriendo presentación', 'Se iniciará un navegador automatizado para capturar las diapositivas.');
  try {
    const { jobId } = await request('/api/convert', 'POST', options());
    if (state.jobTimer) clearInterval(state.jobTimer);
    const poll = async () => {
      try {
        const job = await request(`/api/jobs/${jobId}`);
        showStatus(job.status === 'completo' ? 'Conversión terminada' : 'Capturando...', job.message,
          job.status === 'error' ? 'error' : job.status === 'completo' ? 'success' : 'info', job.total || '');
        if (job.status !== 'trabajando') {
          clearInterval(state.jobTimer);
          state.jobTimer = null;
          setBusy(false);
          if (job.downloadUrl) showDownload(job.downloadUrl, job.total);
        }
      } catch (error) {
        clearInterval(state.jobTimer);
        state.jobTimer = null;
        setBusy(false);
        showStatus('No se pudo consultar la conversión', error.message, 'error');
      }
    };
    state.jobTimer = setInterval(poll, 1150);
    await poll();
  } catch (error) {
    setBusy(false);
    showStatus('Conversión no iniciada', error.message, 'error');
  }
}

async function closeSession(silent = false) {
  if (!state.sessionId) return;
  const previousId = state.sessionId;
  state.sessionId = null;
  $('#manual-workspace').classList.add('hidden');
  try { await request(`/api/manual/${previousId}`, 'DELETE'); }
  catch (error) { if (!silent) showStatus('No se pudo cerrar la sesión', error.message, 'error'); }
}

async function startManual() {
  await closeSession(true);
  setBusy(true);
  $('#download-box').classList.add('hidden');
  showStatus('Iniciando visor asistido', 'Cargando la presentación y preparando la vista previa.');
  try {
    const session = await request('/api/manual/start', 'POST', options());
    state.sessionId = session.id;
    $('#manual-preview').src = session.preview;
    $('#captured-total').textContent = 0;
    $('#manual-workspace').classList.remove('hidden');
    showStatus('Visor preparado', 'Captura la portada y utiliza las flechas o los clics en la imagen.', 'success');
    $('#manual-workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    showStatus('No se pudo abrir el visor', error.message, 'error');
  } finally { setBusy(false); }
}

async function manualAction(action, args = {}) {
  if (!state.sessionId || state.busy) return;
  setBusy(true);
  $('#preview-overlay').classList.remove('hidden');
  const controls = $('#manual-workspace').querySelectorAll('button');
  controls.forEach(el => el.disabled = true);
  try {
    const data = await request(`/api/manual/${state.sessionId}/action`, 'POST', { action, ...args });
    $('#manual-preview').src = data.preview;
    $('#captured-total').textContent = data.total;
    if (action === 'capture') showStatus('Captura añadida', `Has guardado ${data.total} pantalla(s) para el PDF.`, 'success', data.total);
  } catch (error) {
    showStatus('Error durante la navegación', error.message, 'error');
  } finally {
    controls.forEach(el => el.disabled = false);
    $('#preview-overlay').classList.add('hidden');
    setBusy(false);
  }
}

async function exportManual() {
  if (!state.sessionId || state.busy) return;
  setBusy(true);
  showStatus('Generando PDF', 'Uniendo las pantallas capturadas.');
  try {
    const data = await request(`/api/manual/${state.sessionId}/export`, 'POST', {});
    showDownload(data.downloadUrl, data.total);
    showStatus('Tu PDF está preparado', `Archivo con ${data.total} página(s).`, 'success', data.total);
    $('#download-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) { showStatus('No se pudo generar el PDF', error.message, 'error'); }
  finally { setBusy(false); }
}

$('#convert-form').addEventListener('submit', event => {
  event.preventDefault();
  if (state.mode === 'manual') startManual();
  else startAutomatic();
});
document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => selectMode(el.dataset.mode)));
$('#paste').addEventListener('click', async () => {
  try { $('#url').value = await navigator.clipboard.readText(); detectPlatform(); }
  catch { $('#url').focus(); showStatus('Pegado manual', 'Presiona Ctrl + V en el campo del enlace.'); }
});
$('#next').addEventListener('click', () => manualAction('next'));
$('#previous').addEventListener('click', () => manualAction('previous'));
$('#refresh-preview').addEventListener('click', () => manualAction('refresh'));
$('#capture').addEventListener('click', () => manualAction('capture'));
$('#export-manual').addEventListener('click', exportManual);
$('#end-manual').addEventListener('click', () => closeSession());
$('#manual-preview').addEventListener('click', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  manualAction('click', { x, y });
});
window.addEventListener('beforeunload', () => {
  if (state.sessionId) {
    // Cierre oportunista: las sesiones que no lleguen al servidor caducan solas.
    fetch(`/api/manual/${state.sessionId}`, { method: 'DELETE', keepalive: true }).catch(() => {});
  }
});
function detectPlatform() {
  let hint = 'Pega el enlace de una presentación pública.';
  try {
    const url = new URL($('#url').value.trim());
    if (url.hostname === 'view.genially.com') hint = 'Plataforma detectada: Genially.';
    else if (url.hostname === 'docs.google.com' && /^\/presentation\/d\//.test(url.pathname)) {
      hint = url.pathname.endsWith('/pub') || url.pathname.endsWith('/pubembed')
        ? 'Plataforma detectada: Google Slides publicado. Se capturará desde la primera diapositiva.'
        : 'Google Slides: necesitas el enlace «Publicar en la Web» que termine en /pub.';
    }
  } catch { /* Enlace incompleto */ }
  $('#platform-hint').textContent = hint;
}
$('#url').addEventListener('input', detectPlatform);
document.querySelectorAll('[data-sample]').forEach(btn => btn.addEventListener('click', () => {
  $('#url').value = btn.dataset.sample === 'google'
    ? 'https://docs.google.com/presentation/d/e/2PACX-1vRa4WUYCkr0l4fZS0dhOAIwK-Byieyt5D26fpv9ILsBjfRllQFnAZVXrYY2ys7Frw/pub?start=false&loop=false&delayms=3000&slide=id.p2'
    : 'https://view.genially.com/6acc0de795a03db43812fb3a';
  detectPlatform();
}));
selectMode('auto');
detectPlatform();
