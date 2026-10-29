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

const BASELINE_FILE = 'reading-order.baseline.json';

const SCOPES = ['apps/desktop/src/features/chat/', 'apps/desktop/src/features/auto/'];
const RENDERER = 'apps/desktop/src/features/chat/readingOrder/';
const RAW_MARKDOWN = /<Markdown(?![\w])/g;

const countRawMarkdown = ({ text }: { readonly text: string }): number =>
  [...text.matchAll(RAW_MARKDOWN)].length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(
          ({ path }) =>
            SCOPES.some((scope) => path.startsWith(scope)) && !path.startsWith(RENDERER),
        )
        .map(({ path, text }) => [path, countRawMarkdown({ text })]),
    ),
  });

describe('agent prose is drawn by the reading order renderer, not by a raw Markdown', () => {
  it('counts a Markdown element and leaves a longer component name alone', () => {
    expect(countRawMarkdown({ text: '<Markdown text={note} />' })).toBe(1);
    expect(countRawMarkdown({ text: '<Markdown text={a} /><Markdown text={b} />' })).toBe(2);
    expect(countRawMarkdown({ text: '<MarkdownPreview text={note} />' })).toBe(0);
    expect(countRawMarkdown({ text: '<ReadingOrderMessage text={note} />' })).toBe(0);
  });

  it('adds no raw Markdown under features/chat or features/auto, and the baseline only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'Agent output reads in one order: outcome line, artifact cards, next action, chips,',
        'then folded notes. Draw prose through ReadingOrderMessage in features/chat/readingOrder',
        'so the budgets in readingBudgets.ts apply. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
