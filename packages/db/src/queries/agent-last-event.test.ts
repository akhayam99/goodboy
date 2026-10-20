import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';
import { readAgentLastEventAt } from './agent-last-event';
import { insertTurnEvent } from './turn-event';

const WORKER = brandId<AgentId>({ value: 'agent-ledger-worker' });
const OTHER = brandId<AgentId>({ value: 'agent-notify-relay' });
const RUN = brandId<ProviderRunId>({ value: 'run-ledger' });

type IsoAtParams = {
  readonly ms: number;
};

const isoAt = ({ ms }: IsoAtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(ms).toISOString() });

const database = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: [WORKER, OTHER] });
  await insertTurnEvent(db, {
    id: 'event-start',
    sessionId: AUTO_SEED_SESSION,
    agentId: WORKER,
    event: {
      kind: 'user_text',
      runId: RUN,
      text: 'add the export',
      at: isoAt({ ms: AUTO_SEED_NOW }),
    },
  });
  await insertTurnEvent(db, {
    id: 'event-tool',
    sessionId: AUTO_SEED_SESSION,
    agentId: WORKER,
    event: {
      kind: 'tool_call_start',
      runId: RUN,
      toolUseId: 'tool-1',
      toolName: 'Bash',
      input: 'pnpm test',
      at: isoAt({ ms: AUTO_SEED_NOW + 60_000 }),
    },
  });
  await insertTurnEvent(db, {
    id: 'event-other',
    sessionId: AUTO_SEED_SESSION,
    agentId: OTHER,
    event: {
      kind: 'assistant_text',
      runId: RUN,
      delta: 'later',
      at: isoAt({ ms: AUTO_SEED_NOW + 90_000 }),
    },
  });
  return db;
};

describe('the last event of an agent', () => {
  it('is the newest event of that agent only', async () => {
    expect(
      await readAgentLastEventAt({ db: await database(), agentId: WORKER, sinceMs: AUTO_SEED_NOW }),
    ).toBe(AUTO_SEED_NOW + 60_000);
  });

  it('is unknown when the agent wrote nothing since the given time', async () => {
    const db = await database();
    expect(
      await readAgentLastEventAt({ db, agentId: WORKER, sinceMs: AUTO_SEED_NOW + 61_000 }),
    ).toBeNull();
  });
});
