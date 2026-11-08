// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, type StoryStore } from '../../../store/storyHarness';
import { resolveActions } from '../resolveActions';
import { AGENT_KIND } from './agent';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-ledger-core' });
const AT = brandId<IsoDateTime>({ value: '2026-11-08T09:00:00.000Z' });
const RUN = brandId<ProviderRunId>({ value: 'run-ledger-core' });
const TARGET = { kind: 'agent', sessionId: SESSION, agentId: AGENT } as const;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(() => {
  useAppStore.setState({
    sessionPhaseRuns: {
      [SESSION]: [
        anAgent({
          id: AGENT,
          sessionId: SESSION,
          name: 'Implementer',
          status: 'stopped',
          doneAt: AT,
        }),
      ],
    },
    agentTurnState: { [AGENT]: { kind: 'running', runId: RUN, startedAt: AT } },
    agentKindOverride: {},
    autoTreeViews: {},
    settings: {},
    transcripts: {},
  });
});

describe('the verbs of an agent with a live turn', () => {
  it('reads a stopped agent that runs again as running, never closed', () => {
    const facts = AGENT_KIND.facts({ state: useAppStore.getState(), target: TARGET });
    if (facts === null) {
      throw new Error('no facts');
    }

    expect(facts.status).toBe('running');
    expect(facts.isClosedByUser).toBe(false);
    const ids = resolveActions({ definitions: AGENT_KIND.actions, facts }).map(
      (action) => action.id,
    );
    expect(ids.some((id) => id.toLowerCase().includes('reopen'))).toBe(false);
  });
});
