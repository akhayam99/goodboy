// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppStore } from '../../../store/store';
import { clearActionLedger } from './actionLedger';
import { RATE_WINDOWS, clearRateSlots } from './actionLimits';
import type { StartPorts } from './handlerTypes';
import { executePhoneAction } from './executePhoneAction';
import { parsePhoneAction } from './parsePhoneAction';
import { registerPhoneScope, resetPhoneScope } from './phonePermissionScope';
import {
  mergePrActionIdOf,
  startActionIdOf,
  stopTrainActionIdOf,
  trainActionIdOf,
} from './phoneActionIds';
import { MAX_STARTS_PER_DAY, clearStartState } from './startState';

const facts = vi.hoisted(() => ({
  byId: new Map<string, { pr: Record<string, unknown> | null; mountId: string | null }>(),
  blocked: new Map<string, string>(),
}));

vi.mock('../mobileConfinement', () => ({
  mobileMergeFacts: ({ sessionId }: { sessionId: string }) =>
    facts.byId.get(sessionId) ?? { pr: null, mountId: null },
  evaluateMobileMerge: ({
    facts: found,
  }: {
    facts: { pr: Record<string, unknown> | null };
    method: string;
  }) => {
    const reason = facts.blocked.get(String(found.pr?.number));
    return reason === undefined
      ? { ok: true, pr: found.pr, method: 'squash' }
      : { ok: false, reason };
  },
}));

vi.mock('../../board/mergeTrain/readyCarsOf', () => ({
  readyCarsOf: ({ rows }: { rows: ReadonlyArray<{ sessionId: string; number: number }> }) =>
    rows.map((row) => ({
      sessionId: row.sessionId,
      number: row.number,
      mountId: `mount-${row.sessionId}`,
      repo: 'payments-api',
      base: 'main',
    })),
}));

const WORKSPACE = 'ws-harborline';
const HEAD_ONE = 'aaaa111122223333';
const HEAD_TWO = 'bbbb444455556666';

type StoreOptions = {
  readonly train?: { id: string; outcome: unknown } | null;
};

type Kit = {
  readonly store: AppStore;
  readonly mergePr: ReturnType<typeof vi.fn>;
  readonly startMergeTrain: ReturnType<typeof vi.fn>;
  readonly stopMergeTrainAfterThis: ReturnType<typeof vi.fn>;
  readonly createSession: ReturnType<typeof vi.fn>;
  readonly runAfterMergeCleanup: ReturnType<typeof vi.fn>;
};

const kitOf = ({ train = null }: StoreOptions = {}): Kit => {
  const mergePr = vi.fn(async () => undefined);
  const startMergeTrain = vi.fn(async () => ({ kind: 'done', merged: 2 }));
  const stopMergeTrainAfterThis = vi.fn(() => true);
  const createSession = vi.fn(async (input: { goal: string }) => ({
    session: { id: `ses-${input.goal.length}` },
  }));
  const runAfterMergeCleanup = vi.fn(async () => ({ kind: 'skipped' }));
  const store = {
    sessions: [
      { id: 'ses-one', workspaceId: WORKSPACE },
      { id: 'ses-two', workspaceId: WORKSPACE },
      { id: 'ses-other', workspaceId: 'ws-northwind' },
    ],
    workspaces: [{ id: WORKSPACE }, { id: 'ws-northwind' }],
    projects: [
      { id: 'proj-ledger', workspaceId: WORKSPACE, name: 'ledger-core' },
      { id: 'proj-notify', workspaceId: 'ws-northwind', name: 'notify-relay' },
    ],
    phaseTemplates: {
      [WORKSPACE]: [{ id: 'preset-layout', isPreset: true, name: 'Fix a layout' }],
    },
    workspaceOverrides: {},
    mergeTrain: train,
    mergePr,
    startMergeTrain,
    stopMergeTrainAfterThis,
    createSession,
    runAfterMergeCleanup,
    reportError: vi.fn(),
  } as unknown as AppStore;
  return {
    store,
    mergePr,
    startMergeTrain,
    stopMergeTrainAfterThis,
    createSession,
    runAfterMergeCleanup,
  };
};

