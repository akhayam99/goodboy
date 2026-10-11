// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { expectedPort } from './expectedPort';

const SCANNED = [
  { port: 5005, label: 'dev', source: 'script' as const, relDir: '' },
  { port: 4173, label: 'preview', source: 'script' as const, relDir: '' },
  { port: 3000, label: 'PORT', source: 'env' as const, relDir: '' },
];

describe('expectedPort', () => {
  it('reads the port a script names in its body', () => {
    expect(expectedPort({ scanned: SCANNED, scriptName: 'dev', relDir: '' })).toBe(5005);
  });

  it('ignores ports from other sources and unknown scripts', () => {
    expect(expectedPort({ scanned: SCANNED, scriptName: 'PORT', relDir: '' })).toBeNull();
    expect(expectedPort({ scanned: SCANNED, scriptName: 'start', relDir: '' })).toBeNull();
  });

  it('is null before the project is scanned', () => {
    expect(expectedPort({ scanned: undefined, scriptName: 'dev', relDir: '' })).toBeNull();
  });

  it('gives a root script and a same-named workspace script their own ports', () => {
    const scanned = [
      { port: 5173, label: 'dev', source: 'script' as const, relDir: '' },
      { port: 5174, label: 'dev', source: 'script' as const, relDir: 'apps/web' },
    ];
    expect(expectedPort({ scanned, scriptName: 'dev', relDir: '' })).toBe(5173);
    expect(expectedPort({ scanned, scriptName: 'dev', relDir: 'apps/web' })).toBe(5174);
    expect(expectedPort({ scanned, scriptName: 'dev', relDir: 'apps/api' })).toBeNull();
  });
});
