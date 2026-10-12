import { describe, expect, it } from 'vitest';
import { proposalOptionsOf } from './proposalOptionsOf';

describe('proposal options', () => {
  it.each([
    ['', 'empty text'],
    ['Change src/ledger.ts and run the suite.', 'one plain fix'],
    ['### Option A: Guard\nChange src/ledger.ts.\nRecommended: A', 'one option'],
    ['### Option A: One\nx\n### Option A: Again\ny', 'the same key twice'],
    ['```md\n### Option A: One\nx\n### Option B: Two\ny\n```', 'headings in a fenced block'],
    ['#### Option A: One\nx\n#### Option B: Two\ny', 'headings of another depth'],
  ])('reads no options from %#: %s', (text) => {
    expect(proposalOptionsOf({ text })).toBeNull();
  });
  it('reads two options with the recommended one and its reason', () => {
    expect(
      proposalOptionsOf({
        text: [
          'Both work.',
          '### Option A: Guard in the ledger',
          'Skip the credit in src/ledger.ts.',
          '### Option B: Dedupe the queue',
          'Drop repeats in src/retryQueue.ts.',
          'Recommended: B',
          'It keeps the ledger untouched.',
        ].join('\n'),
      }),
    ).toEqual({
      lead: 'Both work.',
      options: [
        { key: 'A', title: 'Guard in the ledger', body: 'Skip the credit in src/ledger.ts.' },
        { key: 'B', title: 'Dedupe the queue', body: 'Drop repeats in src/retryQueue.ts.' },
      ],
      recommendedKey: 'B',
      reason: 'It keeps the ledger untouched.',
    });
  });
  it('reads the reason that follows the key on the same line', () => {
    const result = proposalOptionsOf({
      text: '### Option A: One\nx\n### Option B: Two\ny\nRecommended: A, it is smaller.',
    });
    expect(result?.recommendedKey).toBe('A');
    expect(result?.reason).toBe('it is smaller.');
    expect(result?.options[1]?.body).toBe('y');
  });
  it('keeps every option and recommends none when the line is missing', () => {
    const result = proposalOptionsOf({
      text: '### Option A: One\nx\n### Option B: Two\ny\n### Option C: Three\nz',
    });
    expect(result?.options.map((option) => option.key)).toEqual(['A', 'B', 'C']);
    expect(result?.recommendedKey).toBeNull();
    expect(result?.reason).toBe('');
    expect(result?.options[2]?.body).toBe('z');
  });
  it('drops a recommendation that names a missing option and keeps its line out of the body', () => {
    const result = proposalOptionsOf({
      text: '### Option A: One\nx\n### Option B: Two\ny\nRecommended: C\nBecause.',
    });
    expect(result?.recommendedKey).toBeNull();
    expect(result?.reason).toBe('');
    expect(result?.options[1]?.body).toBe('y');
  });
  it('keeps code fences with headings inside an option body', () => {
    const result = proposalOptionsOf({
      text: [
        '### Option A: One',
        '```md',
        '### Option B: not an option',
        'Recommended: B',
        '```',
        '### Option B: Two',
        'y',
        'Recommended: A',
      ].join('\n'),
    });
    expect(result?.options.map((option) => option.key)).toEqual(['A', 'B']);
    expect(result?.options[0]?.body).toBe(
      '```md\n### Option B: not an option\nRecommended: B\n```',
    );
    expect(result?.recommendedKey).toBe('A');
  });
  it('accepts the localized heading as a fallback', () => {
    const result = proposalOptionsOf({
      text: '### Opzione A: Prima\nx\n### Opzione B: Seconda\ny\nConsigliata: B perche e piu piccola.',
    });
    expect(result?.options.map((option) => option.title)).toEqual(['Prima', 'Seconda']);
    expect(result?.recommendedKey).toBe('B');
    expect(result?.reason).toBe('perche e piu piccola.');
  });
  it('ignores a recommendation placed before the first option', () => {
    const result = proposalOptionsOf({
      text: 'Recommended: B\n### Option A: One\nx\n### Option B: Two\ny',
    });
    expect(result?.recommendedKey).toBeNull();
    expect(result?.lead).toBe('Recommended: B');
  });
  it('reads a hundred thousand characters', () => {
    const result = proposalOptionsOf({
      text: `${'x'.repeat(100_000)}\n### Option A: One\n${'y'.repeat(100_000)}\n### Option B: Two\nz\nRecommended: A`,
    });
    expect(result?.options).toHaveLength(2);
    expect(result?.options[0]?.body.length).toBe(100_000);
    expect(result?.lead.length).toBe(100_000);
  });
});
