// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { columnPagesOf } from './pageRegistry';
import { pageMarkerOf } from './pageMarkerOf';
import { SESSION_PAGE_INTRO, SESSION_PAGE_MARKER_WHY } from './sessionPageIntro';

const MAX_WORDS = 14;
const MAX_CHARACTERS = 84;
const LINES = Object.values(SESSION_PAGE_INTRO).flat();
const DASH_CODES: ReadonlySet<number> = new Set([8211, 8212]);

describe('SESSION_PAGE_INTRO', () => {
  it('explains the four run pages of the session rail and no other page', () => {
    const runPages = columnPagesOf({ isBranchless: false, hasAutoAgents: true })
      .map((page) => page.id)
      .filter((id) => id !== 'overview' && id !== 'artifacts');

    expect(Object.keys(SESSION_PAGE_INTRO)).toEqual(runPages);
  });

  it('gives every page two lines', () => {
    expect(Object.values(SESSION_PAGE_INTRO).map((lines) => lines.length)).toEqual([2, 2, 2, 2]);
  });

  it.each(LINES)('keeps "%s" one short sentence line', (line) => {
    expect(line.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
    expect(line.length).toBeLessThanOrEqual(MAX_CHARACTERS);
    expect(line).toMatch(/^[A-Z]/);
    expect(line).toMatch(/\.$/);
    expect([...line].some((char) => DASH_CODES.has(char.charCodeAt(0)))).toBe(false);
    expect(line).not.toMatch(/\b(I|we|our|let's)\b/i);
  });

  it('says what the Experimental marker on Auto agents says', () => {
    const marker = pageMarkerOf({ pageId: 'auto' });

    expect(marker?.why).toContain(SESSION_PAGE_INTRO.auto[1].split('. ')[1]);
    expect(SESSION_PAGE_INTRO.auto[1]).toContain('under a limit');
  });

  it.each(Object.entries(SESSION_PAGE_MARKER_WHY))(
    'keeps the %s marker tooltip one short line of sentence case',
    (_page, why) => {
      expect(why.split(/\s+/).length).toBeLessThanOrEqual(MAX_WORDS);
      expect(why.length).toBeLessThanOrEqual(MAX_CHARACTERS);
      expect(why).toMatch(/^[A-Z]/);
      expect(why).toMatch(/\.$/);
      expect([...why].some((char) => DASH_CODES.has(char.charCodeAt(0)))).toBe(false);
      expect(why).not.toMatch(/\b(I|we|our|let's)\b/i);
    },
  );
});
