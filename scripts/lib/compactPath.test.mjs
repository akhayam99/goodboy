import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compactPath } from './compactPath.mjs';

const ARITY = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

const endPointsOf = ({ d }) => {
  const tokens = d.match(/[a-z]|-?(?:\d+\.?\d*|\.\d+)/gi) ?? [];
  const points = [];
  const current = { x: 0, y: 0 };
  const start = { x: 0, y: 0 };
  let letter = '';
  let numbers = [];
  const flush = () => {
    const kind = letter.toLowerCase();
    if (kind === 'z') {
      Object.assign(current, start);
      points.push({ ...current });
      return;
    }
    for (let index = 0; index < numbers.length; index += ARITY[kind]) {
      const values = numbers.slice(index, index + ARITY[kind]);
      const isRelative = letter === kind;
      const base = isRelative ? { ...current } : { x: 0, y: 0 };
      if (kind === 'h') {
        current.x = base.x + values[0];
      }
      if (kind === 'v') {
        current.y = base.y + values[0];
      }
      if (kind !== 'h' && kind !== 'v') {
        current.x = base.x + values[values.length - 2];
        current.y = base.y + values[values.length - 1];
      }
      if (kind === 'm' && index === 0) {
        Object.assign(start, current);
      }
      points.push({ ...current });
    }
  };
  for (const token of tokens) {
    if (/[a-z]/i.test(token)) {
      if (letter !== '') {
        flush();
      }
      letter = token;
      numbers = [];
      continue;
    }
    numbers.push(Number(token));
  }
  flush();
  return points;
};

const CHECK =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z';
const DOTS =
  'M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z';
const CORNERS = 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16.5,16.5,0,0,0,16-16V56Z';

describe('compactPath', () => {
  it('rounds every end point to the nearest whole unit without drift', () => {
    for (const d of [CHECK, DOTS, CORNERS]) {
      const original = endPointsOf({ d });
      const compact = endPointsOf({ d: compactPath({ d }) });
      assert.equal(compact.length, original.length);
      compact.forEach((point, index) => {
        assert.ok(Math.abs(point.x - original[index].x) <= 0.5, `${d} x at ${index}`);
        assert.ok(Math.abs(point.y - original[index].y) <= 0.5, `${d} y at ${index}`);
      });
    }
  });

  it('keeps arc flags and whole numbers as they are', () => {
    assert.equal(compactPath({ d: 'M10,10a8,8,0,0,1,16,0Z' }), 'm10,10a8,8,0,0,1,16,0z');
  });

  it('writes the shorter of the relative and absolute forms', () => {
    assert.equal(compactPath({ d: 'M100,100L101,101' }), 'm100,100l1,1');
    assert.equal(compactPath({ d: 'M100,100l-99,-99' }), 'm100,100L1,1');
  });

  it('is stable when run twice', () => {
    for (const d of [CHECK, DOTS, CORNERS]) {
      assert.equal(compactPath({ d: compactPath({ d }) }), compactPath({ d }));
    }
  });
});
