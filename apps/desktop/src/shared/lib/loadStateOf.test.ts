import { describe, expect, it } from 'vitest';
import { loadStateOf } from './loadStateOf';

describe('loadStateOf', () => {
  for (const hasLoaded of [false, true]) {
    for (const isLoading of [false, true]) {
      for (const error of [null, undefined, new Error('Read failed')]) {
        for (const count of [0, 2]) {
          const expected =
            count > 0
              ? 'ready'
              : error !== null && error !== undefined
                ? 'error'
                : !hasLoaded
                  ? 'loading'
                  : 'empty';
          it(`${hasLoaded}, ${isLoading}, ${String(error)}, ${count}: ${expected}`, () => {
            expect(loadStateOf({ hasLoaded, isLoading, error, count })).toBe(expected);
          });
        }
      }
    }
  }
});
