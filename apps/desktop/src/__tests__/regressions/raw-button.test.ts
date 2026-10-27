// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const ALL_BASELINE = 'raw-button.baseline.json';
const ROW_BASELINE = 'raw-row-button.baseline.json';

type ButtonFamily = 'row' | 'tab' | 'chip' | 'link' | 'icon' | 'control';

const ROLE_TAB = /role="(?:tab|radio|menuitem|menuitemradio|option)"/;
const SHARED_ROW_STYLE = /ROW_INTERACTIVE|ROW_HOVER/;
const OWN_ROW_HOVER = /hover:bg-hover/;
const ROW_FRAME = /w-full|flex-1/;
const PILL = /rounded-full/;
const LINK = /underline|text-primary/;
const SQUARE = /\bsize-\d|\bh-\d+ w-\d+|\bw-\d+ h-\d+|aspect-square/;

const familyOf = ({ tag }: { readonly tag: string }): ButtonFamily => {
  if (ROLE_TAB.test(tag)) {
    return 'tab';
  }
  if (SHARED_ROW_STYLE.test(tag) || (OWN_ROW_HOVER.test(tag) && ROW_FRAME.test(tag))) {
    return 'row';
  }
  if (PILL.test(tag)) {
    return 'chip';
  }
  if (LINK.test(tag) && !OWN_ROW_HOVER.test(tag)) {
    return 'link';
  }
  if (SQUARE.test(tag)) {
    return 'icon';
  }
  return 'control';
};

const countFamilies = ({
  text,
  isOnlyRows,
}: {
  readonly text: string;
  readonly isOnlyRows: boolean;
}): number =>
  openingTags({ text, name: 'button' }).filter((tag) => !isOnlyRows || familyOf({ tag }) === 'row')
    .length;

const measure = ({ isOnlyRows }: { readonly isOnlyRows: boolean }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countFamilies({ text, isOnlyRows })]),
    ),
  });

describe('a clickable control comes from a primitive, and the raw buttons only fall', () => {
  it('sorts a raw button into the family that names its primitive', () => {
    expect(familyOf({ tag: `<button className={cn('flex w-full gap-2', ROW_INTERACTIVE)}>` })).toBe(
      'row',
    );
    expect(familyOf({ tag: '<button className="w-full hover:bg-hover text-left">' })).toBe('row');
    expect(familyOf({ tag: '<button role="tab" aria-selected={isActive}>' })).toBe('tab');
    expect(familyOf({ tag: `<button className="rounded-full border px-2">` })).toBe('chip');
    expect(familyOf({ tag: `<button className="text-primary hover:underline">` })).toBe('link');
    expect(familyOf({ tag: `<button className="size-6 rounded-md">` })).toBe('icon');
    expect(familyOf({ tag: `<button className="px-2">` })).toBe('control');
  });

  it('counts a raw button and leaves a primitive alone', () => {
    expect(countFamilies({ text: '<button type="button">Go</button>', isOnlyRows: false })).toBe(1);
    expect(
      countFamilies({
        text: '<SelectableRow selected={false}>Go</SelectableRow>',
        isOnlyRows: false,
      }),
    ).toBe(0);
    expect(
      countFamilies({ text: '<IconButton icon={X} label="Close" />', isOnlyRows: false }),
    ).toBe(0);
  });

  it('adds no raw button beyond the baseline, which only falls', () => {
    const current = measure({ isOnlyRows: false });
    if (IS_UPDATING) {
      writeBaseline({ file: ALL_BASELINE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: ALL_BASELINE }) });
    expect(
      grown,
      [
        'A clickable control is a primitive from @goodboy/ui: Button, IconButton,',
        'SelectableRow, InteractiveRow, SegmentedTabs, Chip or a link. A raw <button>',
        'carries none of the focus ring, the busy state or the tooltip rule. The',
        'baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });

  it('adds no raw row button beyond the baseline, which only falls', () => {
    const current = measure({ isOnlyRows: true });
    if (IS_UPDATING) {
      writeBaseline({ file: ROW_BASELINE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: ROW_BASELINE }) });
    expect(
      grown,
      [
        'A row you click is SelectableRow (one button) or InteractiveRow (a row that',
        'holds its own buttons). Both draw the hover, the selected fill and the focus',
        'ring once. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
