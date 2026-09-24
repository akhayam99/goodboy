import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [9.5 * 1024, '9.5 KB'],
    [10 * 1024, '10 KB'],
    [3.25 * 1024 ** 3, '3.3 GB'],
    [12 * 1024 ** 4, '12 TB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes({ bytes })).toBe(expected);
  });
});
