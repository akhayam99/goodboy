import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { carbonPathOf } from './carbonPathOf.mjs';

const descriptorOf = ({ content, size = 32 }) => ({
  elem: 'svg',
  attrs: { viewBox: `0 0 ${size} ${size}` },
  content,
  name: 'sample',
  size,
});

describe('carbonPathOf', () => {
  it('scales a 32 unit path onto the 256 grid as absolute commands', () => {
    const descriptor = descriptorOf({
      content: [{ elem: 'path', attrs: { d: 'M16 22 6 12 7.4 10.6z' } }],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M128,176L48,96L59.2,84.8Z');
  });

  it('resolves relative, horizontal and vertical commands against the pen', () => {
    const descriptor = descriptorOf({
      content: [{ elem: 'path', attrs: { d: 'M1,1h2v2l-1,1z' } }],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M8,8L24,8L24,24L16,32Z');
  });

  it('reads arc flags written without separators', () => {
    const descriptor = descriptorOf({
      content: [{ elem: 'path', attrs: { d: 'M2 2a1 1 0 014 0z' } }],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M16,16A8,8,0,0,1,48,16Z');
  });

  it('turns a circle, a rect and a polygon into closed subpaths of the same path', () => {
    const descriptor = descriptorOf({
      content: [
        { elem: 'circle', attrs: { cx: '16', cy: '16', r: '2' } },
        { elem: 'rect', attrs: { x: '1', y: '1', width: '2', height: '1' } },
        { elem: 'polygon', attrs: { points: '0 0 4 0 4 4' } },
      ],
    });

    assert.equal(
      carbonPathOf({ descriptor }),
      [
        'M112,128A16,16,0,1,1,144,128A16,16,0,1,1,112,128Z',
        'M8,8L24,8L24,16L8,16Z',
        'M0,0L32,0L32,32Z',
      ].join(''),
    );
  });

  it('draws a separate shape in the winding of the paths so the shapes add up', () => {
    const counterClockwise = 'M0,0L0,4L4,4L4,0Z';
    const descriptor = descriptorOf({
      content: [
        { elem: 'path', attrs: { d: counterClockwise } },
        { elem: 'polygon', attrs: { points: '1 1 3 1 3 3' } },
      ],
    });

    assert.match(carbonPathOf({ descriptor }), /M24,24L24,8L8,8Z$/);
  });

  it('skips the transparent and inner shapes Carbon keeps for hit areas', () => {
    const descriptor = descriptorOf({
      content: [
        { elem: 'path', attrs: { d: 'M0,0L1,1Z' } },
        { elem: 'rect', attrs: { width: '32', height: '32', fill: 'none' } },
        { elem: 'path', attrs: { d: 'M2,2L3,3Z', 'data-icon-path': 'inner-path', opacity: '0' } },
      ],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M0,0L8,8Z');
  });

  it('applies a rotate transform around its centre', () => {
    const descriptor = descriptorOf({
      content: [{ elem: 'path', attrs: { d: 'M17,16L18,16Z', transform: 'rotate(90 16 16)' } }],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M128,136L128,144Z');
  });

  it('scales a 16 unit artboard by sixteen', () => {
    const descriptor = descriptorOf({
      size: 16,
      content: [{ elem: 'path', attrs: { d: 'M1,1L2,2Z' } }],
    });

    assert.equal(carbonPathOf({ descriptor }), 'M16,16L32,32Z');
  });

  it('refuses a transform it cannot apply', () => {
    const descriptor = descriptorOf({
      content: [{ elem: 'path', attrs: { d: 'M1,1L2,2Z', transform: 'scale(2)' } }],
    });

    assert.throws(() => carbonPathOf({ descriptor }), /unsupported transform/);
  });
});
