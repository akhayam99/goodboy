import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gzipSync } from 'node:zlib';
import {
  evaluateBudget,
  initialAssets,
  measureBundle,
  mockSceneFiles,
  suggestedBudget,
} from './check-bundle-budget.mjs';

const HTML = [
  '<script type="module" src="/assets/index-abc.js"></script>',
  '<link rel="modulepreload" href="/assets/vendor-def.js">',
  '<link rel="stylesheet" href="/assets/index-ghi.css">',
  '<link rel="icon" href="/favicon.svg">',
].join('\n');

const fakeRead =
  ({ files }) =>
  (path) => {
    const name = Object.keys(files).find((candidate) => path.endsWith(candidate));
    if (name === undefined) {
      throw new Error(`missing ${path}`);
    }
    return Buffer.from(files[name]);
  };

describe('initialAssets', () => {
  it('lists the scripts, preloads and styles of the entry page', () => {
    assert.deepEqual(initialAssets({ html: HTML }), [
      'assets/index-abc.js',
      'assets/vendor-def.js',
      'assets/index-ghi.css',
    ]);
  });

  it('finds nothing when the asset path form changes', () => {
    assert.deepEqual(
      initialAssets({ html: '<script src="https://cdn.example/a.js"></script>' }),
      [],
    );
  });
});

describe('measureBundle', () => {
  it('adds the raw and gzip size of every initial file', () => {
    const body = 'a'.repeat(5000);
    const measured = measureBundle({
      distDirectory: '/dist',
      read: fakeRead({
        files: {
          'index.html': HTML,
          'index-abc.js': body,
          'vendor-def.js': body,
          'index-ghi.css': body,
        },
      }),
    });
    assert.equal(measured.files.length, 3);
    assert.equal(measured.rawBytes, 15000);
    assert.equal(measured.gzipBytes, 3 * gzipSync(Buffer.from(body), { level: 9 }).length);
  });
});

describe('evaluateBudget', () => {
  const budget = { rawBytes: 1000, gzipBytes: 400 };

  it('passes a bundle within both limits', () => {
    const result = evaluateBudget({
      measured: { files: ['a.js'], rawBytes: 1000, gzipBytes: 400 },
      budget,
    });
    assert.equal(result.isWithinBudget, true);
  });

  it('fails when the raw weight is over', () => {
    const result = evaluateBudget({
      measured: { files: ['a.js'], rawBytes: 1001, gzipBytes: 10 },
      budget,
    });
    assert.equal(result.isWithinBudget, false);
    assert.match(result.failures[0], /1001 bytes, budget 1000/);
  });

  it('fails when the gzip weight is over', () => {
    const result = evaluateBudget({
      measured: { files: ['a.js'], rawBytes: 10, gzipBytes: 401 },
      budget,
    });
    assert.equal(result.isWithinBudget, false);
  });

  it('fails when zero files were counted, instead of printing 0.00 MB', () => {
    const result = evaluateBudget({
      measured: { files: [], rawBytes: 0, gzipBytes: 0 },
      budget,
    });
    assert.equal(result.isWithinBudget, false);
    assert.match(result.failures[0], /nothing was measured/);
  });
});

describe('mockSceneFiles', () => {
  it('lists mock scene chunks found in the dist assets', () => {
    const files = mockSceneFiles({
      distDirectory: '/dist',
      list: () => ['index-abc.js', 'MockEntry-def.js', 'installMockRuntime-ghi.js', 'a.css'],
    });
    assert.deepEqual(files, ['MockEntry-def.js', 'installMockRuntime-ghi.js']);
  });

  it('finds nothing in a dist without mock chunks', () => {
    assert.deepEqual(
      mockSceneFiles({ distDirectory: '/dist', list: () => ['index-abc.js', 'worker-x.js'] }),
      [],
    );
  });

  it('fails the budget when a mock chunk is present', () => {
    const result = evaluateBudget({
      measured: { files: ['a.js'], rawBytes: 10, gzipBytes: 10 },
      budget: { rawBytes: 1000, gzipBytes: 400 },
      mockFiles: ['MockEntry-def.js'],
    });
    assert.equal(result.isWithinBudget, false);
    assert.match(result.failures[0], /MockEntry-def\.js/);
  });
});

describe('suggestedBudget', () => {
  it('leaves five percent of headroom', () => {
    assert.deepEqual(
      suggestedBudget({ measured: { files: ['a.js'], rawBytes: 1000, gzipBytes: 200 } }),
      { rawBytes: 1050, gzipBytes: 210 },
    );
  });
});
