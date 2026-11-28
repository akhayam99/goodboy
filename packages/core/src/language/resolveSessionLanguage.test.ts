import { describe, expect, it } from 'vitest';
import { isInSessionLanguage, resolveSessionLanguage } from './resolveSessionLanguage';

const ITALIAN = 'Il selettore di lingua deve vivere nelle impostazioni della sessione';
const SPANISH = 'El selector de idioma debe vivir en los ajustes de la sesión';

describe('resolveSessionLanguage', () => {
  it('detects the language of the anchor on Auto', () => {
    expect(resolveSessionLanguage({ anchorText: ITALIAN })).toEqual({
      kind: 'detected',
      name: 'Italian',
    });
  });

  it('stays open when nothing is set and the anchor is too short', () => {
    expect(resolveSessionLanguage({ anchorText: 'Fix it' })).toEqual({ kind: 'open' });
  });

  it('lets a set language win over a Spanish anchor', () => {
    expect(resolveSessionLanguage({ preferred: 'it', anchorText: SPANISH })).toEqual({
      kind: 'preferred',
      name: 'Italian',
    });
  });

  it('names a language the detector does not know', () => {
    expect(resolveSessionLanguage({ preferred: 'ja' })).toEqual({
      kind: 'preferred',
      name: 'Japanese',
    });
  });
});

describe('isInSessionLanguage', () => {
  it('rejects a Spanish text when Italian is set', () => {
    expect(isInSessionLanguage({ preferred: 'it', text: SPANISH })).toBe(false);
  });

  it('accepts an Italian text when Italian is set', () => {
    expect(isInSessionLanguage({ preferred: 'it', text: ITALIAN })).toBe(true);
  });

  it('accepts a text it cannot place', () => {
    expect(isInSessionLanguage({ preferred: 'it', text: 'Fix it' })).toBe(true);
  });
});
