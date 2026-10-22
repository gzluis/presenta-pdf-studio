'use strict';

// Google Slides publicado renderiza la diapositiva activa como SVG.
// La captura selecciona solo el lienzo, excluyendo la barra del visor.
const sharp = require('sharp');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const SLIDE_SELECTORS = [
  '.punch-viewer-svgpage-svgcontainer',
  '.punch-viewer-svgpage-svgcontainer svg',
  '.punch-viewer-content svg'
];

async function activeSlideLocator(page) {
  for (const selector of SLIDE_SELECTORS) {
    const nodes = page.locator(selector);
    const count = Math.min(await nodes.count().catch(() => 0), 20);
    let chosen = null;
    let largest = 0;
    for (let i = 0; i < count; i++) {
      const locator = nodes.nth(i);
      const box = await locator.boundingBox().catch(() => null);
      if (!box || box.width < 240 || box.height < 150) continue;
      if (box.width * box.height > largest) {
        largest = box.width * box.height;
        chosen = locator;
      }
    }
    if (chosen) return chosen;
  }
  return null;
}

async function waitForSlide(page) {
  let locator;
  for (let t = 0; t < 28; t++) {
    locator = await activeSlideLocator(page);
    if (locator) return locator;
    await sleep(750);
  }
  throw new Error('Google Slides no mostro una diapositiva. Comprueba que el enlace publico funciona en Chrome o Edge.');
}

async function captureGoogleSlide(page, quality = 86) {
  const locator = await waitForSlide(page);
  // locator.screenshot captura el lienzo visible en lugar de la barra de Google.
  const buffer = await locator.screenshot({ type: 'png', animations: 'disabled', timeout: 25000 });
  // PNG temporal -> JPEG de calidad elegida; no incluye barras de navegación.
  return sharp(buffer).flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
}

async function googleViewerInfo(page) {
  return page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll('[aria-posinset]'));
    const selected = controls.find(el => {
      const position = el.getAttribute('aria-posinset');
      const total = el.getAttribute('aria-setsize');
      return /^\d+$/.test(position || '') && /^\d+$/.test(total || '');
    });
    const current = selected ? Number(selected.getAttribute('aria-posinset')) : null;
    const total = selected ? Number(selected.getAttribute('aria-setsize')) : null;
    const slideParam = new URL(window.location.href).searchParams.get('slide');
    return { current, total, slideParam };
  }).catch(() => ({ current: null, total: null, slideParam: null }));
}

/** Intenta el siguiente mecanismo solo si la diapositiva no cambió. */
async function advanceGoogle(page, direction, previousImage, options, imageDifference, signature) {
  const key = direction === 'next' ? 'ArrowRight' : 'ArrowLeft';
  const previousInfo = await googleViewerInfo(page);
  const same = async () => {
    await sleep(options.delayMs);
    const image = await captureGoogleSlide(page, options.quality);
    const sig = await signature(image);
    const info = await googleViewerInfo(page);
    const currentChanged = Number.isInteger(previousInfo.current) && Number.isInteger(info.current) && previousInfo.current !== info.current;
    const idChanged = Boolean(previousInfo.slideParam && info.slideParam && previousInfo.slideParam !== info.slideParam);
    const delta = imageDifference(previousImage, sig);
    const changed = currentChanged || idChanged || delta >= 3.2;
    return { changed, image, sig, info, delta };
  };

  const attempts = [
    async () => page.keyboard.press(key),
    async () => {
      const label = direction === 'next'
        ? '[aria-label*="Next" i], [title*="Next" i], [aria-label*="siguiente" i], [title*="siguiente" i], .punch-viewer-navbar-next'
        : '[aria-label*="Previous" i], [title*="Previous" i], [aria-label*="anterior" i], [title*="anterior" i], .punch-viewer-navbar-prev';
      for (const selector of label.split(', ')) {
        const button = page.locator(selector).first();
        if (await button.isVisible().catch(() => false)) {
          await button.click({ timeout: 2000 });
          return;
        }
      }
    },
    async () => {
      // Zona central del lienzo, usada por el visor publicado para avanzar.
      const coat = page.locator('.punch-viewer-coat').first();
      const box = await coat.boundingBox().catch(() => null);
      if (!box) return;
      await page.mouse.click(box.x + box.width * 0.78, box.y + box.height * 0.50);
    },
    async () => page.mouse.wheel(0, direction === 'next' ? 320 : -320)
  ];

  for (const attempt of attempts) {
    try { await attempt(); } catch { /* probar mecanismo siguiente */ }
    const result = await same().catch(() => null);
    if (result?.changed) return result;
  }
  return { changed: false };
}

module.exports = { activeSlideLocator, waitForSlide, captureGoogleSlide, googleViewerInfo, advanceGoogle };
