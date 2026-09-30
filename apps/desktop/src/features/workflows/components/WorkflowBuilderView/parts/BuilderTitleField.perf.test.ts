import { describe, expect, it } from 'vitest';
import { joinTitleLines } from './BuilderTitleField';

const BUDGET_MS = 200;

describe('joinTitleLines, performance', () => {
  it('answers quickly on a long run of whitespace', () => {
    const started = performance.now();
    joinTitleLines({ text: `${' '.repeat(50_000)}\n${' '.repeat(50_000)}x` });
    expect(performance.now() - started).toBeLessThan(BUDGET_MS);
  });
});
