// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { arrivalTitle } from './updateArrivalCopy';

describe('arrivalTitle', () => {
  it('names the version and nothing else', () => {
    expect(arrivalTitle({ version: '0.8.0' })).toBe('0.8.0 is ready');
  });

  it('falls back when the version is unknown', () => {
    expect(arrivalTitle({ version: null })).toBe('Update is ready');
  });
});
