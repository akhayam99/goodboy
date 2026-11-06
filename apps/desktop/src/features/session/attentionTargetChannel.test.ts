// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { AttentionTarget } from './attentionTarget';
import { attentionTargetChannel } from './attentionTargetChannel';

const PENDING_KEY = 'goodboy:attention-target';
const HARBORLINE = brandId<WorkspaceId>({ value: 'ws-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-ledger-core' });
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

const TARGET = {
  workspaceId: HARBORLINE,
  sessionId: SESSION,
  reason: null,
  agentId: null,
  place: { reason: 'history-stopped', mountId: MOUNT, subject: 'note' },
} satisfies AttentionTarget;

beforeEach(() => {
  localStorage.clear();
});

describe('attentionTargetChannel', () => {
  it('carries the exact place to the window that takes the target', async () => {
    await attentionTargetChannel.send({ target: TARGET });

    expect(attentionTargetChannel.take({ workspaceId: HARBORLINE, now: Date.now() })).toEqual(
      TARGET,
    );
  });

  it('drops a target older than 30 seconds', async () => {
    await attentionTargetChannel.send({ target: TARGET });

    expect(
      attentionTargetChannel.take({ workspaceId: HARBORLINE, now: Date.now() + 31_000 }),
    ).toBeNull();
  });

  it('keeps the target and drops a stored place it cannot read', () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        target: { ...TARGET, place: { reason: 'not-a-reason', mountId: 'mount-ledger-core' } },
        at: Date.now(),
      }),
    );

    expect(attentionTargetChannel.take({ workspaceId: HARBORLINE, now: Date.now() })).toEqual({
      workspaceId: HARBORLINE,
      sessionId: SESSION,
      reason: null,
      agentId: null,
    });
  });
});
