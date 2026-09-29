import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fixture from './slug.fixture.json';
import { sha256Hex } from './sha256';
import { MAX_SLUG_LENGTH, nextAvailableSlug, slugify, withSlugSuffix } from './slugify';

type FixtureCase = {
  readonly name: string;
  readonly input: string;
  readonly maxLength?: number;
  readonly expected: string;
};

const cases: ReadonlyArray<FixtureCase> = fixture.cases;

describe('slugify shared fixture', () => {
  it('uses the same default budget as the fixture', () => {
    expect(MAX_SLUG_LENGTH).toBe(fixture.defaultMaxLength);
  });

  it.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    expect(slugify({ input: entry.input, maxLength: entry.maxLength ?? MAX_SLUG_LENGTH })).toBe(
      entry.expected,
    );
  });

  it('is idempotent for every case', () => {
    for (const entry of cases) {
      const max = entry.maxLength ?? MAX_SLUG_LENGTH;
      const once = slugify({ input: entry.input, maxLength: max });
      expect(slugify({ input: once, maxLength: max })).toBe(once);
    }
  });
});

describe('slugify fallback', () => {
  it('uses an explicit fallback instead of the hash when the input has no slug characters', () => {
    expect(slugify({ input: '***', fallback: 'session' })).toBe('session');
    expect(slugify({ input: '', fallback: '' })).toBe('');
  });

  it('ignores the fallback when the input has slug characters', () => {
    expect(slugify({ input: 'Fix It', fallback: 'session' })).toBe('fix-it');
  });
});

describe('sha256Hex', () => {
  it.each([
    '',
    'abc',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000),
    '日本語 🚀',
  ])('matches node for %#', (input) => {
    expect(sha256Hex(input)).toBe(createHash('sha256').update(input).digest('hex'));
  });
});

describe('withSlugSuffix', () => {
  it('cuts the base at a whole word to leave room for the suffix', () => {
    expect(
      withSlugSuffix({
        base: 'implement-extraordinarily-detailed-navigation-behavior',
        suffix: '12345678',
      }),
    ).toBe('implement-extraordinarily-detailed-12345678');
  });

  it('keeps a short base whole', () => {
    expect(withSlugSuffix({ base: 'fix-login', suffix: '2' })).toBe('fix-login-2');
  });

  it('never exceeds the slug budget', () => {
    const slug = withSlugSuffix({ base: 'x'.repeat(200), suffix: '99' });
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-99')).toBe(true);
  });
});

describe('nextAvailableSlug', () => {
  it('returns the base when the branch is free', () => {
    expect(nextAvailableSlug({ base: 'fix-login', prefix: 'ak', taken: ['ak/other'] })).toBe(
      'fix-login',
    );
  });

  it('takes the first free ordinal from 2', () => {
    expect(
      nextAvailableSlug({
        base: 'fix-login',
        prefix: 'ak',
        taken: ['ak/fix-login', 'ak/fix-login-2'],
      }),
    ).toBe('fix-login-3');
  });

  it('only collides within the same prefix', () => {
    expect(nextAvailableSlug({ base: 'fix-login', prefix: 'ak', taken: ['bo/fix-login'] })).toBe(
      'fix-login',
    );
  });

  it('falls back to a random suffix when every ordinal is taken', () => {
    const taken = [
      'ak/fix-login',
      ...Array.from({ length: 98 }, (_unused, index) => `ak/fix-login-${index + 2}`),
    ];
    expect(
      nextAvailableSlug({ base: 'fix-login', prefix: 'ak', taken, randomSuffix: () => 'abcd1234' }),
    ).toBe('fix-login-abcd1234');
  });
});
