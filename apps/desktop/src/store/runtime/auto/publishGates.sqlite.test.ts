import { describe, expect, it, vi } from 'vitest';
import {
  publishOfResult,
  pullRequestOfResult,
  type LeadPermissionValue,
  type MountSnapshot,
  type PickableMount,
} from '@goodboy/core/auto';
import { getAutoGrant, listAutoDelegations, setSetting, type AutoGrantId } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { SETTING_WORK_ENABLED } from '../../../shared/lib/workSetting';
import { readAutoTreeViews } from '../../slices/auto-view/readAutoTreeViews';
import { createAskAnswerer } from './asks/createAskAnswerer';
import { leadAsksOf } from './asks/leadAsksOf';
import { writeLeadPermission, type LeadPermissionChange } from './level/writeLeadPermission';
import { BITBUCKET_MOUNT, GITLAB_MOUNT, LEDGER_MOUNT, NOTIFY_MOUNT } from './testing/fakePorts';
import { END, START } from './testing/publishWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from './testing/runtimeWorld';
import { WORLD_NOW } from './testing/autoWorld';

const TITLE = 'Add the ledger export';
const BODY = 'Exports the ledger as CSV.\n\n  Keeps the indent  and the double space.';

type RowParams = {
  readonly world: RuntimeWorld;
  readonly change: LeadPermissionChange;
};

const setRow = async ({ world, change }: RowParams) => {
  await writeLeadPermission({
    db: world.state.world.db,
    target: { treeId: world.treeId },
    change,
    nowMs: WORLD_NOW,
  });
};

type PathParams = {
  readonly mount: PickableMount;
};

const pathOf = ({ mount }: PathParams): string => mount.worktreePath ?? '';

type WorldParams = {
  readonly mount?: PickableMount;
  readonly push?: LeadPermissionValue<'push'>;
  readonly pullRequest?: LeadPermissionValue<'pullRequest'>;
};

const worldOf = async ({ mount = LEDGER_MOUNT, push, pullRequest }: WorldParams) => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  world.state.ports.setMounts([LEDGER_MOUNT, NOTIFY_MOUNT, GITLAB_MOUNT, BITBUCKET_MOUNT]);
  world.state.ports.setSnapshots(pathOf({ mount }), [START, END]);
  if (push !== undefined) {
    await setRow({ world, change: { key: 'push', value: push } });
  }
  if (pullRequest !== undefined) {
    await setRow({ world, change: { key: 'pullRequest', value: pullRequest } });
  }
  await userSays({ world, id: 'outbox-user-1', text: 'ship the ledger export' });
  return world;
};

type ChildParams = {
  readonly world: RuntimeWorld;
  readonly child: Readonly<Record<string, unknown>>;
  readonly text: (childAgentId: string) => string;
  readonly index?: number;
};

const runChild = async ({ world, child, text, index = 0 }: ChildParams) => {
  const outcome = await autoDelegates({
    world,
    spec: { children: [child] },
    requestId: `request-${index + 1}`,
  });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error('a child was expected');
  }
  await childTurnEnds({ world, index, text: text(turn.childAgentId) });
};

const done = (childAgentId: string) => `Done.\n<<step-done id="${childAgentId}">>`;

type PusherParams = {
  readonly mount?: PickableMount;
  readonly publish?: unknown;
};

const pusher = ({ mount = LEDGER_MOUNT, publish = 'push' }: PusherParams) => ({
  role: 'implementer',
  task: `add the export to ${mount.mountName}`,
  reason: 'a code change',
  mount: mount.id,
  publish,
});

type ScribeParams = {
  readonly mount?: PickableMount;
};

const scribe = ({ mount = LEDGER_MOUNT }: ScribeParams) => ({
  role: 'scribe',
  task: 'write the pull request of the ledger export',
  reason: 'pull request text is the work of a scribe',
  mount: mount.id,
});

const scribeText = (childAgentId: string) =>
  [`<<pr-title>>${TITLE}<</pr-title>>`, `<<pr-body>>${BODY}<</pr-body>>`, done(childAgentId)].join(
    '\n',
  );

const delegationsOf = (world: RuntimeWorld) =>
  listAutoDelegations({ db: world.state.world.db, treeId: world.treeId });

const pushRecordOf = async (world: RuntimeWorld, index = 0) => {
  const delegation = (await delegationsOf(world))[index];
  return publishOfResult({ result: delegation?.result });
};

