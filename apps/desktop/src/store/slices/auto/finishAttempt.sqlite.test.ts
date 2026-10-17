import { describe, expect, it } from 'vitest';
import {
  getAutoArtifact,
  getAutoAttempt,
  insertArtifact,
  listAutoDelegations,
  listAutoOutbox,
} from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type AgentId, type ArtifactId } from '@goodboy/types';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const startWith = async (child: Readonly<Record<string, unknown>>): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld();
  await userSays({ world, id: 'outbox-user-1', text: 'look at the ledger export' });
  await autoDelegates({ world, spec: { children: [child] } });
  await autoTurnEnds({ world });
  return world;
};

const SCOUT = { role: 'scout', task: 'find the export callers', reason: 'read only search' };
const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const SCRIBE = {
  role: 'scribe',
  task: 'write the pull request of the ledger export and open it as a draft',
  reason: 'pull request text is the work of a scribe',
  mount: 'mount-ledger-core',
};

const scribeClosing = (childAgentId: string) =>
  [
    '<<pr-title>>Add the ledger export<</pr-title>>',
    '<<pr-body>>Exports the ledger as CSV.<</pr-body>>',
    `<<step-done id="${childAgentId}">>`,
  ].join('\n');

const delegationOf = async (world: RuntimeWorld) => {
  const [delegation] = await listAutoDelegations({
    db: world.state.world.db,
    treeId: world.treeId,
  });
  if (delegation === undefined) {
    throw new Error('a delegation was expected');
  }
  return delegation;
};

const closing = (childAgentId: string, status = '') =>
  `Found three callers.\n<<step-done id="${childAgentId}"${status}>>`;

const captureReport = async (world: RuntimeWorld, runId: string) => {
  const delegation = await delegationOf(world);
  await world.state.world.db.execute(
    'INSERT INTO agents (id, session_id, ordinal, name, status) VALUES (?, ?, 9, ?, ?)',
    [delegation.childAgentId, AUTO_SEED_SESSION, 'scout', 'running'],
  );
  await insertArtifact({
    db: world.state.world.db,
    input: {
      id: brandId<ArtifactId>({ value: 'report-1' }),
      sessionId: AUTO_SEED_SESSION,
      agentId: brandId<AgentId>({ value: delegation.childAgentId }),
      kind: 'report',
      schemaVersion: 1,
      title: 'Callers of the export',
      sourceFormat: 'markdown',
      sourceText: '## Callers\n\n- ledger-core/export.ts',
      metadata: { reportType: 'session-summary' },
      sourceTurnId: runId,
    },
  });
};

