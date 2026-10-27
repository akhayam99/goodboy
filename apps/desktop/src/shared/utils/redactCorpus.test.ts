// @vitest-environment node
import { describe, expect, it } from 'vitest';
import corpus from '../../../src-tauri/src/util/redact_corpus.json';
import { redactReport } from './redactReport';
import { redactSecrets } from './redactSecrets';

describe('shared redaction corpus', () => {
  it('holds the same cases the Rust module is tested against', () => {
    expect(corpus.cases.length).toBeGreaterThan(20);
  });

  it.each(corpus.cases)('redactSecrets: $name', ({ input, leaks, keeps }) => {
    const out = redactSecrets({ text: input });
    for (const leak of leaks) {
      expect(out).not.toContain(leak);
    }
    for (const keep of keeps) {
      expect(out).toContain(keep);
    }
  });

  it.each(corpus.cases)('redactReport never leaks: $name', ({ input, leaks }) => {
    const out = redactReport({ text: input });
    for (const leak of leaks) {
      expect(out).not.toContain(leak);
    }
  });

  it('is idempotent', () => {
    const once = redactSecrets({
      text: 'Authorization: Bearer abcdefghijklmnop https://u:p@host/x',
    });
    expect(redactSecrets({ text: once })).toBe(once);
  });
});