const pullRequestRecordOf = async (world: RuntimeWorld, index = 0) => {
  const delegation = (await delegationsOf(world))[index];
  return pullRequestOfResult({ result: delegation?.result });
};

const asksOf = async (world: RuntimeWorld) => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  return views.flatMap((view) => leadAsksOf({ view }));
};

const answererOf = (world: RuntimeWorld) => createAskAnswerer({ runtimeOf: () => world.runtime });

const onlyAskOf = async (world: RuntimeWorld) => {
  const asks = await asksOf(world);
  expect(asks).toHaveLength(1);
  const [ask] = asks;
  if (ask === undefined) {
    throw new Error('an ask was expected');
  }
  return ask;
};

describe('a plain push when its row says Ask', () => {
  it('holds the push, names the branch and the commit, and pushes nothing', async () => {
    const world = await worldOf({ push: 'ask' });
    await runChild({ world, child: pusher({}), text: done });

    expect(world.state.ports.pushes).toEqual([]);
    expect(await pushRecordOf(world)).toMatchObject({
      mode: 'push',
      state: 'awaiting_confirm',
      branch: 'ak/ledger-export',
      sha: 'abc123',
      isConfirmed: false,
    });
    const ask = await onlyAskOf(world);
    expect(ask).toMatchObject({ kind: 'push', subject: 'ak/ledger-export' });
    expect(ask.id).toContain(':abc123');
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain(
      'Waiting for you to confirm the push of ak/ledger-export at abc123',
    );
  });

  it('pushes the asked commit once on Push, and a second answer is dropped', async () => {
    const world = await worldOf({ push: 'ask' });
    await runChild({ world, child: pusher({}), text: done });
    const ask = await onlyAskOf(world);
    const answer = answererOf(world);

    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.pushes[0]).toMatchObject({ sha: 'abc123', isForce: false });
    expect(await pushRecordOf(world)).toMatchObject({ state: 'pushed', isConfirmed: true });
    expect(await asksOf(world)).toEqual([]);
  });

  it("keeps the commits local on Don't push, and Push now undoes it", async () => {
    const world = await worldOf({ push: 'ask' });
    await runChild({ world, child: pusher({}), text: done });
    const ask = await onlyAskOf(world);

    expect(await answererOf(world)({ askId: ask.id, answer: 'decline' })).toBe('declined');
    expect(world.state.ports.pushes).toEqual([]);
    expect(await pushRecordOf(world)).toMatchObject({ state: 'declined' });
    expect(await asksOf(world)).toEqual([]);

    const ids = (await delegationsOf(world)).map((delegation) => delegation.id);
    const now = await world.runtime.publish({ act: 'confirm', delegationIds: ids });
    expect(now.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toHaveLength(1);
  });

  it('pushes once on a retry after a failed push that was allowed', async () => {
    const world = await worldOf({ push: 'ask' });
    world.state.ports.setPushOutcomes([{ kind: 'failed', message: 'connection reset' }]);
    await runChild({ world, child: pusher({}), text: done });
    const ask = await onlyAskOf(world);
    await answererOf(world)({ askId: ask.id, answer: 'allow' });
    expect(await pushRecordOf(world)).toMatchObject({ state: 'failed', isRetryable: true });

    const ids = (await delegationsOf(world)).map((delegation) => delegation.id);
    const retried = await world.runtime.publish({ act: 'retry', delegationIds: ids });

    expect(retried.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toHaveLength(2);
    expect(await asksOf(world)).toEqual([]);
  });

  it('asks again for a newer commit and drops the answer for the older one', async () => {
    const world = await worldOf({ push: 'ask' });
    await runChild({ world, child: pusher({}), text: done });
    const older = await onlyAskOf(world);
    const newer: MountSnapshot = { head: 'def456', entries: [], isPartial: false };
    world.state.ports.setSnapshots(pathOf({ mount: LEDGER_MOUNT }), [END, newer]);
    await runChild({ world, child: pusher({}), text: done, index: 1 });

    const asks = await asksOf(world);
    expect(asks.map((ask) => ask.id)).toContain(older.id);
    const fresh = asks.find((ask) => ask.id !== older.id);
    expect(fresh?.id).toContain(':def456');
    expect(await pushRecordOf(world, 1)).toMatchObject({ state: 'awaiting_confirm' });
    expect(world.state.ports.pushes).toEqual([]);
  });

  it('pushes at once, as today, when the row says when checks pass', async () => {
    const world = await worldOf({ push: 'whenChecksPass' });
    await runChild({ world, child: pusher({}), text: done });

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(await pushRecordOf(world)).toMatchObject({ state: 'pushed' });
    expect(await asksOf(world)).toEqual([]);
  });

  it('holds on the workspace default while the Work switch is on', async () => {
    const world = await worldOf({});
    await writeLeadPermission({
      db: world.state.world.db,
      target: { workspaceId: brandId<WorkspaceId>({ value: 'workspace-harborline' }) },
      change: { key: 'push', value: 'ask' },
      nowMs: WORLD_NOW,
    });
    await setSetting(world.state.world.db, SETTING_WORK_ENABLED, 'true');
    await runChild({ world, child: pusher({}), text: done });

    expect(world.state.ports.pushes).toEqual([]);
    expect(await pushRecordOf(world)).toMatchObject({ state: 'awaiting_confirm' });
  });
});

describe('a force push', () => {
  it.each(['ask', 'whenChecksPass'] as const)(
    'asks at the push value %s and keeps a backup',
    async (push) => {
      const world = await worldOf({ push });
      world.state.ports.setRemoteReads(pathOf({ mount: LEDGER_MOUNT }), [
        { kind: 'sha', branch: 'ak/ledger-export', sha: 'remote111' },
      ]);
      await runChild({
        world,
        child: pusher({ publish: { mode: 'force', changesContent: true } }),
        text: done,
      });

      expect(world.state.ports.pushes).toEqual([]);
      expect(await pushRecordOf(world)).toMatchObject({ mode: 'force', state: 'awaiting_confirm' });
      expect(world.state.ports.backups.length).toBeGreaterThan(0);
      expect((await onlyAskOf(world)).kind).toBe('push');
    },
  );
});

describe('a pull request when its row says Ask', () => {
  it('holds the text after the Scribe returned and opens nothing', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.publications).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({
      state: 'awaiting_confirm',
      mountId: LEDGER_MOUNT.id,
      title: TITLE,
      body: BODY,
    });
    const ask = await onlyAskOf(world);
    expect(ask).toMatchObject({ kind: 'pull_request', subject: LEDGER_MOUNT.id });
    expect((await delegationsOf(world))[0]?.outcome).toBe('completed');
    expect(world.state.ports.autoTurns.at(-1)?.text).toContain(
      `The pull request waits for you to open it: ${TITLE}`,
    );
  });

  it('publishes the text the ask holds, byte for byte, and opens it once', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    const held = await pullRequestRecordOf(world);
    const answer = answererOf(world);

    const [first, second] = await Promise.all([
      answer({ askId: ask.id, answer: 'allow' }),
      answer({ askId: ask.id, answer: 'allow' }),
    ]);
    expect([first, second]).toEqual(['allowed', 'allowed']);
    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]?.output.prTitle).toBe(held?.title);
    expect(world.state.ports.publications[0]?.output.prBody).toBe(held?.body);
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'opened', number: 421 });
    const grant = await getAutoGrant({
      db: world.state.world.db,
      grantId: brandId<AutoGrantId>({ value: held?.grantId ?? '' }),
    });
    expect(grant?.state).toBe('used');
    expect(await asksOf(world)).toEqual([]);
  });

  it('keeps the text on Not yet and opens it on a later Open', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    const answer = answererOf(world);

    expect(await answer({ askId: ask.id, answer: 'decline' })).toBe('declined');
    expect(world.state.ports.publications).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'declined', title: TITLE });
    expect(await asksOf(world)).toEqual([]);

    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    expect(world.state.ports.publications).toHaveLength(1);
  });

  it('keeps the text when the host refuses, and Open again retries once', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    world.state.ports.setPublications([
      { kind: 'failed', message: 'GitHub refused the pull request: base branch is missing.' },
    ]);
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    const answer = answererOf(world);

    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    expect(await pullRequestRecordOf(world)).toMatchObject({
      state: 'failed',
      title: TITLE,
      message: 'GitHub refused the pull request: base branch is missing.',
    });

    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'opened' });
    expect(world.state.ports.publications).toHaveLength(2);
  });

  it('asks again for an update and drops the answer for the older text', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const older = await onlyAskOf(world);
    await runChild({
      world,
      child: scribe({}),
      text: (id) => scribeText(id).replace(TITLE, 'Add the ledger export as CSV'),
      index: 1,
    });

    const asks = await asksOf(world);
    expect(asks).toHaveLength(1);
    expect(asks[0]?.id).not.toBe(older.id);
    expect(await answererOf(world)({ askId: older.id, answer: 'allow' })).toBe('settled');
    expect(world.state.ports.publications).toEqual([]);
  });

  it('opens at once, as today, when the row says Allow', async () => {
    const world = await worldOf({ pullRequest: 'allow' });
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]?.output).toMatchObject({
      prTitle: TITLE,
      prBody: BODY,
    });
    expect(await pullRequestRecordOf(world)).toBeNull();
    expect(await asksOf(world)).toEqual([]);
  });
});

