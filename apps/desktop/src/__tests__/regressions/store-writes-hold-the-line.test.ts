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
import {
  countCatchReturns,
  countOptionalMountParams,
  countSessionAmbientReads,
  hasSetBeforeAwait,
} from './scanStateWrites';

const SLICE = 'apps/desktop/src/store/slices/x/y.ts';
const RUNTIME = 'apps/desktop/src/store/runtime/x/y.ts';
const FEATURE = 'apps/desktop/src/features/x/y.ts';

type CountParams = {
  readonly path: string;
  readonly text: string;
};

type Rule = {
  readonly name: string;
  readonly file: string;
  readonly count: (params: CountParams) => number;
  readonly hint: string;
};

const RULES: ReadonlyArray<Rule> = [
  {
    name: 'a write names its session, project or agent',
    file: 'ambient-target-session.baseline.json',
    count: countSessionAmbientReads,
    hint: 'Take the session, the project or the agent from the request, not from currentSessionId, selectedAgentId or activeProjectId (docs/typescript/state-writes.md, rule 1).',
  },
  {
    name: 'a slice applies state after the async step, not before',
    file: 'set-before-await.baseline.json',
    count: ({ path, text }) => (hasSetBeforeAwait({ path, text }) ? 1 : 0),
    hint: 'Apply state only after the async step succeeded; commitAfterConfirm does it for you (docs/typescript/state-writes.md, rule 2).',
  },
  {
    name: 'a store action takes a required mount',
    file: 'optional-mount-param.baseline.json',
    count: countOptionalMountParams,
    hint: 'A write verb takes the mount it acts on as a required mountId, never an optional one that falls back to the active mount (docs/typescript/state-writes.md, rule 1).',
  },
  {
    name: 'a failure is reported, not returned away by an empty catch',
    file: 'catch-return.baseline.json',
    count: countCatchReturns,
    hint: 'Report the failure through reportError or commitAfterConfirm instead of catch and return (docs/typescript/state-writes.md, rule 2).',
  },
];

const measure = ({ rule }: { readonly rule: Rule }): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, rule.count({ path, text })]),
    ),
  });

describe('the store write rules hold the line', () => {
  it('counts a read of the current session, project or agent inside a slice or the runtime', () => {
    const count = (text: string) => countSessionAmbientReads({ path: SLICE, text });
    expect(count('const id = get().currentSessionId;')).toBe(1);
    expect(count('const agentId = state.selectedAgentId[sessionId];')).toBe(1);
    expect(count('const { activeProjectId } = get();')).toBe(1);
    expect(count('  selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },')).toBe(1);
    expect(count('  selectedAgentId: {},')).toBe(0);
    expect(count("import { selectedAgentId } from '../x';")).toBe(0);
    expect(count("const label = 'currentSessionId';")).toBe(0);
    expect(countSessionAmbientReads({ path: RUNTIME, text: 'get().currentSessionId' })).toBe(1);
    expect(countSessionAmbientReads({ path: FEATURE, text: 'get().currentSessionId' })).toBe(0);
  });

  it('flags a file that sets state before its first await, and only that', () => {
    const has = (text: string) => hasSetBeforeAwait({ path: SLICE, text });
    expect(has('set({ a: 1 });\nawait save();')).toBe(true);
    expect(has('await save();\nset({ a: 1 });')).toBe(false);
    expect(has('set({ a: 1 });')).toBe(false);
    expect(has('await save();')).toBe(false);
    expect(has("const note = 'set(';\nawait save();")).toBe(false);
    expect(has('state.reset(1);\nawait save();')).toBe(false);
    expect(hasSetBeforeAwait({ path: FEATURE, text: 'set({ a: 1 });\nawait save();' })).toBe(false);
  });

  it('counts an optional mount, in an options bag or a parameter', () => {
    const count = (text: string) => countOptionalMountParams({ path: SLICE, text });
    expect(count('  readonly mountId?: MountId;')).toBe(1);
    expect(count('async (sessionId: SessionId, mountId?: MountId) => {')).toBe(1);
    expect(count('  readonly mountId: MountId;')).toBe(0);
    expect(count('  readonly mountId: MountId | null;')).toBe(0);
    expect(countOptionalMountParams({ path: FEATURE, text: 'mountId?: MountId' })).toBe(0);
  });

  it('counts a catch that only returns', () => {
    const count = (text: string) => countCatchReturns({ path: SLICE, text });
    expect(count('try { await run(); } catch { return; }')).toBe(1);
    expect(count('try { await run(); } catch (error) { return null; }')).toBe(1);
    expect(count('try { await run(); } catch (error) { report(error); return; }')).toBe(0);
    expect(count('try { await run(); } catch (error) { throw error; }')).toBe(0);
  });

  it.each(RULES)('$name: no file beyond the baseline', (rule) => {
    const current = measure({ rule });
    if (IS_UPDATING) {
      writeBaseline({ file: rule.file, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: rule.file }) });
    expect(
      grown,
      `${rule.hint} A cleanup that lowers a count regenerates the baseline with GOODBOY_UPDATE_BASELINE=1.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('fails when a file grows its count', () => {
    expect(grownEntries({ current: { [SLICE]: 2 }, baseline: { [SLICE]: 1 } })).toEqual([
      `  - ${SLICE}: 2 (baseline 1)`,
    ]);
  });
});
