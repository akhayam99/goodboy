// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { addressOf } from './addressOf';
import { addressTextOf } from './addressTextOf';

describe('addressTextOf', () => {
  it('shows a file address as its path', () => {
    expect(addressTextOf({ url: 'file:///work/harborline/plan%20v2.html' })).toBe(
      '/work/harborline/plan v2.html',
    );
    expect(addressTextOf({ url: 'https://acme.example/' })).toBe('https://acme.example/');
  });

  it('shows a drive file address as a drive path that opens again', () => {
    const shown = addressTextOf({ url: 'file:///C:/work/harborline/plan.html' });
    expect(shown).toBe('C:/work/harborline/plan.html');
    expect(addressOf({ text: shown })).toEqual({ kind: 'local', path: shown });
  });
});
