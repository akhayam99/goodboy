import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_FACTS_FETCH_MS } from '@goodboy/core';
import { brandId, type SessionId } from '@goodboy/types';
import { gatherBranchFacts } from './gatherBranchFacts';
import { CLEAN_FACTS, LEDGER_MOUNT, NOTIFY_MOUNT, makeFakePorts } from '../testing/fakePorts';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });

describe('gatherBranchFacts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads each named mount once with its own path and branch', async () => {
    const ports = makeFakePorts();
    const gathered = await gatherBranchFacts({
      ports,
      sessionId: SESSION,
      mounts: [LEDGER_MOUNT, NOTIFY_MOUNT],
      mountIds: [NOTIFY_MOUNT.id, LEDGER_MOUNT.id],
    });
    expect(gathered.kind).toBe('ok');
    expect(ports.factReads.map((read) => [read.mountId, read.worktreePath, read.branch])).toEqual([
      [NOTIFY_MOUNT.id, NOTIFY_MOUNT.worktreePath, NOTIFY_MOUNT.branch],
      [LEDGER_MOUNT.id, LEDGER_MOUNT.worktreePath, LEDGER_MOUNT.branch],
    ]);
    expect(gathered.kind === 'ok' ? gathered.facts.map((entry) => entry.mountLabel) : []).toEqual([
      'mount-notify-relay (notify-relay, branch ak/notify-queue)',
      'mount-ledger-core (ledger-core, branch ak/ledger-export)',
    ]);
  });

  it('names a mount that is not in the conversation and reads nothing', async () => {
    const ports = makeFakePorts();
    const gathered = await gatherBranchFacts({
      ports,
      sessionId: SESSION,
      mounts: [LEDGER_MOUNT],
      mountIds: [LEDGER_MOUNT.id, 'mount-unknown'],
    });
    expect(gathered).toEqual({ kind: 'unknown_mount', mountId: 'mount-unknown' });
    expect(ports.factReads).toHaveLength(0);
  });

  it('marks every part of a read that outlasts the limit and drops the late answer', async () => {
    const ports = makeFakePorts();
    ports.setBranchFacts(LEDGER_MOUNT.id, 'hang');
    const pending = gatherBranchFacts({
      ports,
      sessionId: SESSION,
      mounts: [LEDGER_MOUNT, NOTIFY_MOUNT],
      mountIds: [LEDGER_MOUNT.id, NOTIFY_MOUNT.id],
    });
    await vi.advanceTimersByTimeAsync(AUTO_FACTS_FETCH_MS);
    const gathered = await pending;
    expect(gathered.kind).toBe('ok');
    const [slow, fast] = gathered.kind === 'ok' ? gathered.facts : [];
    expect(slow?.commits).toEqual({
      kind: 'unavailable',
      reason: 'the host took longer than 30 s',
    });
    expect(slow?.checks.kind).toBe('unavailable');
    expect(fast?.commits).toEqual(CLEAN_FACTS.commits);
  });

  it('marks a read that throws and keeps the other mount', async () => {
    const ports = makeFakePorts();
    ports.setBranchFacts(LEDGER_MOUNT.id, new Error('gitlab answered 503'));
    const gathered = await gatherBranchFacts({
      ports,
      sessionId: SESSION,
      mounts: [LEDGER_MOUNT, NOTIFY_MOUNT],
      mountIds: [LEDGER_MOUNT.id, NOTIFY_MOUNT.id],
    });
    const [failed, fine] = gathered.kind === 'ok' ? gathered.facts : [];
    expect(failed?.request).toEqual({ kind: 'unavailable', reason: 'gitlab answered 503' });
    expect(fine?.request).toEqual(CLEAN_FACTS.request);
  });
});
