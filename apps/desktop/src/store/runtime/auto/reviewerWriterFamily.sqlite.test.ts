import { describe, expect, it } from 'vitest';
import { insertArtifact, listAutoArtifacts } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type ArtifactId } from '@goodboy/types';
import { READY_ROUTING } from './testing/fakePorts';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the retry cap to payments-api',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

type ReportParams = {
  readonly world: RuntimeWorld;
};

const writtenReport = async ({ world }: ReportParams): Promise<string> => {
  const turn = world.state.ports.childTurns[0];
  if (turn === undefined) {
    throw new Error('a running implementer was expected');
  }
  await world.state.world.db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 9, ?, ?)',
    [turn.childAgentId, AUTO_SEED_SESSION, 'implementer', 'running'],
  );
  await insertArtifact({
    db: world.state.world.db,
    input: {
      id: brandId<ArtifactId>({ value: 'report-retry-cap' }),
      sessionId: AUTO_SEED_SESSION,
      agentId: brandId<AgentId>({ value: turn.childAgentId }),
      kind: 'report',
      schemaVersion: 1,
      title: 'Retry cap',
      sourceFormat: 'markdown',
      sourceText: 'The cap is 5.',
      metadata: { reportType: 'session-summary' },
      sourceTurnId: turn.runId,
    },
  });
  await childTurnEnds({
    world,
    index: 0,
    text: `Added the cap.\n<<step-done id="${String(turn.childAgentId)}">>`,
  });
  const [artifact] = await listAutoArtifacts({ db: world.state.world.db, treeId: world.treeId });
  if (artifact === undefined) {
    throw new Error('the implementer report was expected');
  }
  return artifact.artifactId;
};

const startedOnCodex = async (): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'cap the retries of payments-api' });
  world.state.ports.setRouting({
    kind: 'ready',
    provider: 'codex',
    model: 'gpt-6.1-sol',
    effort: 'medium',
    reason: 'Codex: first in your order',
    proposal: 'none',
  });
  await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
  await autoTurnEnds({ world });
  return world;
};

describe('the model family a reviewer is routed against', () => {
  it('is the family of the writer whose report the reviewer reads', async () => {
    const world = await startedOnCodex();
    const reportId = await writtenReport({ world });
    world.state.ports.setRouting(READY_ROUTING);

    await autoDelegates({
      world,
      requestId: 'request-review',
      spec: {
        children: [
          {
            role: 'reviewer',
            task: 'review the retry cap change',
            reason: 'a second look',
            artifacts: [reportId],
          },
          {
            role: 'tester',
            task: 'run the payments-api tests',
            reason: 'check the change',
            mount: 'mount-ledger-core',
            artifacts: [reportId],
          },
        ],
      },
    });

    const requests = world.state.ports.routingRequests;
    expect(requests.find((request) => request.role === 'reviewer')?.writerFamily).toBe('gpt');
    expect(requests.find((request) => request.role === 'tester')?.writerFamily).toBeNull();
    expect(requests.find((request) => request.role === 'implementer')?.writerFamily).toBeNull();
  });
});