describe('a pull request while the push row says Ask', () => {
  it('holds a pull request at Allow behind a push ask for the commit, then opens it', async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'allow' });
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.publications).toEqual([]);
    expect(world.state.ports.pushes).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({
      state: 'awaiting_push',
      grantId: null,
      title: TITLE,
      message: 'The pull request opens after you push ak/ledger-export at abc123',
    });
    const ask = await onlyAskOf(world);
    expect(ask).toMatchObject({ kind: 'push', subject: 'ak/ledger-export' });
    expect(ask.id).toContain(':abc123');

    expect(await answererOf(world)({ askId: ask.id, answer: 'allow' })).toBe('allowed');

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.pushes[0]).toMatchObject({ sha: 'abc123', isForce: false });
    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]?.output).toMatchObject({
      prTitle: TITLE,
      prBody: BODY,
    });
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'opened', number: 421 });
    expect(await asksOf(world)).toEqual([]);
  });

  it("raises the push ask on Open, keeps the pull request held on Don't push, opens after Push now", async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const pullRequestAsk = await onlyAskOf(world);
    expect(pullRequestAsk.kind).toBe('pull_request');

    expect(await answererOf(world)({ askId: pullRequestAsk.id, answer: 'allow' })).toBe('allowed');
    expect(world.state.ports.publications).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'awaiting_push' });
    const pushAsk = await onlyAskOf(world);
    expect(pushAsk.kind).toBe('push');

    expect(await answererOf(world)({ askId: pushAsk.id, answer: 'decline' })).toBe('declined');
    expect(world.state.ports.pushes).toEqual([]);
    expect(world.state.ports.publications).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({
      state: 'awaiting_push',
      message:
        'Not opened: you declined the push of ak/ledger-export, and the pull request needs it online first',
    });

    const ids = (await delegationsOf(world)).map((delegation) => delegation.id);
    const now = await world.runtime.publish({ act: 'confirm', delegationIds: ids });
    expect(now.rows[0]).toMatchObject({ state: 'pushed' });
    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.publications).toHaveLength(1);
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'opened' });
  });

  it('reuses the push ask a writer already raised for the same commit', async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'allow' });
    await runChild({ world, child: pusher({}), text: done });
    const writerAsk = await onlyAskOf(world);
    await runChild({ world, child: scribe({}), text: scribeText, index: 1 });

    expect((await asksOf(world)).map((ask) => ask.id)).toEqual([writerAsk.id]);
    await answererOf(world)({ askId: writerAsk.id, answer: 'allow' });

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.publications).toHaveLength(1);
    const scribeRow = (await delegationsOf(world)).find((row) => row.role === 'scribe');
    expect(pullRequestOfResult({ result: scribeRow?.result })).toMatchObject({ state: 'opened' });
  });

  it('opens at once when the commit is already on the host', async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'allow' });
    world.state.ports.setRemoteReads(pathOf({ mount: LEDGER_MOUNT }), [
      { kind: 'sha', branch: 'ak/ledger-export', sha: 'abc123' },
    ]);
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.pushes).toEqual([]);
    expect(await asksOf(world)).toEqual([]);
  });
});

