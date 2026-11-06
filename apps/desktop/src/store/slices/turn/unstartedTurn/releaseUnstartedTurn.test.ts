import { beforeAll, describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnState,
} from '@goodboy/types';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../../storyHarness';
import { releaseUnstartedTurn } from './releaseUnstartedTurn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const RUN = brandId<ProviderRunId>({ value: 'run-ledger-1' });
const OTHER_RUN = brandId<ProviderRunId>({ value: 'run-ledger-2' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T09:30:00.000Z' });

type ReleaseParams = Readonly<{
  state: TurnState;
  runId?: ProviderRunId;
}>;

const kindAfter = ({ state, runId }: ReleaseParams) => {
  useAppStore.setState({ agentTurnState: { [AGENT]: state } });
  releaseUnstartedTurn({
    set: useAppStore.setState,
    get: useAppStore.getState,
    sessionId: SESSION,
    agentId: AGENT,
    ...(runId !== undefined && { runId }),
  });
  return useAppStore.getState().agentTurnState[AGENT]?.kind;
};

describe('releaseUnstartedTurn', () => {
  it('puts a starting agent back to idle', () => {
    expect(kindAfter({ state: { kind: 'starting', startedAt: AT } })).toBe('idle');
  });

  it('puts back the run it was building, and only that run', () => {
    const running: TurnState = { kind: 'running', runId: RUN, startedAt: AT };

    expect(kindAfter({ state: running, runId: RUN })).toBe('idle');
    expect(kindAfter({ state: running, runId: OTHER_RUN })).toBe('running');
    expect(kindAfter({ state: running })).toBe('running');
  });

  it('leaves an ended turn as it is', () => {
    expect(kindAfter({ state: { kind: 'ended', endedAt: AT }, runId: RUN })).toBe('ended');
  });
});