describe('closing the work of one child', () => {
  it('registers the report the scout wrote and lists it in the result', async () => {
    const world = await startWith(SCOUT);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await captureReport(world, turn.runId);

    await childTurnEnds({ world, index: 0, text: closing(turn.childAgentId) });

    expect(
      await getAutoArtifact({
        db: world.state.world.db,
        artifactId: brandId<ArtifactId>({ value: 'report-1' }),
      }),
    ).toMatchObject({
      ownerAgentId: turn.childAgentId,
      ownerRole: 'scout',
      approvalState: 'needs_approval',
    });
    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('artifact report-1 (report) "Callers of the export" version 1');
    expect(text).toContain('report-1 (report)');
    expect(world.errors).toEqual([]);
  });

  it('fails a scout that owes a report and wrote none', async () => {
    const world = await startWith(SCOUT);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({ world, index: 0, text: closing(turn.childAgentId) });

    expect(world.state.ports.autoTurns[1]?.text).toContain('its artifact could not be saved');
    expect((await delegationOf(world)).outcome).toBe('failed');
  });

  it('opens the pull request a Scribe wrote once and returns its link to Auto', async () => {
    const world = await startWith(SCRIBE);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({ world, index: 0, text: scribeClosing(turn.childAgentId) });

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]).toMatchObject({
      sessionId: AUTO_SEED_SESSION,
      mountId: 'mount-ledger-core',
      agentId: turn.childAgentId,
    });
    expect(world.state.ports.publications[0]?.assistantText).toContain('<<pr-title>>');
    expect((await delegationOf(world)).outcome).toBe('completed');
    expect(world.state.ports.autoTurns[1]?.text).toContain(
      'Pull request #421 is open: https://github.com/harborline/ledger-core/pull/421',
    );
  });

  it('fails the Scribe with the reason when the pull request could not be opened', async () => {
    const world = await startWith(SCRIBE);
    world.state.ports.setPublications([
      { kind: 'failed', message: 'GitHub refused the pull request: base branch is missing.' },
    ]);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({ world, index: 0, text: scribeClosing(turn.childAgentId) });

    const delegation = await delegationOf(world);
    expect(delegation.outcome).toBe('failed');
    expect(delegation.reason).toBe('GitHub refused the pull request: base branch is missing.');
    expect(world.state.ports.autoTurns[1]?.text).toContain('base branch is missing');
  });

  it('opens no pull request for a Scribe that stopped blocked, nor for other writers', async () => {
    const blocked = await startWith(SCRIBE);
    const scribeTurn = blocked.state.ports.childTurns[0];
    if (scribeTurn === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({
      world: blocked,
      index: 0,
      text: closing(scribeTurn.childAgentId, ' status="blocked"'),
    });
    expect(blocked.state.ports.publications).toHaveLength(0);

    const implementer = await startWith(IMPLEMENTER);
    const turn = implementer.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({ world: implementer, index: 0, text: closing(turn.childAgentId) });
    expect(implementer.state.ports.publications).toHaveLength(0);
  });

  it('lists the files a writer changed, not the ones that were dirty before it', async () => {
    const world = await makeRuntimeWorld();
    await userSays({ world, id: 'outbox-user-1', text: 'add the export' });
    world.state.ports.setSnapshots('/work/harborline/ledger-core', [
      { head: 'abc123', entries: [{ path: 'src/dirty.ts', hash: 'h0' }], isPartial: false },
      {
        head: 'abc123',
        entries: [
          { path: 'src/dirty.ts', hash: 'h0' },
          { path: 'src/export.ts', hash: 'h1' },
        ],
        isPartial: false,
      },
    ]);
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({ world, index: 0, text: closing(turn.childAgentId) });

    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('changed files: src/export.ts (attempt), src/dirty.ts (preexisting)');
  });

  it('reports a change made by a read-only role as a violation and fails the delegation', async () => {
    const world = await startWith(SCOUT);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await captureReport(world, turn.runId);
    world.state.ports.setSnapshots('/work/harborline/ledger-core', [
      { head: 'abc123', entries: [{ path: 'src/sneaky.ts', hash: 'h9' }], isPartial: false },
    ]);

    await childTurnEnds({ world, index: 0, text: closing(turn.childAgentId) });

    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('src/sneaky.ts (unattributed)');
    expect(text).toContain('role_read_only_violation');
    expect((await delegationOf(world)).outcome).toBe('failed');
  });

  it('pauses a child that asks a question and queues the question for Auto at once', async () => {
    const world = await startWith(IMPLEMENTER);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }

    await childTurnEnds({
      world,
      index: 0,
      text: 'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>',
    });

    const attempt = await getAutoAttempt({ db: world.state.world.db, attemptId: turn.attemptId });
    expect(attempt).toMatchObject({ state: 'paused', questionId: `question-${turn.attemptId}` });
    expect((await delegationOf(world)).state).toBe('paused');
    expect(world.state.ports.autoTurns).toHaveLength(2);
    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain('QUESTIONS FROM YOUR AGENTS');
    expect(text).toContain('Which export format?');
    expect(text).not.toContain('RESULTS FROM YOUR AGENTS');
    expect(
      (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).map((row) => [
        row.kind,
        row.state,
      ]),
    ).toEqual([
      ['user', 'accepted'],
      ['question', 'accepted'],
    ]);
  });

  it('ends a child blocked on its fourth question instead of asking again', async () => {
    const world = await startWith(IMPLEMENTER);
    const turn = world.state.ports.childTurns[0];
    if (turn === undefined) {
      throw new Error('a child was expected');
    }
    await world.state.world.db.execute('UPDATE auto_delegations SET question_cycles = 3');

    await childTurnEnds({
      world,
      index: 0,
      text: 'Again.\n<<ctx-question blocking="true">>One more thing?<</ctx-question>>',
    });

    expect((await delegationOf(world)).outcome).toBe('blocked');
    expect(
      (await listAutoOutbox({ db: world.state.world.db, treeId: world.treeId })).map(
        (row) => row.kind,
      ),
    ).toEqual(['user', 'results']);
  });
});
