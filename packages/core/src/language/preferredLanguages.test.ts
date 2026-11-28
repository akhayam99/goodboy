import { describe, expect, it } from 'vitest';
import { PREFERRED_LANGUAGES, parsePreferredLanguage } from './preferredLanguages';

describe('parsePreferredLanguage', () => {
  it('reads a known code', () => {
    expect(parsePreferredLanguage({ raw: 'it' })).toBe('it');
  });

  it('treats a missing or unknown value as Auto', () => {
    expect(parsePreferredLanguage({ raw: null })).toBeNull();
    expect(parsePreferredLanguage({ raw: undefined })).toBeNull();
    expect(parsePreferredLanguage({ raw: 'xx' })).toBeNull();
  });

  it('labels each language by its native name', () => {
    expect(PREFERRED_LANGUAGES.find((language) => language.code === 'de')?.nativeName).toBe(
      'Deutsch',
    );
  });
});
