import { describe, expect, it } from 'vitest';
import { listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import type { RemoteRead } from '@goodboy/core';
import {
  autoAnswers,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const PATH = '/work/harborline/ledger-core';
const BRANCH = 'ak/ledger-export';

const IMPLEMENTER = {
  role: 'implementer',
  task: 'add the export',
  reason: 'a code change',
  mount: 'mount-ledger-core',
};

const SCOUT = { role: 'scout', task: 'find the export callers', reason: 'read only search' };

const at = (sha: string): RemoteRead => ({ kind: 'sha', branch: BRANCH, sha });

const startWith = async ({
  child,
  reads,
}: {
  readonly child: Readonly<Record<string, unknown>>;
  readonly reads: ReadonlyArray<RemoteRead>;
}): Promise<RuntimeWorld> => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  world.state.ports.setRemoteReads(PATH, reads);
  await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
  await autoDelegates({ world, spec: { children: [child] } });
  await autoTurnEnds({ world });
  return world;
};

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

const attemptsOf = async (world: RuntimeWorld) =>
  listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: (await delegationOf(world)).id,
  });

const finish = async (world: RuntimeWorld, index = 0): Promise<void> => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error('a child was expected');
  }
  await childTurnEnds({
    world,
    index,
    text: `Done.\n<<step-done id="${turn.childAgentId}">>`,
  });
};

const remoteOfResult = async (world: RuntimeWorld): Promise<unknown> => {
  const result = (await delegationOf(world)).result;
  const verified =
    typeof result === 'object' && result !== null && 'verified' in result ? result.verified : null;
  return typeof verified === 'object' && verified !== null && 'remote' in verified
    ? verified.remote
    : undefined;
};

describe('watching the remote branch of a writer', () => {
  it('records the online sha at the start and flags a branch that moved while the agent worked', async () => {
    const world = await startWith({ child: IMPLEMENTER, reads: [at('aaa111'), at('bbb222')] });
    const [first] = await attemptsOf(world);
    expect(first?.baseline).toMatchObject({
      remote: { kind: 'sha', branch: BRANCH, sha: 'aaa111' },
    });

    await finish(world);

    expect(await remoteOfResult(world)).toEqual({
      status: 'moved',
      branch: BRANCH,
      before: 'aaa111',
      after: 'bbb222',
    });
    const text = world.state.ports.autoTurns[1]?.text ?? '';
    expect(text).toContain(`The branch changed online while this agent worked (${BRANCH})`);
    expect(world.errors).toEqual([]);
  });

  it('reads the branch it recorded at the start, not the one checked out at the end', async () => {
    const world = await startWith({ child: IMPLEMENTER, reads: [at('aaa111')] });

    await finish(world);

    expect(world.state.ports.remoteReads).toEqual([
      { worktreePath: PATH, branch: null },
      { worktreePath: PATH, branch: BRANCH },
    ]);
  });

  it('says nothing when the online sha is the same', async () => {
    const world = await startWith({ child: IMPLEMENTER, reads: [at('aaa111'), at('aaa111')] });

    await finish(world);

    expect(await remoteOfResult(world)).toMatchObject({ status: 'unchanged' });
    expect(world.state.ports.autoTurns[1]?.text ?? '').not.toContain('online');
  });

  it('reads unknown, never clean, when the end read fails', async () => {
    const world = await startWith({
      child: IMPLEMENTER,
      reads: [at('aaa111'), { kind: 'unknown' }],
    });

    await finish(world);

    expect(await remoteOfResult(world)).toMatchObject({ status: 'unknown', branch: BRANCH });
    expect(world.state.ports.autoTurns[1]?.text ?? '').toContain('could not be read');
  });

  it('reads unknown when the start read failed, even if the end read works', async () => {
    const world = await startWith({
      child: IMPLEMENTER,
      reads: [{ kind: 'unknown' }, at('aaa111')],
    });
    const [first] = await attemptsOf(world);
    expect(first?.baseline).toMatchObject({ remote: { kind: 'unknown' } });

    await finish(world);

    expect(await remoteOfResult(world)).toMatchObject({ status: 'unknown' });
  });

  it('flags a branch that appeared online while the agent worked', async () => {
    const world = await startWith({
      child: IMPLEMENTER,
      reads: [{ kind: 'absent', branch: BRANCH }, at('bbb222')],
    });

    await finish(world);

    expect(await remoteOfResult(world)).toMatchObject({
      status: 'moved',
      before: null,
      after: 'bbb222',
    });
  });

  it('does not touch the remote for a read-only role', async () => {
    const world = await startWith({ child: SCOUT, reads: [at('aaa111'), at('bbb222')] });
    const [first] = await attemptsOf(world);
    expect(first?.baseline).not.toHaveProperty('remote');

    await finish(world);

    expect(world.state.ports.remoteReads).toEqual([]);
    expect(await remoteOfResult(world)).toBeUndefined();
  });

  it('records a new baseline for the resumed attempt and compares that attempt alone', async () => {
    const world = await makeRuntimeWorld({ capUsd: 10 });
    world.state.ports.setRemoteReads(PATH, [at('aaa111'), at('ccc333'), at('ccc333')]);
    await userSays({ world, id: 'outbox-user-1', text: 'add the ledger export' });
    await autoDelegates({ world, spec: { children: [IMPLEMENTER] } });
    await autoTurnEnds({ world });
    const first = world.state.ports.childTurns[0];
    if (first === undefined) {
      throw new Error('a child was expected');
    }
    await childTurnEnds({
      world,
      index: 0,
      text: 'I need a choice.\n<<ctx-question blocking="true">>Which export format?<</ctx-question>>',
    });
    await autoAnswers({
      world,
      delegationId: (await delegationOf(world)).id,
      questionId: `question-${first.attemptId}`,
      text: 'Use json lines.',
    });
    await autoTurnEnds({ world });

    const attempts = await attemptsOf(world);
    expect(attempts[1]?.baseline).toMatchObject({
      resume: { answer: 'Use json lines.' },
      remote: { kind: 'sha', sha: 'ccc333' },
    });

    await finish(world, 1);

    expect(await remoteOfResult(world)).toMatchObject({ status: 'unchanged' });
  });
});
