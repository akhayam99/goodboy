// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { expectedPort } from './expectedPort';

const SCANNED = [
  { port: 5005, label: 'dev', source: 'script' as const },
  { port: 4173, label: 'preview', source: 'script' as const },
  { port: 3000, label: 'PORT', source: 'env' as const },
];

describe('expectedPort', () => {
  it('reads the port a script names in its body', () => {
    expect(expectedPort({ scanned: SCANNED, scriptName: 'dev' })).toBe(5005);
  });

  it('ignores ports from other sources and unknown scripts', () => {
    expect(expectedPort({ scanned: SCANNED, scriptName: 'PORT' })).toBeNull();
    expect(expectedPort({ scanned: SCANNED, scriptName: 'start' })).toBeNull();
  });

  it('is null before the project is scanned', () => {
    expect(expectedPort({ scanned: undefined, scriptName: 'dev' })).toBeNull();
  });
});
