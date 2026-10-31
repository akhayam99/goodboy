// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { columnPagesOf } from './pageRegistry';
import { SESSION_PAGE_INTRO } from './sessionPageIntro';

const MAX_WORDS = 14;
const MAX_CHARACTERS = 84;
const LINES = Object.values(SESSION_PAGE_INTRO).flat();
const DASH_CODES: ReadonlySet<number> = new Set([8211, 8212]);

describe('SESSION_PAGE_INTRO', () => {
  it('explains the one runs page of the session rail and no other page', () => {
    const runPages = columnPagesOf({ isBranchless: false })
      .map((page) => page.id)
      .filter((id) => id !== 'overview' && id !== 'artifacts');

    expect(Object.keys(SESSION_PAGE_INTRO)).toEqual(runPages);
  });

  it('gives the page one lede line', () => {
    expect(Object.values(SESSION_PAGE_INTRO).map((lines) => lines.length)).toEqual([1]);
  });

  it.each(LINES)('keeps "%s" one short sentence line', (line) => {
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
    expect(line.length).toBeLessThanOrEqual(MAX_CHARACTERS);
    expect(line).toMatch(/^[A-Z]/);
    expect(line).toMatch(/\.$/);
    expect([...line].some((char) => DASH_CODES.has(char.charCodeAt(0)))).toBe(false);
    expect(line).not.toMatch(/\b(I|we|our|let's)\b/i);
  });
});
