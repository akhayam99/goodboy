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
import { countAmbientReads } from './scanStateWrites';

const BASELINE_FILE = 'ambient-target.baseline.json';
const SLICE = 'apps/desktop/src/store/slices/x/y.ts';

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countAmbientReads({ path, text })]),
    ),
  });

describe('a store write names its target, it does not read the current one', () => {
  it('counts a read of the current workspace or the displayed mount inside a slice', () => {
    const count = (text: string) => countAmbientReads({ path: SLICE, text });
    expect(count('const id = get().currentWorkspaceId;')).toBe(1);
    expect(count('const { currentWorkspaceId } = get();')).toBe(1);
    expect(count('const path = state.diffMountPath?.[sessionId] ?? null;')).toBe(1);
    expect(count('const mount = selectActiveMount({ state, sessionId });')).toBe(1);
    expect(count('const path = resolveActiveMountPath({ state, sessionId });')).toBe(1);
  });

  it('leaves declarations, imports, state keys and strings alone', () => {
    const count = (text: string) => countAmbientReads({ path: SLICE, text });
    expect(count('  readonly currentWorkspaceId: WorkspaceId | null;')).toBe(0);
    expect(count("import { resolveActiveMountPath } from '../x';")).toBe(0);
    expect(count('  currentWorkspaceId: null,')).toBe(0);
    expect(count("  'providers' | 'currentWorkspaceId'")).toBe(0);
    expect(count('const selectActiveMount = ({ state }: Params) => state;')).toBe(0);
  });

  it('ignores files outside the store slices', () => {
    expect(
      countAmbientReads({
        path: 'apps/desktop/src/features/x/y.ts',
        text: 'const id = get().currentWorkspaceId;',
      }),
    ).toBe(0);
  });

  it('adds no ambient read beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Take the workspace from the session and the mount from the request (docs/typescript/state-writes.md). A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('fails when a file grows its count', () => {
    const grown = grownEntries({
      current: { [SLICE]: 2 },
      baseline: { [SLICE]: 1 },
    });
    expect(grown).toEqual([`  - ${SLICE}: 2 (baseline 1)`]);
  });
});
