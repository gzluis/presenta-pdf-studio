'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePresentationUrl, GOOGLE_EXAMPLE } = require('../src/validation');

test('acepta Google Slides publicada como /d/e/2PACX y reinicia al principio', () => {
  const info = parsePresentationUrl(GOOGLE_EXAMPLE);
  assert.equal(info.source, 'google');
  assert.match(info.id, /^2PACX-/);
  assert.match(info.url, /\/pub\?start=false&loop=false&delayms=3000$/);
  assert.ok(!info.url.includes('slide=id.p2'));
});

test('acepta variantes publicadas y normaliza /pubembed a /pub', () => {
  const url = GOOGLE_EXAMPLE.replace('/pub?', '/pubembed?');
  assert.match(parsePresentationUrl(url).url, /\/pub\?/);
});

test('acepta ruta publica /d/id/pub pero rechaza edición y exportación privada', () => {
  const id = '1aB2cD3eF4gH5iJ6kL7mN8oP9Q';
  assert.equal(parsePresentationUrl(`https://docs.google.com/presentation/d/${id}/pub`).id, id);
  for (const ending of ['edit', 'view', 'export/pdf']) {
    assert.throws(() => parsePresentationUrl(`https://docs.google.com/presentation/d/${id}/${ending}`));
  }
});

test('bloquea google dominio imitado, host local y puertos', () => {
  for (const url of [
    'https://docs.google.com.evil.example/presentation/d/e/2PACX-ABC/pub',
    'http://docs.google.com/presentation/d/e/2PACX-ABC/pub',
    'https://docs.google.com:8443/presentation/d/e/2PACX-ABC/pub',
    'https://127.0.0.1/presentation/d/e/2PACX-ABC/pub'
  ]) assert.throws(() => parsePresentationUrl(url));
});
