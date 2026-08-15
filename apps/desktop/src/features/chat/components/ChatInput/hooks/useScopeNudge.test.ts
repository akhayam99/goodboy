import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@goodboy/types';
import type { AgentKind } from '../../../../session/agent-kind';
import type { ScopeMismatch } from '../../../utils/scope-mismatch';

const insertNudgeEventSpy = vi.hoisted(() => vi.fn(async () => undefined));
const updateNudgeEventOutcomeSpy = vi.hoisted(() => vi.fn(async () => undefined));
const detectScopeMismatchSpy = vi.hoisted(() => vi.fn<() => ScopeMismatch | null>(() => null));

vi.mock('@goodboy/db', () => ({
  insertNudgeEvent: insertNudgeEventSpy,
  updateNudgeEventOutcome: updateNudgeEventOutcomeSpy,
}));

vi.mock('../../../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../utils/scope-mismatch', () => ({
  detectScopeMismatch: detectScopeMismatchSpy,
}));

const { useScopeNudge } = await import('./useScopeNudge');

const MISMATCH = {
  kind: 'implement-on-planner',
  suggestedAgentKind: 'implementer',
} as unknown as ScopeMismatch;

const session = (workflowRuns: ReadonlyArray<unknown> = []): Session =>
  ({ id: 'session-1', workflowRuns }) as unknown as Session;

type Args = {
  readonly workflowRuns?: ReadonlyArray<unknown>;
  readonly activeAgentKind?: AgentKind | null;
  readonly isRunning?: boolean;
};

const mount = (args: Args = {}) =>
  renderHook(() =>
    useScopeNudge({
      session: session(args.workflowRuns ?? []),
      activeAgentKind:
        args.activeAgentKind === undefined ? ('planner' as AgentKind) : args.activeAgentKind,
      isRunning: args.isRunning ?? false,
    }),
  );

beforeEach(() => {
  insertNudgeEventSpy.mockClear();
  updateNudgeEventOutcomeSpy.mockClear();
  detectScopeMismatchSpy.mockReset();
  detectScopeMismatchSpy.mockReturnValue(null);
});

describe('useScopeNudge', () => {
  it('starts with nothing pending', () => {
    const { result } = mount();
    expect(result.current.scopePending).toBeNull();
    expect(result.current.scopeNudgeEventId).toBeNull();
  });

  it('does not intercept while a turn is running', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount({ isRunning: true });
    let intercepted = true;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(false);
    expect(detectScopeMismatchSpy).not.toHaveBeenCalled();
  });

  it('does not intercept without an active agent kind', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount({ activeAgentKind: null });
    let intercepted = true;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(false);
  });

  it('does not intercept when a workflow is attached', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount({ workflowRuns: [{}] });
    let intercepted = true;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(false);
  });

  it('does not intercept when there is no mismatch', async () => {
    const { result } = mount();
    let intercepted = true;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(false);
    expect(result.current.scopePending).toBeNull();
  });

  it('intercepts a mismatch, records the nudge, and holds the draft', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount();
    let intercepted = false;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(true);
    expect(result.current.scopePending?.content).toBe('do it');
    expect(result.current.scopePending?.mismatch).toBe(MISMATCH);
    expect(result.current.scopeNudgeEventId).not.toBeNull();
    expect(insertNudgeEventSpy).toHaveBeenCalledTimes(1);
  });

  it('does not intercept twice while a draft is held', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount();
    await act(async () => {
      await result.current.checkAndInterceptScope('do it', []);
    });
    let intercepted = true;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('again', []);
    });
    expect(intercepted).toBe(false);
    expect(insertNudgeEventSpy).toHaveBeenCalledTimes(1);
  });

  it('still intercepts when recording the nudge fails', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    insertNudgeEventSpy.mockRejectedValueOnce(new Error('db down'));
    const { result } = mount();
    let intercepted = false;
    await act(async () => {
      intercepted = await result.current.checkAndInterceptScope('do it', []);
    });
    expect(intercepted).toBe(true);
    expect(result.current.scopePending).not.toBeNull();
  });

  it('records an outcome once and clears the event id', async () => {
    detectScopeMismatchSpy.mockReturnValue(MISMATCH);
    const { result } = mount();
    await act(async () => {
      await result.current.checkAndInterceptScope('do it', []);
    });
    await act(async () => {
      await result.current.recordScopeOutcome('accepted');
    });
    expect(updateNudgeEventOutcomeSpy).toHaveBeenCalledTimes(1);
    expect(result.current.scopeNudgeEventId).toBeNull();

    await act(async () => {
      await result.current.recordScopeOutcome('accepted');
    });
    expect(updateNudgeEventOutcomeSpy).toHaveBeenCalledTimes(1);
  });
});
