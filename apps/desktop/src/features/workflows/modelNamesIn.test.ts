import { describe, expect, it } from 'vitest';
import { modelNamesIn } from './modelNamesIn';

describe('modelNamesIn', () => {
  it('names a provider and model id in parentheses by its display name', () => {
    const text = modelNamesIn({ text: 'usage limit reached (anthropic/haiku-4.5)' });

    expect(text.startsWith('usage limit reached (')).toBe(true);
    expect(text).not.toContain('anthropic/');
  });

  it('leaves paths, links and plain words alone', () => {
    const text = 'could not read src/ledger/export.ts (see https://example.com/a)';

    expect(modelNamesIn({ text })).toBe(text);
  });
});
