import { describe, expect, it } from 'vitest';
import { sentryTagLabel } from './sentryTagLabel';

describe('sentryTagLabel', () => {
  it('capitalises a known tag key', () => {
    expect(sentryTagLabel({ key: 'os' })).toBe('OS');
    expect(sentryTagLabel({ key: 'environment' })).toBe('Environment');
  });

  it('keeps an unknown tag key as it is', () => {
    expect(sentryTagLabel({ key: 'server_name' })).toBe('server_name');
  });

  it('never resolves an inherited object property', () => {
    expect(sentryTagLabel({ key: 'constructor' })).toBe('constructor');
    expect(sentryTagLabel({ key: '__proto__' })).toBe('__proto__');
    expect(sentryTagLabel({ key: 'toString' })).toBe('toString');
  });
});
