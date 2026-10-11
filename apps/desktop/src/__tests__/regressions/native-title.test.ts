// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  domOpeningTags,
  grownEntries,
  hasTopLevelAttribute,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'native-title.baseline.json';

const countNativeTitles = ({ text }: { readonly text: string }): number =>
  domOpeningTags({ text }).filter(
    (tag) => !tag.startsWith('<iframe') && hasTopLevelAttribute({ tag, attribute: 'title' }),
  ).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countNativeTitles({ text })]),
    ),
  });

describe('a DOM node says what it is through Tooltip, never a native title', () => {
  it('counts a title on a lowercase element and leaves a component prop alone', () => {
    expect(countNativeTitles({ text: '<button type="button" title="Open">x</button>' })).toBe(1);
    expect(countNativeTitles({ text: '<span\n  title={`${name} (${id})`}\n>x</span>' })).toBe(1);
    expect(countNativeTitles({ text: '<Section title="Open" />' })).toBe(0);
    expect(countNativeTitles({ text: '<svg><title>Chart</title></svg>' })).toBe(0);
    expect(countNativeTitles({ text: '<div data-x={{ title: 1 }} className="a" />' })).toBe(0);
    expect(countNativeTitles({ text: '<div aria-title="x" />' })).toBe(0);
    expect(countNativeTitles({ text: '<iframe title="Preview of the page" src={url} />' })).toBe(0);
  });

  it('adds no native title beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A native title waits a second and renders in the OS chrome. Wrap the control',
        'in Tooltip (or use IconButton) so it names itself the same way everywhere,',
        'and put cut text behind TruncatedText so the tooltip shows only when the',
        'text is actually cut. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
