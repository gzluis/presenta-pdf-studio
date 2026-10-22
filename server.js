'use strict';

const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { parsePresentationUrl, settingsFromBody } = require('./src/validation');
const { openViewer, autoCapture, snapshot, captureImage, move, VIEWPORT } = require('./src/converter');
const { savePdf } = require('./src/pdf');

const app = express();
const PORT = Number(process.env.PORT) || 4177;
const ROOT = __dirname;
const OUTPUT = path.join(ROOT, 'salidas');
const jobs = new Map();
const manualSessions = new Map();
const MAX_JOBS = 10;
const MAX_MANUAL = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
app.use(express.static(path.join(ROOT, 'public')));

function apiError(error, res) {
  const message = error?.message || 'Error desconocido.';
  console.error('[genially-to-pdf]', message);
  const known = /enlace|URL|identificador|Solo se admiten|No se admiten|sesion|sesión|accion|acción|publicado|Google Slides/i.test(message);
  res.status(known ? 400 : 500).json({ error: message });
}

function outputFilename(presentation) {
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '_');
  const { createHash } = require('node:crypto');
  const shortId = presentation.source === 'genially' ? presentation.id : createHash('sha256').update(presentation.id).digest('hex').slice(0, 24);
  return `${presentation.source}_${shortId}_${iso}.pdf`;
}

async function persistPdf(images, presentation) {
  const filename = outputFilename(presentation);
  await savePdf(images, path.join(OUTPUT, filename), `${presentation.source === 'google' ? 'Google Slides' : 'Genially'} ${presentation.id}`);
  return filename;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/convert', async (req, res) => {
  let presentation, options;
  try {
    presentation = parsePresentationUrl(req.body.url);
    options = settingsFromBody(req.body);
  } catch (error) { return apiError(error, res); }

  const active = [...jobs.values()].some(job => job.status === 'trabajando');
  if (active) return res.status(429).json({ error: 'Ya hay una conversion automatica. Finaliza antes de iniciar otra.' });
  const jobId = randomUUID();
  const job = { id: jobId, status: 'trabajando', message: 'Abriendo navegador...', total: 0, started: Date.now() };
  jobs.set(jobId, job);
  res.status(202).json({ jobId });

  // El proceso se ejecuta dentro del servidor local mientras el frontend consulta su estado.
  (async () => {
    try {
      const images = await autoCapture(presentation.url, options, event => {
        job.total = event.total;
        job.message = event.message;
      }, presentation.source);
      job.message = 'Construyendo el archivo PDF...';
      job.filename = await persistPdf(images, presentation);
      job.status = 'completo';
      job.message = `PDF generado: ${images.length} pagina(s).`;
      job.total = images.length;
    } catch (error) {
      job.status = 'error';
      job.message = error.message || String(error);
      console.error('[conversion]', error);
    }
  })();
  if (jobs.size > MAX_JOBS) {
    for (const [id, item] of jobs) {
      if (id !== jobId && item.status !== 'trabajando') { jobs.delete(id); break; }
    }
  }
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Conversion no encontrada.' });
  res.json({ status: job.status, message: job.message, total: job.total,
    downloadUrl: job.filename ? `/api/download/${encodeURIComponent(job.filename)}` : null });
});

app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!/^(?:genially|google)_[a-f0-9]{24}_[0-9]{8}_[0-9]{6}\.pdf$/.test(filename)) {
    return res.status(400).json({ error: 'Nombre de archivo invalido.' });
  }
  res.download(path.join(OUTPUT, filename), filename);
});

app.post('/api/manual/start', async (req, res) => {
  if (manualSessions.size >= MAX_MANUAL) {
    return res.status(429).json({ error: 'Hay demasiadas sesiones abiertas. Cierra una para comenzar.' });
  }
  try {
    const presentation = parsePresentationUrl(req.body.url);
    const options = settingsFromBody(req.body);
    const viewer = await openViewer(presentation.url, options, presentation.source);
    const id = randomUUID();
    const session = { id, presentation, options, ...viewer, images: [], touched: Date.now() };
    manualSessions.set(id, session);
    const preview = await snapshot(viewer.page, options.quality);
    res.json({ id, preview: toDataUri(preview), total: 0 });
  } catch (error) { apiError(error, res); }
});

function toDataUri(buffer) { return `data:image/jpeg;base64,${buffer.toString('base64')}`; }

app.post('/api/manual/:id/action', async (req, res) => {
  const session = manualSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sesion no encontrada o caducada.' });
  const { page, options } = session;
  try {
    const action = req.body.action;
    if (action === 'next' || action === 'previous') {
      await move(page, action === 'next' ? 'next' : 'previous', session.presentation.source, options);
      if (session.presentation.source !== 'google') await page.waitForTimeout(options.delayMs);
    } else if (action === 'click') {
      const x = Number(req.body.x), y = Number(req.body.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error('Las coordenadas del clic deben estar entre 0 y 1.');
      }
      await page.mouse.click(Math.min(VIEWPORT.width - 1, x * VIEWPORT.width),
        Math.min(VIEWPORT.height - 1, y * VIEWPORT.height));
      await page.waitForTimeout(options.delayMs);
    } else if (action === 'capture') {
      if (session.images.length >= 100) throw new Error('Limite de 100 capturas por PDF.');
      session.images.push(await captureImage(page, session.presentation.source, options.quality));
    } else if (action !== 'refresh') {
      throw new Error('Accion desconocida.');
    }
    session.touched = Date.now();
    const image = await snapshot(page, options.quality);
    res.json({ preview: toDataUri(image), total: session.images.length });
  } catch (error) { apiError(error, res); }
});

app.post('/api/manual/:id/export', async (req, res) => {
  const session = manualSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sesion no encontrada o caducada.' });
  try {
    const images = session.images;
    if (!images.length) return res.status(400).json({ error: 'Primero captura al menos una diapositiva.' });
    const filename = await persistPdf(images, session.presentation);
    res.json({ filename, total: images.length, downloadUrl: `/api/download/${encodeURIComponent(filename)}` });
  } catch (error) { apiError(error, res); }
});

app.delete('/api/manual/:id', async (req, res) => {
  const session = manualSessions.get(req.params.id);
  if (session) {
    manualSessions.delete(req.params.id);
    await session.browser.close().catch(() => {});
  }
  res.json({ ok: true });
});

// Evita sesiones persistentes si el usuario cierra la pestaña sin pulsar 'Cerrar'.
setInterval(async () => {
  for (const [id, session] of manualSessions) {
    if (Date.now() - session.touched > 30 * 60 * 1000) {
      manualSessions.delete(id);
      await session.browser.close().catch(() => {});
    }
  }
  for (const [id, job] of jobs) {
    if (job.status !== 'trabajando' && Date.now() - job.started > DAY_MS) jobs.delete(id);
  }
}, 60 * 1000).unref();

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`Presentaciones to PDF: http://127.0.0.1:${PORT}`);
    console.log('El servidor solo escucha en este equipo (localhost).');
  });
  const shutdown = async () => {
    for (const session of manualSessions.values()) {
      await session.browser.close().catch(() => {});
    }
    server.close();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
