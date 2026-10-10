import { describe, expect, it, vi } from 'vitest';
import {
  discoverHelperNames,
  HOSTILE_BUDGET_MS,
  HOSTILE_LENGTH,
  helperNamesIn,
  hostileInputsOf,
  loadHelpers,
  slowRuns,
  sweepHelper,
} from './test/hostileSweep';

const busyWait = ({ ms }: { readonly ms: number }): void => {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    continue;
  }
};

describe('the hostile input sweep', () => {
  it('finds exported parse, slug, sanitize, normalize and strip helpers by name', () => {
    const source = [
      'export const parseThing = () => 1;',
      'export function slugOf() {}',
      'export const sanitizeBody = () => 2;',
      'export const normalizeRole = () => 3;',
      'export const stripPrefix = () => 4;',
      'const parseHidden = () => 5;',
      'export const renderThing = () => 6;',
    ].join('\n');
    expect(helperNamesIn({ source })).toEqual([
      'parseThing',
      'slugOf',
      'sanitizeBody',
      'normalizeRole',
      'stripPrefix',
    ]);
  });

  it('discovers the helpers the package is known to ship', () => {
    const found = discoverHelperNames().map(({ name }) => name);
    expect(found).toEqual(
      expect.arrayContaining([
        'slugify',
        'parseCliVersion',
        'parseArtifactEnvelope',
        'stripGitlabDraftPrefix',
        'normalizeDecisionText',
      ]),
    );
  });

  it('loads every discovered helper as a callable function, leaving only constants out', async () => {
    const loaded = new Set((await loadHelpers()).map(({ name }) => name));
    const skipped = discoverHelperNames()
      .map(({ name }) => name)
      .filter((name) => !loaded.has(name));
    expect(skipped.filter((name) => !/^[A-Z][A-Z0-9_]*$/.test(name))).toEqual([]);
  });

  it('feeds each helper inputs of a hundred thousand characters', () => {
    const inputs = hostileInputsOf();
    expect(inputs.length).toBeGreaterThan(10);
    expect(inputs.every(({ input }) => input.length >= HOSTILE_LENGTH)).toBe(true);
  });

  it('flags a helper that takes 300ms on the hostile string', async () => {
    const runs = await sweepHelper({
      helper: { name: 'parseSlow', fn: () => busyWait({ ms: 300 }) },
      inputs: [{ unit: 'a', input: 'a'.repeat(HOSTILE_LENGTH) }],
    });
    const slow = slowRuns({ runs, budgetMs: HOSTILE_BUDGET_MS });
    expect(slow.map(({ helper, style }) => `${helper} ${style}`)).toEqual([
      'parseSlow string',
      'parseSlow params',
    ]);
  });

  it('does not flag a helper that returns at once', async () => {
    const runs = await sweepHelper({
      helper: { name: 'parseFast', fn: () => 1 },
      inputs: [{ unit: 'a', input: 'a'.repeat(HOSTILE_LENGTH) }],
    });
    expect(slowRuns({ runs, budgetMs: 10_000 })).toEqual([]);
  });

  it('runs every helper to the end on every hostile input', async () => {
    const silence = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const helpers = await loadHelpers();
    const inputs = hostileInputsOf();
    const finished = await Promise.all(helpers.map((helper) => sweepHelper({ helper, inputs })));
    silence.mockRestore();
    expect(finished.map((runs) => runs.length)).toEqual(helpers.map(() => inputs.length * 2));
  });
});
