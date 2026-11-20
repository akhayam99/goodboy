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

const BASELINE_FILE = 'pane-head-rows.baseline.json';
const HEADS: ReadonlyArray<string> = ['PaneShell', 'PageHeader'];
const TOOL_IN_TITLE_ROW =
  /<(?:[A-Z][A-Za-z0-9]*)?(?:Search|Filter|GroupBy)[A-Za-z0-9]*(?![A-Za-z0-9])|<(?:SegmentedTabs|Listbox)(?![A-Za-z0-9])/g;

type TextParams = {
  readonly text: string;
};

type SlotParams = {
  readonly tag: string;
  readonly name: string;
};

const slotOf = ({ tag, name }: SlotParams): string => {
  const start = tag.indexOf(`${name}={`);
  if (start === -1) {
    return '';
  }
  let depth = 0;
  for (let cursor = start + name.length + 1; cursor < tag.length; cursor += 1) {
    const char = tag[cursor];
    depth += char === '{' ? 1 : char === '}' ? -1 : 0;
    if (depth === 0) {
      return tag.slice(start, cursor + 1);
    }
  }
  return tag.slice(start);
};

const countToolsInTitleRow = ({ text }: TextParams): number =>
  HEADS.flatMap((name) => openingTags({ text, name }))
    .map((tag) => slotOf({ tag, name: 'actions' }))
    .reduce((sum, slot) => sum + (slot.match(TOOL_IN_TITLE_ROW) ?? []).length, 0);

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(({ path }) => !path.includes('/MockScene/'))
        .map(({ path, text }) => [path, countToolsInTitleRow({ text })]),
    ),
  });

describe('a page head is two rows: the title row, then the tool row', () => {
  it('counts a search, a filter or a group control in the title row', () => {
    expect(
      countToolsInTitleRow({
        text: '<PaneShell title="Monitoring" actions={<HeaderActions secondary={<SearchField value={query} />} />}>',
      }),
    ).toBe(1);
    expect(
      countToolsInTitleRow({
        text: '<PaneShell title="Tasks" actions={<Button>New task</Button>} toolbar={<SearchField value={query} />}>',
      }),
    ).toBe(0);
    expect(
      countToolsInTitleRow({
        text: '<PageHeader title="Artifacts" actions={<><SegmentedTabs value={kind} /><FilterButton count={2} /></>} />',
      }),
    ).toBe(2);
    expect(
      countToolsInTitleRow({
        text: '<PaneShell page="artifacts" actions={<><ArtifactFilterTabs value={filter} /><GroupBySwitch value={by} /><ArtifactNewMenu /></>}>',
      }),
    ).toBe(2);
  });

  it('puts no tool in the title row beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'The title row holds the title, the meta line, at most one primary action and the',
        'overflow menu. Search, scope, filter and group sit in the tool row under it, in that',
        'order, through the toolbar slot (packages/ui/design/layout.md, Pane anatomy).',
        'The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
