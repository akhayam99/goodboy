// @vitest-environment happy-dom

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, SessionEventId, SessionId } from '@goodboy/types';
import type { AgentKind } from '../../agent-kind';
import type { TimelineAgentEntry, TimelineEventEntry } from '../../timeline/buildTimelineGroups';

const state = vi.hoisted(() => ({
  setActiveLens: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('../../../../store', async () => {
  const place = await import('../../../../store/slices/navigation/place');
  return {
    useAppStore: { getState: () => state },
    agentPlace: place.agentPlace,
    sessionPlace: place.sessionPlace,
  };
});

import { useTimelineOpen } from '.';

const typedString = <Value extends string>({ value }: { readonly value: string }): Value =>
  JSON.parse(JSON.stringify(value));

afterEach(cleanup);

describe('useTimelineOpen', () => {
  it('has no open target for a detached project event', () => {
    const sessionId = typedString<SessionId>({ value: 'session-1' });
    const entry: TimelineEventEntry = {
      kind: 'event',
      id: 'event-1',
      at: '2026-08-30T10:00:00Z',
      event: {
        id: typedString<SessionEventId>({ value: 'event-1' }),
        sessionId,
        kind: 'project_detached',
        payload: { projectName: 'api' },
        createdAt: typedString<IsoDateTime>({ value: '2026-08-30T10:00:00Z' }),
      },
    };
    const { result } = renderHook(() => useTimelineOpen({ sessionId }));

    expect(result.current({ entry })).toBeNull();
  });

  const agentEntry = ({ agentKind }: { readonly agentKind: AgentKind }): TimelineAgentEntry => ({
    kind: 'agent',
    id: 'agent-1',
    at: null,
    ordinal: 0,
    agent: { id: typedString<AgentId>({ value: 'agent-1' }) } as Agent,
    agentKind,
    isMissingArtifact: false,
    stepLabel: null,
    openQuestions: [],
    terminalQuestions: [],
    children: [],
    answers: [],
    hasDuration: false,
    chain: null,
  });

  it('opens a resolver on its brief', () => {
    const sessionId = typedString<SessionId>({ value: 'session-1' });
    const { result } = renderHook(() => useTimelineOpen({ sessionId }));
    const target = result.current({ entry: agentEntry({ agentKind: 'resolver' }) });

    expect(target?.label).toBe('Open brief');
    target?.open();
    expect(state.navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId, agentId: 'agent-1', pane: 'brief' },
    });
  });

  it('opens any other agent on its chat without asking for a tab', () => {
    const sessionId = typedString<SessionId>({ value: 'session-1' });
    const { result } = renderHook(() => useTimelineOpen({ sessionId }));
    const target = result.current({ entry: agentEntry({ agentKind: 'implementer' }) });

    expect(target?.label).toBe('Open chat');
    target?.open();
    expect(state.navigate).toHaveBeenLastCalledWith({
      to: { at: 'agent', sessionId, agentId: 'agent-1' },
    });
  });
});
