import { insertAgent, insertSession, insertTurnEventsBatch, insertWorkspace } from '@goodboy/db';
import type { PendingTurnEventInsert } from '@goodboy/db';
import type { AgentId, ProviderRunId, SessionId, TurnEvent, WorkspaceId } from '@goodboy/types';
import {
  nextAgentId,
  nextProviderRunId,
  nextSessionId,
  nextWorkspaceId,
} from '@goodboy/types/testing';
import {
  STORY_NOW,
  buildStorySession,
  buildStoryWorkspace,
  storySqlite,
} from '../store/storyHarness';

type SeedParams = {
  readonly rowCount: number;
};

type EventParams = {
  readonly index: number;
  readonly runId: ProviderRunId;
};

export type SeededTurns = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

const INSERT_CHUNK = 500;

const eventAt = ({ index, runId }: EventParams): TurnEvent =>
  index % 2 === 0
    ? {
        kind: 'user_text',
        runId,
        text: `Reconcile settlement batch ${index} for Northwind in ledger-core`,
        at: STORY_NOW,
      }
    : {
        kind: 'assistant_text',
        runId,
        delta: `Batch ${index} matches the payments-api export. `.repeat(6),
        at: STORY_NOW,
      };

export const seedStoredTurns = async ({ rowCount }: SeedParams): Promise<SeededTurns> => {
  const seeded: SeededTurns = {
    workspaceId: nextWorkspaceId(),
    sessionId: nextSessionId(),
    agentId: nextAgentId(),
    runId: nextProviderRunId(),
  };
  const db = storySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({
      id: seeded.workspaceId,
      name: 'Harborline',
      slug: 'harborline',
    }),
  });
  await insertSession(
    db,
    buildStorySession({
      id: seeded.sessionId,
      workspaceId: seeded.workspaceId,
      goal: 'Open a long session',
    }),
  );
  await insertAgent(db, {
    id: seeded.agentId,
    sessionId: seeded.sessionId,
    ordinal: 1,
    name: 'Agent 1',
    status: 'completed',
  });
  for (let start = 0; start < rowCount; start += INSERT_CHUNK) {
    const size = Math.min(INSERT_CHUNK, rowCount - start);
    const chunk: PendingTurnEventInsert[] = Array.from({ length: size }, (_, offset) => ({
      id: `${seeded.agentId}-event-${start + offset}`,
      sessionId: seeded.sessionId,
      agentId: seeded.agentId,
      event: eventAt({ index: start + offset, runId: seeded.runId }),
    }));
    await insertTurnEventsBatch(db, chunk);
  }
  return seeded;
};
