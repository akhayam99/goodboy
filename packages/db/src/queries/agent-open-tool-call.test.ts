import { describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';
import { hasAgentOpenToolCall } from './agent-open-tool-call';
import { insertTurnEvent } from './turn-event';

const WORKER = brandId<AgentId>({ value: 'agent-ledger-worker' });
const RUN = brandId<ProviderRunId>({ value: 'run-ledger' });
const AT = brandId<IsoDateTime>({ value: new Date(AUTO_SEED_NOW).toISOString() });

const START: TurnEvent = {
  kind: 'tool_call_start',
  runId: RUN,
  toolUseId: 'tool-build',
  toolName: 'Bash',
  input: 'pnpm build',
  at: AT,
};

const END: TurnEvent = {
  kind: 'tool_call_end',
  runId: RUN,
  toolUseId: 'tool-build',
  output: 'ok',
  isError: false,
  at: AT,
};

type DatabaseParams = {
  readonly events: ReadonlyArray<TurnEvent>;
};

const database = async ({ events }: DatabaseParams) => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db, agentIds: [WORKER] });
  for (const [index, event] of events.entries()) {
    await insertTurnEvent(db, {
      id: `event-${index}`,
      sessionId: AUTO_SEED_SESSION,
      agentId: WORKER,
      event,
    });
  }
  return db;
};

describe('an open tool call of an agent', () => {
  it('is open while its end has not arrived', async () => {
    const db = await database({ events: [START] });
    expect(await hasAgentOpenToolCall({ db, agentId: WORKER, sinceMs: AUTO_SEED_NOW })).toBe(true);
  });

  it('is closed once the end with the same id arrived', async () => {
    const db = await database({ events: [START, END] });
    expect(await hasAgentOpenToolCall({ db, agentId: WORKER, sinceMs: AUTO_SEED_NOW })).toBe(false);
  });

  it('ignores a call started before the given time', async () => {
    const db = await database({ events: [START] });
    expect(await hasAgentOpenToolCall({ db, agentId: WORKER, sinceMs: AUTO_SEED_NOW + 1 })).toBe(
      false,
    );
  });
});
