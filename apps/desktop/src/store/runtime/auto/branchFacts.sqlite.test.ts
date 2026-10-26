import { describe, expect, it } from 'vitest';
import { listAutoDelegations } from '@goodboy/db';
import { CLEAN_FACTS, LEDGER_MOUNT } from './testing/fakePorts';
import {
  autoCommand,
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';

const SCOUT = {
  role: 'scout',
  task: 'report the open review threads',
  reason: 'a read of the branch state',
  mount: LEDGER_MOUNT.id,
  facts: [LEDGER_MOUNT.id],
};

const world = async (): Promise<RuntimeWorld> => {
  const made = await makeRuntimeWorld({ capUsd: 10 });
  await userSays({ world: made, id: 'outbox-user-1', text: 'what is open on the ledger branch' });
  return made;
};

const delegationsOf = (made: RuntimeWorld) =>
  listAutoDelegations({ db: made.state.world.db, treeId: made.treeId });

describe('a scout with facts', () => {
  it('gets the commits, the request, the open threads and the checks in its brief', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [SCOUT] } });
    const [row] = await delegationsOf(made);
    const kickoff = String(row?.request['kickoff']);
    expect(kickoff).toContain('**Facts**');
    expect(kickoff).toContain('feat: export the ledger');
    expect(kickoff).toContain('Pull request: 421');
    expect(kickoff).toContain('src/export.ts: northwind-dev: rename it');
    expect(kickoff).toContain('ci: success');
    expect(row?.request['facts']).toEqual([LEDGER_MOUNT.id]);
    expect(made.state.ports.factReads).toEqual([
      {
        sessionId: expect.any(String),
        mountId: LEDGER_MOUNT.id,
        worktreePath: LEDGER_MOUNT.worktreePath,
        branch: LEDGER_MOUNT.branch,
      },
    ]);
  });

  it('keeps the same child turn as a scout without facts', async () => {
    const withFacts = await world();
    await autoDelegates({ world: withFacts, spec: { children: [SCOUT] } });
    await autoTurnEnds({ world: withFacts });
    const plain = await world();
    await autoDelegates({
      world: plain,
      spec: { children: [{ ...SCOUT, facts: undefined }] },
    });
    await autoTurnEnds({ world: plain });
    const [a] = withFacts.state.ports.childTurns;
    const [b] = plain.state.ports.childTurns;
    expect(a?.role).toBe('scout');
    expect(a?.role).toBe(b?.role);
    expect(a?.captureMode).toBe(b?.captureMode);
    expect(a?.mountTarget).toEqual(b?.mountTarget);
    expect(a?.text).toContain('**Facts**');
    expect(b?.text).not.toContain('**Facts**');
  });

  it('marks a host that failed and still starts the scout', async () => {
    const made = await world();
    made.state.ports.setBranchFacts(LEDGER_MOUNT.id, new Error('gh is not signed in'));
    const outcome = await autoDelegates({ world: made, spec: { children: [SCOUT] } });
    expect(outcome).toMatchObject({ isOk: true });
    const [row] = await delegationsOf(made);
    expect(row?.role).toBe('scout');
    expect(String(row?.request['kickoff'])).toContain(
      'Commits: Facts not available: gh is not signed in',
    );
  });

  it('marks only the part the host could not read', async () => {
    const made = await world();
    made.state.ports.setBranchFacts(LEDGER_MOUNT.id, {
      ...CLEAN_FACTS,
      checks: { kind: 'unavailable', reason: 'the host answered denied' },
    });
    await autoDelegates({ world: made, spec: { children: [SCOUT] } });
    const kickoff = String((await delegationsOf(made))[0]?.request['kickoff']);
    expect(kickoff).toContain('Checks: Facts not available: the host answered denied');
    expect(kickoff).toContain('Open review threads: 1');
  });

  it('refuses a mount that is not in the conversation and starts nothing', async () => {
    const made = await world();
    const outcome = await autoCommand({
      world: made,
      verb: 'delegate',
      args: {
        'request-id': 'request-facts',
        spec: JSON.stringify({ children: [{ ...SCOUT, facts: ['mount-unknown'] }] }),
      },
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'mount_missing' });
    expect(await delegationsOf(made)).toHaveLength(0);
    expect(made.state.ports.factReads).toHaveLength(0);
  });

  it('refuses facts on a writer and reads nothing', async () => {
    const made = await world();
    const outcome = await autoCommand({
      world: made,
      verb: 'delegate',
      args: {
        'request-id': 'request-facts',
        spec: JSON.stringify({
          children: [{ ...SCOUT, role: 'implementer', task: 'change the export' }],
        }),
      },
    });
    expect(outcome).toMatchObject({ isOk: false, code: 'spec_invalid' });
    expect(made.state.ports.factReads).toHaveLength(0);
  });

  it('reads the facts again when the scout is retried', async () => {
    const made = await world();
    await autoDelegates({ world: made, spec: { children: [SCOUT] } });
    await autoTurnEnds({ world: made });
    await childTurnEnds({ world: made, index: 0, text: 'I could not finish this.' });
    const [original] = await delegationsOf(made);
    made.state.ports.setBranchFacts(LEDGER_MOUNT.id, {
      ...CLEAN_FACTS,
      commits: { kind: 'ok', value: [{ sha: 'fff000111', subject: 'fix: the second read' }] },
    });
    const outcome = await autoCommand({
      world: made,
      verb: 'delegate',
      args: {
        'request-id': 'request-retry',
        spec: JSON.stringify({ children: [{ retryOf: original?.id, reason: 'again' }] }),
      },
    });
    expect(outcome).toMatchObject({ isOk: true });
    expect(made.state.ports.factReads).toHaveLength(2);
    const retried = (await delegationsOf(made)).find((row) => row.retryOf !== null);
    expect(String(retried?.request['kickoff'])).toContain('fix: the second read');
    expect(retried?.request['facts']).toEqual([LEDGER_MOUNT.id]);
  });
});
