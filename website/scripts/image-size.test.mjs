import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { imageSize } from './lib/imageSize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const webp = ({ type, body }) => {
  const header = Buffer.alloc(20);
  header.write('RIFF', 0, 'latin1');
  header.write('WEBP', 8, 'latin1');
  header.write(type, 12, 'latin1');
  return Buffer.concat([header, body]);
};

describe('imageSize', () => {
  it('reads a lossy WebP', () => {
    const body = Buffer.alloc(30);
    body.writeUInt16LE(640, 6);
    body.writeUInt16LE(480, 8);
    assert.deepEqual(imageSize({ bytes: webp({ type: 'VP8 ', body }) }), {
      width: 640,
      height: 480,
    });
  });

  it('reads a lossless WebP', () => {
    const body = Buffer.alloc(30);
    body.writeUInt32LE(1999 | (999 << 14), 1);
    assert.deepEqual(imageSize({ bytes: webp({ type: 'VP8L', body }) }), {
      width: 2000,
      height: 1000,
    });
  });

  it('reads an extended WebP', () => {
    const body = Buffer.alloc(30);
    body.writeUIntLE(4079, 4, 3);
    body.writeUIntLE(2639, 7, 3);
    assert.deepEqual(imageSize({ bytes: webp({ type: 'VP8X', body }) }), {
      width: 4080,
      height: 2640,
    });
  });

  it('reads a PNG', () => {
    const bytes = Buffer.alloc(32);
    Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes);
    bytes.writeUInt32BE(1200, 16);
    bytes.writeUInt32BE(630, 20);
    assert.deepEqual(imageSize({ bytes }), { width: 1200, height: 630 });
  });

  it('refuses a file that is neither', () => {
    assert.throws(() => imageSize({ bytes: Buffer.from('GIF89a') }));
  });
});

describe('the committed size list', () => {
  const sizes = JSON.parse(
    readFileSync(join(HERE, '..', 'src', 'prerender', 'imageSizes.json'), 'utf8'),
  );

  it('keys the media path and holds positive whole numbers', () => {
    Object.entries(sizes).forEach(([path, { width, height }]) => {
      assert.match(path, /^features\/[a-z0-9-]+\.(webp|png)$/);
      assert.ok(Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0);
    });
  });
});

describe('the doc image check', () => {
  const workflow = readFileSync(
    join(HERE, '..', '..', '.github', 'workflows', 'website.yml'),
    'utf8',
  );

  it('passes on the committed list when run with no argument', () => {
    const result = spawnSync(process.execPath, [join(HERE, 'sync-image-sizes.mjs')], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  });

  it('runs in CI and the path filter covers everything the site builds from', () => {
    assert.match(workflow, /pnpm check:images/);
    ['website/', 'docs/features/', 'FEATURES\\.md', 'CHANGELOG\\.md'].forEach((path) => {
      assert.ok(workflow.includes(path), path);
    });
  });
});
