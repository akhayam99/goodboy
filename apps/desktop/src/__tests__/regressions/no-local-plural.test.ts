// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'no-local-plural.baseline.json';
const LOCAL_PLURAL = /^(?:export )?(?:const|function) plural\s*(?:=|\()/gm;
const OWNER = 'apps/desktop/src/shared/utils/countNoun.ts';

type TextParams = {
  readonly text: string;
};

const localPluralsIn = ({ text }: TextParams): number => [...text.matchAll(LOCAL_PLURAL)].length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter((source) => source.path !== OWNER)
        .map((source) => [source.path, localPluralsIn({ text: source.text })]),
    ),
  });

describe('a count and its noun come from countNoun, never from a local plural helper', () => {
  it('finds a private or exported plural helper and ignores other names', () => {
    const text = [
      'const plural = ({ count }: Params): string => String(count);',
      'export const plural = (count: number) => count;',
      'function plural(count: number): string {',
      '  return String(count);',
      '}',
      'const pluralWord = () => 1;',
      'const isPlural = true;',
    ].join('\n');
    expect(localPluralsIn({ text })).toBe(3);
  });

  it('lets no file keep more local plural helpers than its baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Two helpers that build "1 thing" and "2 things" can disagree on one page. Use countNoun from ${OWNER}. The baseline only falls.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
