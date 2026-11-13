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

const BASELINE_FILE = 'empty-before-loaded.baseline.json';

const EMPTY_STATE = /<(?:EmptyState|EmptyLine)\b/;
const DATA_READ =
  /\b(?:useAppStore|useEffect|invoke\w*|load[A-Z]\w*|refresh[A-Z]\w*|fetch[A-Z]?\w*|scan[A-Z]\w*)\b/;
const LOADED_SIGNAL =
  /\b(?:is|are|has|was)[A-Za-z]*(?:Loaded|Loading|Pending|Measuring|Checking|Ready)\b|\b(?:loaded|loading|pending|isReady|boardReady)\b|status === '(?:loading|measuring|idle)'|Skeleton|SkeletonSwap|useIsSessionCollectionLoaded/;

const SHELL_SESSION_REGIONS = [
  'apps/desktop/src/features/workspace/components/StageBoard/index.tsx',
  'apps/desktop/src/features/session/components/SessionNavSidebar/index.tsx',
];

const READS_BOARD_READY = /\bs\.boardReady\b/;

type TextParams = {
  readonly text: string;
};

const countEmptyBeforeLoaded = ({ text }: TextParams): number =>
  EMPTY_STATE.test(text) && DATA_READ.test(text) && !LOADED_SIGNAL.test(text) ? 1 : 0;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countEmptyBeforeLoaded({ text })]),
    ),
  });

describe('an empty state never draws before its data is loaded', () => {
  it('counts a file that reads data and draws an empty state with no loaded signal', () => {
    const empty = '<EmptyState title="No agents yet" />';
    expect(countEmptyBeforeLoaded({ text: `${empty} void loadAgents(sessionId);` })).toBe(1);
    expect(
      countEmptyBeforeLoaded({
        text: `${empty} void loadAgents(sessionId); const isLoaded = true;`,
      }),
    ).toBe(0);
    expect(
      countEmptyBeforeLoaded({
        text: `${empty} void loadAgents(); <SkeletonRow label="Loading" />`,
      }),
    ).toBe(0);
    expect(countEmptyBeforeLoaded({ text: `${empty}` })).toBe(0);
    expect(countEmptyBeforeLoaded({ text: 'void loadAgents(sessionId);' })).toBe(0);
  });

  it('keeps every shell region that lists sessions on its skeleton until the sessions land', () => {
    const textByPath = new Map(productSources().map(({ path, text }) => [path, text]));
    const missing = SHELL_SESSION_REGIONS.filter((path) => !textByPath.has(path));
    const ungated = SHELL_SESSION_REGIONS.filter(
      (path) => !READS_BOARD_READY.test(textByPath.get(path) ?? ''),
    );

    expect(missing, 'A shell region moved. Point this list at its new file.').toEqual([]);
    expect(
      ungated,
      [
        'The shell shows before the sessions land, so a region that lists sessions',
        'draws a skeleton, never an empty state, until boardReady is true.',
      ].join('\n'),
    ).toEqual([]);
  });

  it('adds no file beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'An empty state may draw only in a branch that also names a loaded flag.',
        'Gate it on the load, with a skeleton before it. The baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