const portsOf = (): StartPorts & {
  readonly launch: ReturnType<typeof vi.fn>;
  readonly discard: ReturnType<typeof vi.fn>;
} => ({
  resolveTask: vi.fn(async () => ({
    goal: 'Fix the rounding bug',
    externalTask: {
      provider: 'linear' as const,
      externalId: 'abc',
      identifier: 'HBL-419',
      url: 'https://example.invalid/HBL-419',
      title: 'Rounding',
    },
  })),
  launch: vi.fn(async () => undefined),
  discard: vi.fn(async () => undefined),
});

type PrOptions = {
  readonly number: number;
  readonly head: string;
};

const setPr = ({ number, head }: PrOptions): void => {
  facts.byId.set(`ses-${number === 11 ? 'one' : 'two'}`, {
    pr: { number, headSha: head, headBranch: `feat/${number}`, state: 'approved' },
    mountId: null,
  });
};

const mergeRaw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: 'mergePr',
  actionId: mergePrActionIdOf({ prNumber: 11, headSha: HEAD_ONE }),
  workspaceId: WORKSPACE,
  sessionId: 'ses-one',
  prNumber: 11,
  expectedHeadSha: HEAD_ONE,
  method: 'squash',
  shouldDeleteBranch: false,
  ...over,
});

const ENTRIES = [
  { sessionId: 'ses-one', prNumber: 11, expectedHeadSha: HEAD_ONE },
  { sessionId: 'ses-two', prNumber: 12, expectedHeadSha: HEAD_TWO },
];

const trainRaw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: 'mergeTrain',
  actionId: trainActionIdOf({ workspaceId: WORKSPACE, entries: ENTRIES }),
  workspaceId: WORKSPACE,
  method: 'squash',
  entries: ENTRIES,
  ...over,
});

const startRaw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  kind: 'startSession',
  actionId: startActionIdOf({ workspaceId: WORKSPACE }),
  workspaceId: WORKSPACE,
  projectId: 'proj-ledger',
  goal: 'Scout the ledger folder',
  task: null,
  access: 'askFirst',
  startKind: 'lead',
  presetId: null,
  limitUsd: null,
  ...over,
});

type RunParams = {
  readonly raw: Record<string, unknown>;
  readonly kit: Kit;
  readonly ports?: StartPorts;
  readonly now?: number;
};

const run = async ({ raw, kit, ports = portsOf(), now = 1_000 }: RunParams) => {
  const action = parsePhoneAction({ raw });
  if (action === null) {
    throw new Error('the action did not parse');
  }
  return executePhoneAction({ action, phoneId: 'phone-1', getStore: () => kit.store, ports, now });
};

beforeEach(() => {
  clearActionLedger();
  clearRateSlots();
  clearStartState();
  resetPhoneScope();
  facts.byId.clear();
  facts.blocked.clear();
  setPr({ number: 11, head: HEAD_ONE });
  setPr({ number: 12, head: HEAD_TWO });
});

