'use strict';

const sharp = require('sharp');
const { chromium } = require('playwright');
const { waitForSlide, captureGoogleSlide, advanceGoogle } = require('./google-slides');

const VIEWPORT = { width: 1366, height: 768 };

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function openViewer(url, settings, source = 'genially') {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-dev-shm-usage']
  });
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      locale: 'es-ES',
      reducedMotion: 'reduce',
      acceptDownloads: false
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 65000 });
    await page.waitForTimeout(settings.delayMs + 1700);
    if (source === 'google') {
      await waitForSlide(page);
      await page.waitForTimeout(700);
    } else {
      await dismissCookies(page);
      await page.waitForTimeout(500);
    }
    return { browser, context, page };
  } catch (error) {
    await browser.close().catch(() => {});
    throw new Error(`No se pudo abrir la presentacion. ${error.message}`);
  }
}

async function dismissCookies(page) {
  for (const frame of page.frames()) {
    for (const name of [/^aceptar todo$/i, /^accept all$/i, /^allow all$/i, /^aceptar cookies$/i]) {
      try {
        const match = frame.getByRole('button', { name }).first();
        if (await match.isVisible({ timeout: 300 })) {
          await match.click({ timeout: 1200 });
          return;
        }
      } catch { /* sin consentimiento detectable */ }
    }
  }
}

async function snapshot(page, quality = 86) {
  // El mismo viewport sirve para capturar y para los clics de modo asistido.
  return await page.screenshot({
    type: 'jpeg', quality, fullPage: false,
    caret: 'hide', timeout: 30000
  });
}

async function signature(buffer) {
  // Muestreo de baja resolucion: mas estable que comparar archivos JPEG por hash.
  return sharp(buffer).resize(64, 36, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}

function imageDifference(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

async function keyboardAdvance(page, key = 'ArrowRight') {
  try { await page.keyboard.press(key); } catch { /* Puede no haber foco */ }
}

async function clickNavigation(page, direction) {
  const next = direction === 'next';
  const labels = next
    ? [/^next$/i, /next (page|slide)/i, /p[aá]gina siguiente/i, /^siguiente$/i, /avanzar/i]
    : [/^previous$/i, /previous (page|slide)/i, /p[aá]gina anterior/i, /^anterior$/i, /retroceder/i];
  const selectors = next
    ? '[data-testid*="next" i], button[class*="next" i], [class*="nextPage" i]'
    : '[data-testid*="previous" i], button[class*="prev" i], [class*="prevPage" i]';
  for (const frame of page.frames()) {
    for (const label of labels) {
      try {
        const target = frame.getByRole('button', { name: label }).first();
        if (await target.isVisible({ timeout: 300 })) {
          await target.click({ timeout: 1500 });
          return true;
        }
      } catch { /* probar siguiente */ }
    }
    try {
      const target = frame.locator(selectors).first();
      if (await target.isVisible({ timeout: 300 })) {
        await target.click({ timeout: 1500 });
        return true;
      }
    } catch { /* sin controles conocidos */ }
  }
  return false;
}

async function move(page, direction = 'next', source = 'genially', options = { quality: 86, delayMs: 1600 }) {
  if (source === 'google') {
    const before = await captureGoogleSlide(page, options.quality);
    const previousSignature = await signature(before);
    await advanceGoogle(page, direction, previousSignature, options, imageDifference, signature);
  } else {
    await keyboardAdvance(page, direction === 'next' ? 'ArrowRight' : 'ArrowLeft');
  }
}

async function captureImage(page, source, quality) {
  return source === 'google' ? captureGoogleSlide(page, quality) : snapshot(page, quality);
}

async function tryAdvance(page, previousSignature, options) {
  const { delayMs, quality } = options;
  await move(page);
  await delay(delayMs);
  let frame = await snapshot(page, quality);
  let sig = await signature(frame);
  if (imageDifference(previousSignature, sig) >= 6.0) return { frame, sig, method: 'teclado' };

  const clicked = await clickNavigation(page, 'next');
  if (clicked) {
    await delay(delayMs);
    frame = await snapshot(page, quality);
    sig = await signature(frame);
    if (imageDifference(previousSignature, sig) >= 6.0) return { frame, sig, method: 'boton' };
  }

  // Ultimo recurso: el control estandar de Genially suele estar sobre el borde derecho.
  // No se usa repetidamente para reducir clics accidentales en el contenido.
  await page.mouse.click(VIEWPORT.width * 0.976, VIEWPORT.height * 0.5);
  await delay(delayMs);
  frame = await snapshot(page, quality);
  sig = await signature(frame);
  return { frame, sig, method: 'borde' };
}

/** Las capturas son visuales: ventanas y rutas interactivas pueden requerir modo asistido. */
async function autoCapture(url, options, onProgress = () => {}, source = 'genially') {
  const viewer = await openViewer(url, options, source);
  try {
    const { page } = viewer;
    const images = [];
    let prevSig = null;
    for (let i = 0; i < options.maxSlides; i++) {
      let capture;
      let sig;
      if (i === 0) {
        capture = await captureImage(page, source, options.quality);
        sig = await signature(capture);
      } else {
        const result = source === 'google'
          ? await advanceGoogle(page, 'next', prevSig, options, imageDifference, signature)
          : await tryAdvance(page, prevSig, options);
        if (source === 'google' && !result.changed) {
          onProgress({ total: images.length, message: 'No avanzo la presentacion de Google; finalizando.' });
          break;
        }
        capture = source === 'google' ? result.image : result.frame;
        sig = result.sig;
        const delta = imageDifference(prevSig, sig);
        if (source !== 'google' && delta < 6.0) {
          onProgress({ total: images.length, message: 'No se detectaron nuevas diapositivas; finalizando.' });
          break;
        }
      }
      images.push(capture);
      prevSig = sig;
      onProgress({ total: images.length, message: `Capturadas ${images.length} diapositiva(s).` });
    }
    if (!images.length) throw new Error('No se pudo capturar ninguna pantalla.');
    return images;
  } finally {
    await viewer.browser.close().catch(() => {});
  }
}

module.exports = {
  VIEWPORT, openViewer, autoCapture, snapshot, captureImage, move,
  imageDifference, signature
};
