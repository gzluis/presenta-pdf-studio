'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGeniallyUrl, settingsFromBody } = require('../src/validation');

test('acepta el ejemplo publico compartido y quita parametros', () => {
  assert.deepEqual(parseGeniallyUrl('https://view.genially.com/6acc0de795a03db43812fb3a?ref=share'), {
    id: '6acc0de795a03db43812fb3a', url: 'https://view.genially.com/6acc0de795a03db43812fb3a'
  });
});
test('acepta enlace con slug /presentation-...', () => {
  assert.equal(parseGeniallyUrl('https://view.genially.com/6acc0de795a03db43812fb3a/presentation-ejemplo').id, '6acc0de795a03db43812fb3a');
});
test('bloquea dominio externo, subdominios falsos, HTTP y credenciales', () => {
  for (const value of [
    'https://view.genially.com.evil.com/6acc0de795a03db43812fb3a',
    'http://view.genially.com/6acc0de795a03db43812fb3a',
    'https://example.com/6acc0de795a03db43812fb3a',
    'https://u:p@view.genially.com/6acc0de795a03db43812fb3a',
    'file:///etc/passwd'
  ]) assert.throws(() => parseGeniallyUrl(value));
});
test('limita cantidad y retardo para evitar cargas accidentales', () => {
  assert.deepEqual(settingsFromBody({ maxSlides: 10000, delayMs: 1, quality: 8 }), {
    maxSlides: 100, delayMs: 300, quality: 50
  });
});