describe('the push a pull request needs', () => {
  it('opens the pull request on the commit the gate checked', async () => {
    const world = await worldOf({ pullRequest: 'allow' });
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]?.sha).toBe('abc123');
  });

  it('opens nothing over a change no allowance covers, at the push value when checks pass', async () => {
    const world = await worldOf({ pullRequest: 'allow' });
    await setRow({ world, change: { key: 'protectedFiles', value: 'ask' } });
    world.state.ports.setHostChanges(pathOf({ mount: LEDGER_MOUNT }), [
      'src/export.ts',
      '.github/workflows/ci.yml',
    ]);
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(world.state.ports.hostReads.at(-1)).toMatchObject({ head: 'abc123' });
    expect(world.state.ports.publications).toEqual([]);
    expect(world.state.ports.pushes).toEqual([]);
  });

  it('raises no push ask over a change no allowance covers', async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'allow' });
    await setRow({ world, change: { key: 'dependencies', value: 'ask' } });
    world.state.ports.setHostChanges(pathOf({ mount: LEDGER_MOUNT }), ['pnpm-lock.yaml']);
    await runChild({ world, child: scribe({}), text: scribeText });

    expect(await asksOf(world)).toEqual([]);
    expect(world.state.ports.publications).toEqual([]);
  });
});

