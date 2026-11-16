import { describe, expect, it } from 'vitest';
import { anAgent } from '@goodboy/types/testing';
import { brandId, type IsoDateTime, type ProviderRunId, type TurnEvent } from '@goodboy/types';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aView,
} from '../auto/testing/autoViewFixtures';
import { autoRunTitleOf } from './autoRunTitleOf';

const BRIEF: ReadonlyArray<TurnEvent> = [
  {
    kind: 'user_text',
    runId: brandId<ProviderRunId>({ value: 'mock-run-1' }),
    text: 'Write the Northwind release notes\nand link the ledger-core change',
    at: brandId<IsoDateTime>({ value: '2026-10-20T10:00:00.000Z' }),
  },
];

const CHILD = aDelegation({ key: 'scout', role: 'scout', state: 'running' });

type StateParams = {
  readonly rootName?: string;
  readonly rootAsk?: string | null;
  readonly events?: ReadonlyArray<TurnEvent>;
};

const stateOf = ({ rootName = 'Auto', rootAsk = null, events = [] }: StateParams) => ({
  sessionPhaseRuns: {
    [FIXTURE_SESSION]: [
      anAgent({ id: FIXTURE_ROOT, name: rootName, kind: 'auto' }),
      anAgent({ id: CHILD.childAgentId, name: 'Scout', parentAgentId: FIXTURE_ROOT }),
    ],
  },
  autoTreeViews: { [FIXTURE_SESSION]: [aView({ delegations: [CHILD], rootAsk })] },
  transcripts: { [FIXTURE_ROOT]: events },
});

describe('autoRunTitleOf', () => {
  it('names the run by the first line of its ask', () => {
    const state = stateOf({ rootAsk: 'Fix the payments-api retry\nwith a test' });

    expect(autoRunTitleOf({ state, sessionId: FIXTURE_SESSION, agentId: FIXTURE_ROOT })).toBe(
      'Fix the payments-api retry',
    );
  });

  it('reads the first message of the run when the ask was not stored', () => {
    const state = stateOf({ events: BRIEF });

    expect(autoRunTitleOf({ state, sessionId: FIXTURE_SESSION, agentId: FIXTURE_ROOT })).toBe(
      'Write the Northwind release notes',
    );
  });

  it('falls back to Lead, never the default agent name', () => {
    expect(
      autoRunTitleOf({ state: stateOf({}), sessionId: FIXTURE_SESSION, agentId: FIXTURE_ROOT }),
    ).toBe('Lead');
  });

  it('keeps a name the owner gave the run', () => {
    const state = stateOf({ rootName: 'Cascadia sweep', rootAsk: 'Fix it' });

    expect(autoRunTitleOf({ state, sessionId: FIXTURE_SESSION, agentId: FIXTURE_ROOT })).toBe(
      'Cascadia sweep',
    );
  });

  it('has no run title for an agent that is not the root of a run', () => {
    const state = stateOf({ rootAsk: 'Fix it' });

    expect(
      autoRunTitleOf({ state, sessionId: FIXTURE_SESSION, agentId: CHILD.childAgentId }),
    ).toBeNull();
  });
});