describe('mergePr', () => {
  it('merges the head the phone saw and deletes the branch only when asked', async () => {
    const kit = kitOf();
    const done = await run({ raw: mergeRaw({ shouldDeleteBranch: true }), kit });
    expect(done.result).toBe('done');
    expect(kit.mergePr).toHaveBeenCalledWith('ses-one', 11, 'squash', {
      expectedHeadSha: HEAD_ONE,
    });
    expect(kit.runAfterMergeCleanup).not.toHaveBeenCalled();
  });

  it('refuses a head that moved and names both heads', async () => {
    const kit = kitOf();
    setPr({ number: 11, head: 'cccc777788889999' });
    const refused = await run({ raw: mergeRaw(), kit });
    expect(refused.refusal?.code).toBe('version-changed');
    expect(refused.refusal?.changes).toEqual([{ label: 'Head', was: 'aaaa111', now: 'cccc777' }]);
    expect(kit.mergePr).not.toHaveBeenCalled();
  });

  it('refuses with the desktop reason when the merge rule blocks', async () => {
    const kit = kitOf();
    facts.blocked.set('11', 'A reviewer asked for changes.');
    const refused = await run({ raw: mergeRaw(), kit });
    expect(refused.refusal).toMatchObject({
      code: 'not-mergeable',
      message: 'A reviewer asked for changes.',
    });
  });

  it('refuses an id the Mac did not offer', async () => {
    const kit = kitOf();
    const refused = await run({ raw: mergeRaw({ actionId: 'act:mergePr:11:other' }), kit });
    expect(refused.refusal?.code).toBe('unknown-target');
  });

  it('refuses without the merge permission', async () => {
    registerPhoneScope({ read: ({ permission }) => permission !== 'merge' });
    const kit = kitOf();
    const refused = await run({ raw: mergeRaw(), kit });
    expect(refused.refusal?.code).toBe('not-permitted');
    expect(kit.mergePr).not.toHaveBeenCalled();
  });

  it('replays a retry with the same id and merges once', async () => {
    const kit = kitOf();
    await run({ raw: mergeRaw(), kit });
    const retry = await run({ raw: mergeRaw(), kit });
    expect(retry).toMatchObject({ result: 'done', isReplay: true });
    expect(kit.mergePr).toHaveBeenCalledTimes(1);
  });

  it('is rate limited per minute', async () => {
    const kit = kitOf();
    const seen: string[] = [];
    for (let at = 0; at <= RATE_WINDOWS.mergePr.max; at += 1) {
      const outcome = await run({
        raw: mergeRaw({
          actionId: mergePrActionIdOf({ prNumber: 11, headSha: `${HEAD_ONE}${at}` }),
          expectedHeadSha: `${HEAD_ONE}${at}`,
        }),
        kit,
      });
      seen.push(outcome.refusal?.code ?? outcome.result);
    }
    expect(seen.at(-1)).toBe('rate-limited');
  });
});

describe('mergeTrain', () => {
  it('starts one train with every car the phone listed, in order', async () => {
    const kit = kitOf();
    const done = await run({ raw: trainRaw(), kit });
    expect(done.result).toBe('done');
    expect(kit.startMergeTrain).toHaveBeenCalledTimes(1);
    const [call] = kit.startMergeTrain.mock.calls as unknown as ReadonlyArray<
      ReadonlyArray<{ method: string; cars: ReadonlyArray<{ prNumber: number; mountId: string }> }>
    >;
    expect(call?.[0]?.method).toBe('squash');
    expect(call?.[0]?.cars.map((car) => car.prNumber)).toEqual([11, 12]);
  });

  it('stops before the first car when a head changed since the phone looked', async () => {
    const kit = kitOf();
    setPr({ number: 12, head: 'dddd000011112222' });
    const refused = await run({ raw: trainRaw(), kit });
    expect(refused.refusal).toMatchObject({ code: 'version-changed' });
    expect(refused.refusal?.message).toContain('#12');
    expect(kit.startMergeTrain).not.toHaveBeenCalled();
  });

  it('refuses a car the merge rule blocks and says which', async () => {
    const kit = kitOf();
    facts.blocked.set('12', 'checks are failing.');
    const refused = await run({ raw: trainRaw(), kit });
    expect(refused.refusal).toMatchObject({
      code: 'not-mergeable',
      message: '#12 checks are failing.',
    });
    expect(kit.startMergeTrain).not.toHaveBeenCalled();
  });

  it('answers busy while another train runs', async () => {
    const kit = kitOf({ train: { id: 'train-1', outcome: null } });
    const refused = await run({ raw: trainRaw(), kit });
    expect(refused.refusal?.code).toBe('busy');
    expect(kit.startMergeTrain).not.toHaveBeenCalled();
  });

  it('refuses an empty list, a repeated pull request and a car from another workspace', async () => {
    const kit = kitOf();
    const empty = await run({
      raw: trainRaw({
        entries: [],
        actionId: trainActionIdOf({ workspaceId: WORKSPACE, entries: [] }),
      }),
      kit,
    });
    expect(empty.refusal?.code).toBe('invalid-request');
    const twice = [ENTRIES[0], ENTRIES[0]];
    const repeated = await run({
      raw: trainRaw({
        entries: twice,
        actionId: trainActionIdOf({
          workspaceId: WORKSPACE,
          entries: twice.flatMap((entry) => (entry === undefined ? [] : [entry])),
        }),
      }),
      kit,
    });
    expect(repeated.refusal?.code).toBe('invalid-request');
    const foreign = [{ sessionId: 'ses-other', prNumber: 5, expectedHeadSha: 'eeee' }];
    const outsider = await run({
      raw: trainRaw({
        entries: foreign,
        actionId: trainActionIdOf({ workspaceId: WORKSPACE, entries: foreign }),
      }),
      kit,
    });
    expect(outsider.refusal?.code).toBe('unknown-target');
  });

  it('needs the merge permission', async () => {
    registerPhoneScope({ read: ({ permission }) => permission !== 'merge' });
    const kit = kitOf();
    const refused = await run({ raw: trainRaw(), kit });
    expect(refused.refusal?.code).toBe('not-permitted');
  });

  it('starts one train for a retry with the same id and a new id for the next train', async () => {
    const kit = kitOf();
    const firstId = trainActionIdOf({ workspaceId: WORKSPACE, entries: ENTRIES });
    await run({ raw: trainRaw({ actionId: firstId }), kit });
    const retry = await run({ raw: trainRaw({ actionId: firstId }), kit });
    expect(retry.isReplay).toBe(true);
    expect(kit.startMergeTrain).toHaveBeenCalledTimes(1);
    const nextId = trainActionIdOf({ workspaceId: WORKSPACE, entries: ENTRIES });
    expect(nextId).not.toBe(firstId);
    const second = await run({ raw: trainRaw({ actionId: nextId }), kit });
    expect(second.result).toBe('done');
    expect(kit.startMergeTrain).toHaveBeenCalledTimes(2);
  });
});

