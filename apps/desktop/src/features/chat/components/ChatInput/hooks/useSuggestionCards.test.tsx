import { describe, expect, it, vi } from 'vitest';
import type { Session, SessionId } from '@goodboy/types';
import type { SessionNudge } from '../../../../../store/types';
import type { AgentKind } from '../../../../session/agent-kind';
import type { ScopePending } from './useScopeNudge';
import type { RightSizePending, RightSizeSuggestion } from './useRightSizeNudge';

vi.mock('../../NudgeCard', () => ({ NudgeCard: () => null }));
vi.mock('../../RightSizeCard', () => ({ RightSizeCard: () => null }));

const { useSuggestionCards } = await import('./useSuggestionCards');

const SESSION_ID = 'session-1' as SessionId;

const session = (workflowRuns: ReadonlyArray<unknown>): Session =>
  ({ id: SESSION_ID, workflowRuns }) as unknown as Session;

const scopePending = {
  content: 'ship it',
  attachments: [],
  mismatch: { kind: 'implement', suggestedAgentKind: 'implementer' },
} as unknown as ScopePending;

const rightSizePending = {} as RightSizePending;
const rightSizeSuggestion = {
  direction: 'up',
  kind: 'cost',
  costMultiplier: 2,
  model: 'opus',
} as unknown as RightSizeSuggestion;

type Overrides = {
  readonly workflowRuns?: ReadonlyArray<unknown>;
  readonly sessionNudge?: SessionNudge | null;
  readonly activeAgentKind?: AgentKind | null;
  readonly scopePending?: ScopePending | null;
  readonly rightSizePending?: RightSizePending | null;
  readonly rightSizeSuggestion?: RightSizeSuggestion | null;
};

const noop = () => {};
const asyncNoop = async () => undefined;

const keysFor = (overrides: Overrides): ReadonlyArray<string> =>
  useSuggestionCards({
    session: session(overrides.workflowRuns ?? []),
    sessionNudge: overrides.sessionNudge ?? null,
    activeAgentKind: overrides.activeAgentKind ?? null,
    scopePending: overrides.scopePending ?? null,
    rightSizePending: overrides.rightSizePending ?? null,
    rightSizeSuggestion: overrides.rightSizeSuggestion ?? null,
    effectiveModel: 'sonnet',
    onScopeSpawn: noop,
    onScopeSendAnyway: noop,
    onScopeDismiss: noop,
    onUseSuggested: noop,
    onKeepCurrent: noop,
    onChangeModel: noop,
    dismissSessionNudge: asyncNoop,
    acceptSessionNudgeHandoff: asyncNoop,
  }).map((suggestion) => suggestion.key);

const planReady = { kind: 'plan-ready', planTitle: 'the plan' } as unknown as SessionNudge;

describe('useSuggestionCards', () => {
  it('returns nothing when no suggestion applies', () => {
    expect(keysFor({})).toEqual([]);
  });

  it('offers the plan-ready card only when no workflow is attached', () => {
    expect(keysFor({ sessionNudge: planReady })).toEqual(['plan-ready']);
    expect(keysFor({ sessionNudge: planReady, workflowRuns: [{}] })).toEqual([]);
  });

  it('offers the scope card only with an active agent kind', () => {
    expect(keysFor({ scopePending, activeAgentKind: 'planner' as AgentKind })).toEqual(['scope']);
    expect(keysFor({ scopePending })).toEqual([]);
  });

  it('offers the right-size card only when both the pending and the suggestion exist', () => {
    expect(keysFor({ rightSizePending, rightSizeSuggestion })).toEqual(['right-size']);
    expect(keysFor({ rightSizePending })).toEqual([]);
    expect(keysFor({ rightSizeSuggestion })).toEqual([]);
  });

  it('keeps plan-ready, scope, then right-size order', () => {
    expect(
      keysFor({
        sessionNudge: planReady,
        scopePending,
        activeAgentKind: 'planner' as AgentKind,
        rightSizePending,
        rightSizeSuggestion,
      }),
    ).toEqual(['plan-ready', 'scope', 'right-size']);
  });
});
