// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { DRAWER_EXIT_MS, DURATION_BASE_MS, DURATION_QUICK_MS, DURATION_SLOW_MS } from '@goodboy/ui';

const DESKTOP_SRC = join(__dirname, '..', '..');
const CSS = readFileSync(join(DESKTOP_SRC, 'styles.css'), 'utf8');
const DOC = readFileSync(
  join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'DESIGN-SYSTEM.md'),
  'utf8',
);

const TOKEN_LINE = /^\s*--(?:duration|delay|hold|loop|ease)-[a-z-]+:/;
const LITERAL_TIME = /(?<![\w.-])\d+(?:\.\d+)?(?:ms|s)\b/g;
const ZERO_TIMES = new Set(['0ms', '0.01ms']);
const WORD_OF_COUNT: Readonly<Record<number, string>> = {
  1: 'One',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
};

const keyframeNames = (): ReadonlyArray<string> =>
  [...CSS.matchAll(/@keyframes\s+([a-z-]+)/g)].map((match) => match[1] ?? '');

const registrySection = (): string => {
  const start = DOC.indexOf('## Motion registry');
  const rest = DOC.slice(start + 1);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
};

const transitionNames = (): ReadonlyArray<string> => {
  const section = registrySection();
  const start = section.indexOf('Transition keyframes (');
  const end = section.indexOf(') move content', start);
  return [...section.slice(start, end).matchAll(/`([a-z-]+)`/g)].map((match) => match[1] ?? '');
};

const tokenMs = (name: string): number => {
  const match = new RegExp(`${name}:\\s*(\\d+)ms`).exec(CSS);
  return Number(match?.[1] ?? Number.NaN);
};

const outsideTokens = (): ReadonlyArray<string> =>
  CSS.split('\n').filter((line) => !TOKEN_LINE.test(line));

describe('the motion registry names every keyframe and only those', () => {
  it('finds a keyframe set and a transition list to compare', () => {
    expect(keyframeNames().length).toBeGreaterThan(20);
    expect(transitionNames().length).toBeGreaterThan(20);
  });

  it('defines each keyframe once', () => {
    const names = keyframeNames();
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it('names every @keyframes of styles.css in the Motion registry section', () => {
    const section = registrySection();
    const missing = keyframeNames().filter((name) => !section.includes(`\`${name}\``));
    expect(missing).toEqual([]);
  });

  it('lists no transition keyframe that styles.css does not define', () => {
    const defined = new Set(keyframeNames());
    expect(transitionNames().filter((name) => !defined.has(name))).toEqual([]);
  });

  it('counts the meaning animations as the keyframes left outside the transition list', () => {
    const transitions = new Set(transitionNames());
    const meaning = keyframeNames().filter((name) => !transitions.has(name));
    expect(meaning.sort()).toEqual(['cost-tick', 'soft-pulse', 'spin-border', 'text-shimmer']);
    expect(registrySection()).toContain(`${WORD_OF_COUNT[meaning.length]} animations, one meaning`);
  });

  it('keeps the skeleton on the soft-pulse keyframes', () => {
    expect(CSS).toMatch(/--animate-pulse:\s*soft-pulse\s+var\(--loop-pulse\)/);
  });
});

describe('time is three durations and two curves', () => {
  it('pins each duration token to its constant in packages/ui', () => {
    expect(tokenMs('--duration-quick')).toBe(DURATION_QUICK_MS);
    expect(tokenMs('--duration-base')).toBe(DURATION_BASE_MS);
    expect(tokenMs('--duration-slow')).toBe(DURATION_SLOW_MS);
    expect(DRAWER_EXIT_MS).toBe(DURATION_QUICK_MS);
  });

  it('holds exactly two cubic-bezier curves, both in the token block', () => {
    const curves = CSS.match(/cubic-bezier\([^)]*\)/g) ?? [];
    expect(curves.sort()).toEqual(['cubic-bezier(0.2, 0, 0, 1)', 'cubic-bezier(0.4, 0, 1, 1)']);
    expect(outsideTokens().filter((line) => line.includes('cubic-bezier'))).toEqual([]);
  });

  it('writes no literal duration or delay outside the token block', () => {
    const offenders = outsideTokens().filter((line) =>
      (line.match(LITERAL_TIME) ?? []).some((time) => !ZERO_TIMES.has(time)),
    );
    expect(offenders).toEqual([]);
  });
});

describe('a looping sign survives a hidden window and forced colors', () => {
  it('pauses every animation under the hidden-window attribute', () => {
    expect(CSS).toMatch(
      /html\[data-window-hidden\] \*,[\s\S]*?\{\s*animation-play-state:\s*paused !important;/,
    );
  });

  it('gives the pulsing dot, the pulsing arc and the spin ring a system colour', () => {
    const start = CSS.indexOf('@media (forced-colors: active)');
    expect(start).toBeGreaterThan(-1);
    const block = CSS.slice(start, CSS.indexOf('\n}\n', start));
    expect(block).toContain("[class*='animate-soft-pulse'][class*='bg-']");
    expect(block).toContain('background-color: Highlight');
    expect(block).toContain("[class*='animate-soft-pulse'][class*='fill-']");
    expect(block).toContain('fill: Highlight');
    expect(block).toContain('.spin-border::before');
    expect(block).toContain('--spin-border-color: Highlight');
  });
});
