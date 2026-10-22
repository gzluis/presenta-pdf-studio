const test = require('node:test');
const assert = require('node:assert/strict');
const { settingsFromBody } = require('../src/validation');
test('admite esperas de hasta 60 segundos', () => {
  assert.equal(settingsFromBody({delayMs: 60000}).delayMs, 60000);
  assert.equal(settingsFromBody({delayMs: 999999}).delayMs, 60000);
  assert.equal(settingsFromBody({delayMs: 300}).delayMs, 300);
});
