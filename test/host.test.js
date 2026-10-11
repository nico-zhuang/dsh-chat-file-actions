import test from 'node:test';
import assert from 'node:assert/strict';
import { Config, apply } from '../lib/index.js';

test('Host contributes only live settings with the existing UI defaults', () => {
  assert.equal(typeof apply, 'function');
  assert.deepEqual(Object.keys(Config.dict), ['openMode', 'copyActions']);
  assert.equal(Config.dict.openMode.meta.default, 'system');
  assert.deepEqual(Config.dict.copyActions.meta.default, ['path', 'name', 'markdown']);
  assert.equal(Config.dict.openMode.meta.volatile, true);
  assert.equal(Config.dict.copyActions.meta.volatile, true);
});
