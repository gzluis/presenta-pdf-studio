'use strict';

const DEFAULT_URL = 'https://view.genially.com/6acc0de795a03db43812fb3a';
const GOOGLE_EXAMPLE = 'https://docs.google.com/presentation/d/e/2PACX-1vRa4WUYCkr0l4fZS0dhOAIwK-Byieyt5D26fpv9ILsBjfRllQFnAZVXrYY2ys7Frw/pub?start=false&loop=false&delayms=3000&slide=id.p2';

function parsePresentationUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 1800) {
    throw new Error('Introduce un enlace publico de Genially o Google Slides.');
  }
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('El enlace no es una URL valida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('El enlace debe usar HTTPS y no puede incluir credenciales ni puertos.');
  }

  if (url.hostname.toLowerCase() === 'view.genially.com') {
    const match = /^\/([a-f0-9]{24})(?:\/[^?#]*)?$/i.exec(url.pathname);
    if (!match) throw new Error('El enlace no contiene un identificador publico de Genially.');
    const id = match[1].toLowerCase();
    return { source: 'genially', id, url: `https://view.genially.com/${id}` };
  }

  if (url.hostname.toLowerCase() === 'docs.google.com') {
    const match = /^\/presentation\/d\/(e\/)?([A-Za-z0-9_-]+)\/(pub|pubembed)\/?$/.exec(url.pathname);
    if (!match) {
      throw new Error('Para Google Slides utiliza el enlace publicado (terminado en /pub o /pubembed). No se admiten enlaces /edit privados.');
    }
    const [, prefix, id] = match;
    if (id.length < 15 || id.length > 150 || (prefix && !id.startsWith('2PACX-'))) {
      throw new Error('Identificador de presentacion publicada de Google Slides no valido.');
    }
    // Se omite slide=id.p2 para empezar siempre desde la primera diapositiva.
    // start=false y loop=false evitan avance programado y capturas repetidas.
    const base = `https://docs.google.com/presentation/d/${prefix || ''}${id}/pub`;
    return { source: 'google', id, url: `${base}?start=false&loop=false&delayms=3000` };
  }
  throw new Error('Solo se admiten enlaces publicos de view.genially.com o docs.google.com/presentation/.');
}

function parseGeniallyUrl(value) {
  const parsed = parsePresentationUrl(value);
  if (parsed.source !== 'genially') throw new Error('Este enlace no corresponde a Genially.');
  return { id: parsed.id, url: parsed.url };
}

function numberInRange(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function settingsFromBody(body = {}) {
  return {
    maxSlides: numberInRange(body.maxSlides, 30, 1, 100),
    delayMs: numberInRange(body.delayMs, 1600, 300, 60000),
    quality: numberInRange(body.quality, 86, 50, 95)
  };
}

module.exports = { DEFAULT_URL, GOOGLE_EXAMPLE, parsePresentationUrl, parseGeniallyUrl, settingsFromBody };
