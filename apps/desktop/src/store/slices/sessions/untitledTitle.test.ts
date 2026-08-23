import { describe, expect, it } from 'vitest';
import { untitledSessionTitle } from './untitledTitle';

describe('untitledSessionTitle', () => {
  it('starts plain with no prior sessions', () => {
    expect(untitledSessionTitle([])).toBe('Untitled session');
  });

  it('ignores titles that are not untitled', () => {
    expect(untitledSessionTitle(['fix auth', 'ship the release'])).toBe('Untitled session');
  });

  it('numbers the second untitled session 2', () => {
    expect(untitledSessionTitle(['Untitled session'])).toBe('Untitled session 2');
  });

  it('continues past the highest existing ordinal', () => {
    expect(untitledSessionTitle(['Untitled session', 'Untitled session 4'])).toBe(
      'Untitled session 5',
    );
  });

  it('survives gaps left by deleted sessions', () => {
    expect(untitledSessionTitle(['Untitled session 7'])).toBe('Untitled session 8');
  });

  it('matches case-insensitively and trims whitespace', () => {
    expect(untitledSessionTitle(['  untitled session 2  '])).toBe('Untitled session 3');
  });

  it('never treats a prefixed title as untitled', () => {
    expect(untitledSessionTitle(['Untitled session cleanup'])).toBe('Untitled session');
  });
});
