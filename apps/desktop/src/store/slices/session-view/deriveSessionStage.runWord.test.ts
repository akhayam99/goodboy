// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Session, type SessionId, type WorkspaceId } from '@goodboy/types';
import { deriveSessionStage } from './deriveSessionStage';

const DATE = '2026-08-04T00:00:00.000Z';

const session: Session = {
  id: brandId<SessionId>({ value: 'session-1' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
  goal: 'Refactor ledger-core',
  state: { kind: 'idle', lastActivityAt: brandId<Session['createdAt']>({ value: DATE }) },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: brandId<Session['createdAt']>({ value: DATE }),
  updatedAt: brandId<Session['updatedAt']>({ value: DATE }),
};

const base = { session, pr: null, hasUnread: false, openQuestionCount: 0, hasStoppedRun: true };

describe('the reason of a stopped run', () => {
  it('reads the word the run table gave for a halted step', () => {
    const info = deriveSessionStage({ ...base, stoppedRunWord: 'Not finished' });

    expect(info.attention).toBe('run-stopped');
    expect(info.reason).toBe('Not finished');
  });

  it('reads the table word of a failed stop when the run gave none', () => {
    const info = deriveSessionStage(base);

    expect(info.reason).toBe('Failed');
  });
});
