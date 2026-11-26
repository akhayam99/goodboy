// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import { pickChildMount } from './pickChildMount';
import { LEDGER_MOUNT, makeFakePorts } from './testing/fakePorts';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

const REMOVED_LEDGER = {
  ...LEDGER_MOUNT,
  isAttached: false,
  diskState: 'removed',
  worktreePath: null,
};

type PickParams = {
  readonly canRestore: boolean;
  readonly ports: ReturnType<typeof makeFakePorts>;
};

const pick = ({ canRestore, ports }: PickParams) =>
  pickChildMount({
    canRestore,
    ports,
    addProject: 'ask',
    sessionId: SESSION,
    role: 'planner',
    requested: LEDGER_MOUNT.id,
    mounts: [REMOVED_LEDGER],
    primaryMountId: LEDGER_MOUNT.id,
    task: 'Plan the settlement replay',
  });

describe('continuing an agent whose folder was removed', () => {
  it('brings the folder back and picks it', async () => {
    const ports = makeFakePorts();
    ports.setMounts([REMOVED_LEDGER]);

    const picked = await pick({ canRestore: true, ports });

    expect(ports.attachMountCalls).toEqual([{ sessionId: SESSION, mountId: LEDGER_MOUNT.id }]);
    expect(picked.kind).toBe('picked');
  });

  it('names the folder and the cause when it cannot come back', async () => {
    const ports = makeFakePorts();
    ports.setMounts([REMOVED_LEDGER]);
    ports.setAttachMountOutcome({ kind: 'failed', error: 'branch no longer exists' });

    const picked = await pick({ canRestore: true, ports });

    expect(picked).toEqual({
      kind: 'restore_failed',
      mount: REMOVED_LEDGER,
      error: 'branch no longer exists',
    });
  });

  it('never recreates a folder for new work the Lead starts', async () => {
    const ports = makeFakePorts();
    ports.setMounts([REMOVED_LEDGER]);

    const picked = await pick({ canRestore: false, ports });

    expect(ports.attachMountCalls).toEqual([]);
    expect(picked.kind).toBe('refused');
  });
});