describe('a held pull request and the rows of now', () => {
  it('asks for the pull request when its row turned to Ask while it waited for the push', async () => {
    const world = await worldOf({ push: 'ask', pullRequest: 'allow' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const pushAsk = await onlyAskOf(world);
    await setRow({ world, change: { key: 'pullRequest', value: 'ask' } });

    expect(await answererOf(world)({ askId: pushAsk.id, answer: 'allow' })).toBe('allowed');

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.publications).toEqual([]);
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'awaiting_confirm' });
    const pullRequestAsk = await onlyAskOf(world);
    expect(pullRequestAsk.kind).toBe('pull_request');

    expect(await answererOf(world)({ askId: pullRequestAsk.id, answer: 'allow' })).toBe('allowed');
    expect(world.state.ports.publications).toHaveLength(1);
  });

  it('drops a pull request answer after Stop started a new generation', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    await world.state.world.db.execute(
      'UPDATE auto_trees SET generation = generation + 1 WHERE id = ?',
      [world.treeId],
    );

    expect(await answererOf(world)({ askId: ask.id, answer: 'allow' })).toBe('settled');
    expect(world.state.ports.publications).toEqual([]);
  });

  it('opens nothing again for an older generation after the host refused it', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    world.state.ports.setPublications([{ kind: 'failed', message: 'base branch is missing.' }]);
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    const answer = answererOf(world);
    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    await world.state.world.db.execute(
      'UPDATE auto_trees SET generation = generation + 1 WHERE id = ?',
      [world.treeId],
    );

    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');
    expect(world.state.ports.publications).toHaveLength(1);
  });

  it('says so when the host opened the pull request and the save after it failed', async () => {
    const world = await worldOf({ pullRequest: 'ask' });
    await runChild({ world, child: scribe({}), text: scribeText });
    const ask = await onlyAskOf(world);
    const db = world.runtime.ctx.db;
    const transaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, 'transaction').mockImplementation(async (params) => {
      const isOpenedSave = params.statements.some((statement) =>
        (statement.params ?? []).some(
          (value) => typeof value === 'string' && value.includes('"state":"opened"'),
        ),
      );
      if (isOpenedSave) {
        throw new Error('database is locked');
      }
      return transaction(params);
    });

    await expect(answererOf(world)({ askId: ask.id, answer: 'allow' })).rejects.toThrow(
      'Pull request #421 is open at https://github.com/harborline/ledger-core/pull/421, but Goodboy could not save that',
    );
    spy.mockRestore();
    expect(await pullRequestRecordOf(world)).toMatchObject({ state: 'opening' });
  });
});

describe.each([
  ['GitHub', LEDGER_MOUNT],
  ['GitLab', GITLAB_MOUNT],
  ['Bitbucket', BITBUCKET_MOUNT],
])('the gates on a %s mount', (_host, mount) => {
  it('asks before the push and pushes that mount on Push', async () => {
    const world = await worldOf({ mount, push: 'ask' });
    await runChild({ world, child: pusher({ mount }), text: done });
    const ask = await onlyAskOf(world);
    expect(ask.subject).toBe(mount.branch);

    await answererOf(world)({ askId: ask.id, answer: 'allow' });

    expect(world.state.ports.pushes).toHaveLength(1);
    expect(world.state.ports.pushes[0]).toMatchObject({
      mountId: mount.id,
      worktreePath: mount.worktreePath,
      branch: mount.branch,
    });
  });

  it('asks before the pull request and publishes on that mount on Open', async () => {
    const world = await worldOf({ mount, pullRequest: 'ask' });
    await runChild({ world, child: scribe({ mount }), text: scribeText });
    const ask = await onlyAskOf(world);
    expect(ask.subject).toBe(mount.id);

    await answererOf(world)({ askId: ask.id, answer: 'allow' });

    expect(world.state.ports.publications).toHaveLength(1);
    expect(world.state.ports.publications[0]).toMatchObject({
      mountId: mount.id,
      output: { prTitle: TITLE, prBody: BODY },
    });
  });
});
