// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  brandId,
  type AgentId,
  type MountId,
  type ProjectId,
  type SessionId,
} from '@goodboy/types';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { readPushFixMemory, writePushFixMemory } from './pushFixMemory';
import type { BranchPushFix, PushFixOutcome } from '../types';

const AGENT_ID = brandId<AgentId>({ value: 'agent-fixer' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-memory' });

const fix = (startedAt: number): BranchPushFix => ({
  agentId: AGENT_ID,
  sessionId: brandId<SessionId>({ value: 'session-memory' }),
  mountId: MOUNT_ID,
  identity: {
    worktreePath: '/w/ledger-core',
    branch: 'fix/ledger',
    projectId: brandId<ProjectId>({ value: 'p' }),
  },
  isForce: false,
  confirmedOnlyOnline: null,
  confirmedRemoteSha: null,
  startedAt,
});

const outcome = (settledAt: number): PushFixOutcome => ({
  agentId: AGENT_ID,
  sessionId: brandId<SessionId>({ value: 'session-memory' }),
  mountId: MOUNT_ID,
  kind: 'pushed',
  reason: null,
  settledAt,
  isClaimed: true,
  followUp: { tone: 'done', sentence: 'Pull request #318 is open.' },
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('push fix memory', () => {
  it('gives back what was written, the way a reloaded window reads it', () => {
    const now = Date.now();
    writePushFixMemory({
      fixes: { [AGENT_ID]: fix(now) },
      outcomes: { [MOUNT_ID]: outcome(now) },
    });

    expect(readPushFixMemory()).toEqual({
      fixes: { [AGENT_ID]: fix(now) },
      outcomes: { [MOUNT_ID]: outcome(now) },
    });
  });

  it('forgets entries older than a few hours', () => {
    const old = Date.now() - 7 * 60 * 60 * 1000;
    writePushFixMemory({ fixes: { [AGENT_ID]: fix(old) }, outcomes: { [MOUNT_ID]: outcome(old) } });

    expect(readPushFixMemory()).toEqual({ fixes: {}, outcomes: {} });
  });

  it('removes the saved value when nothing is left to remember', () => {
    writePushFixMemory({ fixes: { [AGENT_ID]: fix(Date.now()) }, outcomes: {} });
    writePushFixMemory({ fixes: {}, outcomes: {} });

    expect(localStorage.getItem(STORAGE_KEYS.pushFixes)).toBeNull();
  });

  it('starts empty on damaged or foreign data', () => {
    localStorage.setItem(STORAGE_KEYS.pushFixes, '{not json');
    expect(readPushFixMemory()).toEqual({ fixes: {}, outcomes: {} });

    localStorage.setItem(
      STORAGE_KEYS.pushFixes,
      JSON.stringify({ fixes: { a: { agentId: 1 } }, outcomes: { b: { kind: 'unknown' } } }),
    );
    expect(readPushFixMemory()).toEqual({ fixes: {}, outcomes: {} });
  });
});
