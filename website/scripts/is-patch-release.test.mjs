import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPatchRelease } from '../src/prerender/isPatchRelease.ts';

describe('isPatchRelease', () => {
  it('is true when the patch number is not 0', () => {
    ['0.40.1', '0.31.9', '1.0.12', '10.20.30'].forEach((version) => {
      assert.equal(isPatchRelease({ version }), true, version);
    });
  });

  it('is false for a minor or major release', () => {
    ['0.42.0', '1.0.0', '2.10.0'].forEach((version) => {
      assert.equal(isPatchRelease({ version }), false, version);
    });
  });

  it('is false for a version that is not three numbers, so it stays indexed', () => {
    ['', '1', '1.2', '1.2.3.4'].forEach((version) => {
      assert.equal(isPatchRelease({ version }), false, version);
    });
  });
});
