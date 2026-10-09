// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  countMatches,
  grownEntries,
  nonZero,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'control-heights.baseline.json';
const HEIGHT_TOKEN = /(?<![\w-])(?:h|size)-[5-8](?![\w.-])/g;
const CONTROL_TAGS = ['button', 'Button', 'IconButton'] as const;

const OWNERS: ReadonlyArray<readonly [string, string]> = [
  [
    'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane/index.tsx',
    'd5-overview',
  ],
  ['apps/desktop/src/features/session/components/AgentDetailPane/', 'd6-agent-lists'],
  ['apps/desktop/src/features/session/components/NeedsYouBlock', 'd6-agent-lists'],
];

const ownerOf = ({ path }: { readonly path: string }): string =>
  OWNERS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'c6-sweep';

const heightOverrides = ({ text }: { readonly text: string }): number =>
  CONTROL_TAGS.flatMap((name) => openingTags({ text, name })).reduce(
    (total, tag) => total + countMatches({ text: tag, pattern: HEIGHT_TOKEN }),
    0,
  );

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, heightOverrides({ text })]),
    ),
  });

describe('control heights come from the size prop', () => {
  it('counts a height class on a button and leaves a min-height alone', () => {
    expect(heightOverrides({ text: '<button className="h-6 px-2">x</button>' })).toBe(1);
    expect(heightOverrides({ text: '<IconButton size="xs" className="size-7" />' })).toBe(1);
    expect(heightOverrides({ text: '<Button className={cn("min-h-6", "h-5")}>x</Button>' })).toBe(
      1,
    );
    expect(heightOverrides({ text: '<div className="h-6" />' })).toBe(0);
    expect(heightOverrides({ text: '<button className="size-4">x</button>' })).toBe(0);
  });

  it('adds no height override to a button, icon button or Button beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const grown = grownEntries({ current, baseline }).map(
      (line) =>
        `${line} (owner ${ownerOf({ path: line.replace('  - ', '').split(':')[0] ?? '' })})`,
    );
    expect(
      grown,
      `A control takes its height from Button, IconButton or the bar contract (24, 28, 32), never from a class on the element. Use the size prop.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