describe('stopTrain', () => {
  const stopRaw = (trainId: string): Record<string, unknown> => ({
    kind: 'stopTrain',
    actionId: stopTrainActionIdOf({ trainId }),
    workspaceId: WORKSPACE,
    trainId,
  });

  it('asks the train to stop after the pull request in progress', async () => {
    const kit = kitOf({ train: { id: 'train-1', outcome: null } });
    const done = await run({ raw: stopRaw('train-1'), kit });
    expect(done.result).toBe('done');
    expect(kit.stopMergeTrainAfterThis).toHaveBeenCalledTimes(1);
  });

  it('refuses a train that is not this one or already ended', async () => {
    const kit = kitOf({ train: { id: 'train-1', outcome: { kind: 'done' } } });
    expect((await run({ raw: stopRaw('train-9'), kit })).refusal?.code).toBe('unknown-target');
    expect((await run({ raw: stopRaw('train-1'), kit })).refusal?.code).toBe('already-decided');
    expect(kit.stopMergeTrainAfterThis).not.toHaveBeenCalled();
  });
});

describe('startSession', () => {
  it('maps each access to a mode and never to full access', async () => {
    const seen: string[] = [];
    for (const access of ['readOnly', 'askFirst', 'editsAllowed']) {
      clearStartState();
      clearActionLedger();
      clearRateSlots();
      const ports = portsOf();
      await run({ raw: startRaw({ access }), kit: kitOf(), ports });
      const [call] = ports.launch.mock.calls as unknown as ReadonlyArray<
        ReadonlyArray<{ mode: string }>
      >;
      seen.push(call?.[0]?.mode ?? 'none');
    }
    expect(seen).toEqual(['plan', 'default', 'acceptEdits']);
    expect(seen).not.toContain('bypassPermissions');
  });

  it('does not parse full access or an access the Mac never offered', () => {
    expect(parsePhoneAction({ raw: startRaw({ access: 'bypassPermissions' }) })).toBeNull();
    expect(parsePhoneAction({ raw: startRaw({ access: 'fullAccess' }) })).toBeNull();
    expect(parsePhoneAction({ raw: startRaw({ startKind: 'workflow' }) })).toBeNull();
  });

  it('is refused when the phone may not start sessions', async () => {
    registerPhoneScope({ read: ({ permission }) => permission !== 'start' });
    const kit = kitOf();
    const ports = portsOf();
    const refused = await run({ raw: startRaw(), kit, ports });
    expect(refused.refusal?.code).toBe('not-permitted');
    expect(kit.createSession).not.toHaveBeenCalled();
  });

  it('makes one session for a retry with the same id and a new id for the next start', async () => {
    const kit = kitOf();
    const ports = portsOf();
    const firstId = startActionIdOf({ workspaceId: WORKSPACE });
    const first = await run({ raw: startRaw({ actionId: firstId }), kit, ports });
    expect(first.createdSessionId).not.toBeNull();
    const retry = await run({ raw: startRaw({ actionId: firstId }), kit, ports });
    expect(retry).toMatchObject({ isReplay: true, createdSessionId: first.createdSessionId });
    expect(kit.createSession).toHaveBeenCalledTimes(1);
    const nextId = startActionIdOf({ workspaceId: WORKSPACE });
    expect(nextId).not.toBe(firstId);
    const second = await run({ raw: startRaw({ actionId: nextId }), kit, ports });
    expect(second.result).toBe('done');
    expect(kit.createSession).toHaveBeenCalledTimes(2);
  });

  it('discards the session and keeps nothing when the run fails to start', async () => {
    const kit = kitOf();
    const ports = portsOf();
    ports.launch.mockRejectedValueOnce(new Error('provider missing'));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failed = await run({ raw: startRaw(), kit, ports });
    expect(failed.result).toBe('failed');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(ports.discard).toHaveBeenCalledTimes(1);
    const retry = await run({ raw: startRaw(), kit, ports });
    expect(retry).toMatchObject({ result: 'done', isReplay: false });
  });

  it('refuses a project of another workspace, an empty goal and a goal over the cap', async () => {
    const kit = kitOf();
    expect((await run({ raw: startRaw({ projectId: 'proj-notify' }), kit })).refusal?.code).toBe(
      'unknown-target',
    );
    expect((await run({ raw: startRaw({ goal: '   ' }), kit })).refusal?.code).toBe(
      'invalid-request',
    );
    expect((await run({ raw: startRaw({ goal: 'x'.repeat(2001) }), kit })).refusal?.code).toBe(
      'invalid-request',
    );
    expect(kit.createSession).not.toHaveBeenCalled();
  });

  it('takes the goal from the task when none is typed and keeps the typed one otherwise', async () => {
    const kit = kitOf();
    const ports = portsOf();
    await run({
      raw: startRaw({ goal: '', task: { provider: 'linear', key: 'HBL-419' } }),
      kit,
      ports,
    });
    expect(kit.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'Fix the rounding bug', externalTasks: expect.any(Array) }),
    );
  });

  it('offers a plan only from the presets of the workspace and a limit only from its amounts', async () => {
    const kit = kitOf();
    const planned = await run({
      raw: startRaw({ startKind: 'leadPlan', presetId: 'preset-ghost' }),
      kit,
    });
    expect(planned.refusal?.code).toBe('invalid-request');
    const limited = await run({ raw: startRaw({ limitUsd: 7 }), kit });
    expect(limited.refusal?.code).toBe('invalid-request');
    const ok = await run({ raw: startRaw({ limitUsd: 10 }), kit });
    expect(ok.result).toBe('done');
  });

  it('gives a single agent no limit', async () => {
    const kit = kitOf();
    const refused = await run({
      raw: startRaw({ startKind: 'agentScout', limitUsd: 5 }),
      kit,
    });
    expect(refused.refusal?.code).toBe('invalid-request');
  });

  it('stops at the per-day cap', async () => {
    const kit = kitOf();
    const ports = portsOf();
    const codes: string[] = [];
    for (let count = 0; count <= MAX_STARTS_PER_DAY; count += 1) {
      clearRateSlots();
      const outcome = await run({
        raw: startRaw({ actionId: startActionIdOf({ workspaceId: WORKSPACE }) }),
        kit,
        ports,
        now: 1_000 + count,
      });
      codes.push(outcome.refusal?.code ?? outcome.result);
    }
    expect(codes.slice(0, MAX_STARTS_PER_DAY).every((code) => code === 'done')).toBe(true);
    expect(codes.at(-1)).toBe('rate-limited');
  });
});
