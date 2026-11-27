// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import type { TimelineAgentEntry, TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import { renderedUpToOf } from './renderedUpToOf';

const T1 = brandId<IsoDateTime>({ value: '2026-05-01T10:00:00.000Z' });
const T2 = brandId<IsoDateTime>({ value: '2026-05-01T11:00:00.000Z' });
const T3 = brandId<IsoDateTime>({ value: '2026-05-01T12:00:00.000Z' });

const agentOf = ({ id, lastFinishedAt }: { id: string; lastFinishedAt?: IsoDateTime }): Agent => ({
  id: brandId<AgentId>({ value: id }),
  sessionId: brandId<SessionId>({ value: 'session-harborline-1' }),
  ordinal: 1,
  name: id,
  status: 'completed',
  ...(lastFinishedAt === undefined ? {} : { lastFinishedAt }),
});

type EntryParams = {
  readonly agent: Agent;
  readonly children?: ReadonlyArray<TimelineAgentEntry>;
};

const entryOf = ({ agent, children = [] }: EntryParams): TimelineAgentEntry => ({
  kind: 'agent',
  id: agent.id,
  at: null,
  ordinal: 1,
  agent,
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: null,
  openQuestions: [],
  terminalQuestions: [],
  children,
  answers: [],
  hasDuration: false,
  chain: null,
});

describe('renderedUpToOf', () => {
  it('is null when no agent row is shown', () => {
    expect(renderedUpToOf({ entries: [] })).toBeNull();
  });

  it('is the newest finish among the rows shown, children included', () => {
    const entries: ReadonlyArray<TimelineTopLevelEntry> = [
      entryOf({
        agent: agentOf({ id: 'a1', lastFinishedAt: T1 }),
        children: [entryOf({ agent: agentOf({ id: 'a2', lastFinishedAt: T3 }) })],
      }),
      entryOf({ agent: agentOf({ id: 'a3', lastFinishedAt: T2 }) }),
    ];
    expect(renderedUpToOf({ entries })).toBe(T3);
  });

  it('is null when the rows shown have not finished a turn', () => {
    const entries: ReadonlyArray<TimelineTopLevelEntry> = [
      entryOf({ agent: agentOf({ id: 'a1' }) }),
    ];
    expect(renderedUpToOf({ entries })).toBeNull();
  });
});
