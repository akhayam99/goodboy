import { describe, expect, it } from 'vitest';
import {
  launchGuardRulesOf,
  storedLaunchGuardOf,
  type LeadPermissionValue,
} from '@goodboy/core/auto';
import { getAutoGrant, listAutoAttemptsOfDelegation, listAutoDelegations } from '@goodboy/db';
import { AUTO_SEED_SESSION } from '@goodboy/db/test-helpers/auto-seeds';
import { readAutoTreeViews } from '../../../slices/auto-view/readAutoTreeViews';
import { createAskAnswerer } from '../asks/createAskAnswerer';
import { leadAsksOf } from '../asks/leadAsksOf';
import { parseLeadAskId } from '../asks/parseLeadAskId';
import { writeLeadPermission } from '../level/writeLeadPermission';
import { LEDGER_MOUNT } from '../testing/fakePorts';
import { WORLD_NOW } from '../testing/autoWorld';
import {
  autoDelegates,
  autoTurnEnds,
  childTurnEnds,
  makeRuntimeWorld,
  userSays,
  type RuntimeWorld,
} from '../testing/runtimeWorld';

const DEPENDENCY_NEED = 'nock 14.0.1: stubs the host in the retry tests';
const FILE_NEED = '.github/workflows/ci.yml: run the retry tests in CI';

type Rows = {
  readonly dependencies?: LeadPermissionValue<'dependencies'>;
  readonly protectedFiles?: LeadPermissionValue<'protectedFiles'>;
};

const worldOf = async ({ dependencies, protectedFiles }: Rows) => {
  const world = await makeRuntimeWorld({ capUsd: 10 });
  world.state.ports.setMounts([LEDGER_MOUNT]);
  const db = world.state.world.db;
  const target = { treeId: world.treeId };
  if (dependencies !== undefined) {
    await writeLeadPermission({
      db,
      target,
      change: { key: 'dependencies', value: dependencies },
      nowMs: WORLD_NOW,
    });
  }
  if (protectedFiles !== undefined) {
    await writeLeadPermission({
      db,
      target,
      change: { key: 'protectedFiles', value: protectedFiles },
      nowMs: WORLD_NOW,
    });
  }
  await userSays({ world, id: 'outbox-user-1', text: 'cover the payments-api retries' });
  const outcome = await autoDelegates({
    world,
    spec: {
      children: [
        {
          role: 'tester',
          task: 'cover the payments-api retries',
          reason: 'tests are the work of a tester',
          mount: LEDGER_MOUNT.id,
        },
      ],
    },
  });
  if (!outcome.isOk) {
    throw new Error(`the delegate was refused: ${outcome.error ?? ''}`);
  }
  await autoTurnEnds({ world });
  return world;
};

type WorldParams = {
  readonly world: RuntimeWorld;
};

type TurnParams = WorldParams & {
  readonly index: number;
};

const turnOf = ({ world, index }: TurnParams) => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`child turn ${index} was expected`);
  }
  return turn;
};

const attemptOf = async ({ world, index }: TurnParams) => {
  const turn = turnOf({ world, index });
  const attempts = await listAutoAttemptsOfDelegation({
    db: world.state.world.db,
    delegationId: turn.delegationId,
  });
  const attempt = attempts.find((candidate) => candidate.id === turn.attemptId);
  if (attempt === undefined) {
    throw new Error('the attempt of the turn was expected');
  }
  return attempt;
};

const guardOf = async ({ world, index }: TurnParams) =>
  storedLaunchGuardOf({ writeSet: (await attemptOf({ world, index })).writeSet });

type NeedParams = WorldParams & {
  readonly need: 'dependency' | 'protected_file';
  readonly line: string;
};

const childNeeds = async ({ world, need, line }: NeedParams) => {
  const turn = turnOf({ world, index: 0 });
  await childTurnEnds({
    world,
    index: 0,
    text: `I stopped before the install.\n<<step-done id="${turn.childAgentId}" status="returned" needs="${need}">>\n${line}`,
  });
  if (world.state.ports.autoTurns.length > 0) {
    await autoTurnEnds({ world, text: 'Waiting for the user.' });
  }
};

const grantAsksOf = async ({ world }: WorldParams) => {
  const views = await readAutoTreeViews({ db: world.state.world.db, sessionId: AUTO_SEED_SESSION });
  return views
    .flatMap((view) => leadAsksOf({ view }))
    .filter((ask) => parseLeadAskId({ askId: ask.id })?.kind === 'grant');
};

const leadTurnEnds = async ({ world }: WorldParams) => {
  await world.runtime.settled();
  await autoTurnEnds({ world, text: 'The agent starts again.' });
};

const answererOf = ({ world }: WorldParams) =>
  createAskAnswerer({ runtimeOf: () => world.runtime });

