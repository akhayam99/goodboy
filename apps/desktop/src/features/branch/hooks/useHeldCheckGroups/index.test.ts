// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { PrCheckRun } from '@goodboy/types';
import { useHeldCheckGroups } from '.';

type RunParams = {
  readonly conclusion: PrCheckRun['conclusion'];
};

type HookParams = {
  readonly scope: string;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const BUILD = 'build';

const buildOf = ({ conclusion }: RunParams): PrCheckRun => ({
  name: BUILD,
  conclusion,
  detailsUrl: `https://github.com/harborline/payments-api/actions/runs/1/job/${BUILD}`,
  durationMs: null,
});

const LEDGER = 'session-harborline mount-ledger-core github 318';
const NOTIFY = 'session-harborline mount-notify-relay github 42';

const render = ({ scope, checks }: HookParams) =>
  renderHook((props: HookParams) => useHeldCheckGroups(props), {
    initialProps: { scope, checks },
  });

afterEach(() => {
  cleanup();
});

describe('useHeldCheckGroups', () => {
  it('keeps a re-run check in the group it had while the scope stays', () => {
    const hook = render({ scope: LEDGER, checks: [buildOf({ conclusion: 'failure' })] });

    hook.rerender({ scope: LEDGER, checks: [buildOf({ conclusion: 'success' })] });

    expect(hook.result.current.get(BUILD)).toBe('failing');
  });

  it('places the checks of another mount by their own conclusion', () => {
    const hook = render({ scope: LEDGER, checks: [buildOf({ conclusion: 'failure' })] });

    hook.rerender({ scope: NOTIFY, checks: [buildOf({ conclusion: 'success' })] });

    expect(hook.result.current.get(BUILD)).toBe('passed');
  });

  it('starts fresh when the scope comes back, without the groups of the scope in between', () => {
    const hook = render({ scope: LEDGER, checks: [buildOf({ conclusion: 'failure' })] });

    hook.rerender({ scope: NOTIFY, checks: [] });
    hook.rerender({ scope: LEDGER, checks: [buildOf({ conclusion: 'success' })] });

    expect(hook.result.current.get(BUILD)).toBe('passed');
  });
});
