// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { productSources } from './scanControls';

const KINDS_FOLDER = 'apps/desktop/src/features/actions/kinds/';
const RUN_BLOCK_START = /\brun:\s*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>\s*\{/g;
const FIRE_AND_FORGET = /\bvoid\s+(?!0\b)[A-Za-z_$]/g;

type TextParams = {
  readonly text: string;
};

type BlockParams = TextParams & {
  readonly open: number;
};

const blockEnd = ({ text, open }: BlockParams): number => {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      depth += 1;
      continue;
    }
    if (char !== '}') {
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return index;
    }
  }
  return text.length;
};

const runBlocksOf = ({ text }: TextParams): ReadonlyArray<string> =>
  [...text.matchAll(RUN_BLOCK_START)].map((match) => {
    const open = (match.index ?? 0) + match[0].length - 1;
    return text.slice(open, blockEnd({ text, open }) + 1);
  });

const unownedRunsOf = ({ text }: TextParams): number =>
  runBlocksOf({ text }).filter((block) => (block.match(FIRE_AND_FORGET) ?? []).length > 0).length;

describe('a registry action hands its work to the runner', () => {
  it('counts a run block that fires work with void and ignores one that awaits it', () => {
    const fired = 'run: ({ facts, env }) => {\n  void env.getState().archive(facts.id);\n},';
    const awaited =
      'run: async ({ facts, env }) => {\n  await env.getState().archive(facts.id);\n},';
    const returned = 'run: ({ facts, env }) => env.getState().archive(facts.id),';
    expect(unownedRunsOf({ text: fired })).toBe(1);
    expect(unownedRunsOf({ text: awaited })).toBe(0);
    expect(unownedRunsOf({ text: returned })).toBe(0);
  });

  it('keeps every async run awaited or returned, so its button shows busy and its failure', () => {
    const kinds = productSources().filter(({ path }) => path.startsWith(KINDS_FOLDER));
    const blockCount = kinds.reduce((sum, { text }) => sum + runBlocksOf({ text }).length, 0);
    expect(blockCount).toBeGreaterThan(20);
    const offenders = kinds
      .filter(({ text }) => unownedRunsOf({ text }) > 0)
      .map(({ path }) => path);
    expect(
      offenders,
      'Await or return the promise in run, so useActionControls owns the busy state and the failure line.',
    ).toEqual([]);
  });
});