describe('the launch guard of an agent', () => {
  it('starts an agent whose rows allow exactly as today', async () => {
    const world = await worldOf({});

    const attempt = await attemptOf({ world, index: 0 });

    expect(attempt.writeSet).toEqual({ worktreePath: LEDGER_MOUNT.worktreePath });
    expect(turnOf({ world, index: 0 }).text).not.toContain('**Dependencies**');
    expect(turnOf({ world, index: 0 }).text).not.toContain('**Protected files**');
  });

  it('starts an agent whose rows ask with the guard stored and the brief that says stop', async () => {
    const world = await worldOf({ dependencies: 'ask', protectedFiles: 'ask' });

    expect(await guardOf({ world, index: 0 })).toEqual({
      dependencies: 'ask',
      protectedFiles: 'ask',
      allowedPackages: [],
      allowedPaths: [],
    });
    const text = turnOf({ world, index: 0 }).text;
    expect(text).toContain('**Dependencies**');
    expect(text).toContain('needs="dependency"');
    expect(text).toContain('**Protected files**');
  });

  it('keeps the stored rules of a started attempt when the row changes later', async () => {
    const world = await worldOf({ dependencies: 'ask' });
    await writeLeadPermission({
      db: world.state.world.db,
      target: { treeId: world.treeId },
      change: { key: 'dependencies', value: 'allow' },
      nowMs: WORLD_NOW,
    });

    expect((await guardOf({ world, index: 0 }))?.dependencies).toBe('ask');
  });

  it('asks for the package the agent names and starts it again with that one allowance', async () => {
    const world = await worldOf({ dependencies: 'ask', protectedFiles: 'ask' });
    await childNeeds({ world, need: 'dependency', line: DEPENDENCY_NEED });
    const [ask] = await grantAsksOf({ world });
    if (ask === undefined) {
      throw new Error('a dependency ask was expected');
    }
    const ref = parseLeadAskId({ askId: ask.id });
    const grantId = ref?.kind === 'grant' ? ref.grantId : null;
    if (grantId === null) {
      throw new Error('a grant ask was expected');
    }
    expect(await getAutoGrant({ db: world.state.world.db, grantId })).toMatchObject({
      kind: 'dependency',
      subject: 'nock@14.0.1',
      state: 'asked',
    });

    const answer = answererOf({ world });
    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    expect(await answer({ askId: ask.id, answer: 'allow' })).toBe('settled');
    await leadTurnEnds({ world });

    expect(world.state.ports.childTurns).toHaveLength(2);
    const guard = await guardOf({ world, index: 1 });
    expect(guard).toEqual({
      dependencies: 'allow',
      protectedFiles: 'ask',
      allowedPackages: ['nock@14.0.1'],
      allowedPaths: [],
    });
    const rules = guard === null ? null : launchGuardRulesOf({ guard });
    expect(rules?.isNetworkOff).toBe(false);
    expect(rules?.env).toEqual([]);
    expect(rules?.deniedTools).toContain('Edit(.github/workflows/**)');
    expect(rules?.deniedTools).not.toContain('Bash(pnpm add:*)');
    expect(turnOf({ world, index: 1 }).text).toContain('You may add nock@14.0.1');
    expect(await getAutoGrant({ db: world.state.world.db, grantId })).toMatchObject({
      state: 'used',
    });
    expect(await grantAsksOf({ world })).toEqual([]);
  });

  it('starts the agent again with the answer in the brief when the user says do it without', async () => {
    const world = await worldOf({ dependencies: 'ask' });
    await childNeeds({ world, need: 'dependency', line: DEPENDENCY_NEED });
    const [ask] = await grantAsksOf({ world });
    if (ask === undefined) {
      throw new Error('a dependency ask was expected');
    }

    expect(await answererOf({ world })({ askId: ask.id, answer: 'decline' })).toBe('declined');
    await leadTurnEnds({ world });

    expect(world.state.ports.childTurns).toHaveLength(2);
    expect(turnOf({ world, index: 1 }).text).toContain('did not allow nock@14.0.1');
    expect((await guardOf({ world, index: 1 }))?.dependencies).toBe('ask');
  });

  it('lifts only the protected file the user allows', async () => {
    const world = await worldOf({ protectedFiles: 'ask' });
    await childNeeds({ world, need: 'protected_file', line: FILE_NEED });
    const [ask] = await grantAsksOf({ world });
    if (ask === undefined) {
      throw new Error('a protected file ask was expected');
    }

    expect(await answererOf({ world })({ askId: ask.id, answer: 'allow' })).toBe('allowed');
    await leadTurnEnds({ world });

    const guard = await guardOf({ world, index: 1 });
    expect(guard?.allowedPaths).toEqual(['.github/workflows/ci.yml']);
    const rules = guard === null ? null : launchGuardRulesOf({ guard });
    expect(rules?.deniedTools).not.toContain('Edit(.github/workflows/**)');
    expect(rules?.deniedTools).toContain('Edit(CODEOWNERS)');
    expect(rules?.isNetworkOff).toBe(false);
  });

  it('asks nothing when the row allows what the agent names', async () => {
    const world = await worldOf({ protectedFiles: 'ask' });
    await childNeeds({ world, need: 'dependency', line: DEPENDENCY_NEED });

    expect(await grantAsksOf({ world })).toEqual([]);
    const delegations = await listAutoDelegations({
      db: world.state.world.db,
      treeId: world.treeId,
    });
    expect(delegations[0]?.outcome).toBe('blocked');
  });
});
