import { describe, expect, it } from 'vitest';
import { typedAddressOf } from './typedAddressOf';

describe('typedAddressOf', () => {
  it('takes an address with a scheme, a loopback host or a real host with a port or path', () => {
    expect(typedAddressOf({ text: 'https://harborline.dev' })).toBe('https://harborline.dev/');
    expect(typedAddressOf({ text: 'localhost:5173' })).toBe('http://localhost:5173/');
    expect(typedAddressOf({ text: 'docs.harborline.dev/tax' })).toBe(
      'https://docs.harborline.dev/tax',
    );
    expect(typedAddressOf({ text: 'harborline.dev:8443' })).toBe('https://harborline.dev:8443/');
  });

  it('leaves a bare host to the search', () => {
    expect(typedAddressOf({ text: 'harborline.dev' })).toBeNull();
  });

  it('leaves a file name with a line or a path to the search', () => {
    expect(typedAddressOf({ text: 'foo.ts:42' })).toBeNull();
    expect(typedAddressOf({ text: 'plan.md/x' })).toBeNull();
    expect(typedAddressOf({ text: 'notes.json:3' })).toBeNull();
  });

  it('keeps a file name that carries a scheme', () => {
    expect(typedAddressOf({ text: 'http://plan.md/x' })).toBe('http://plan.md/x');
  });
});
