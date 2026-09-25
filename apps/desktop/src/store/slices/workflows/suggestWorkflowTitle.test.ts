import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId } from '@goodboy/types';

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));

import { suggestWorkflowTitle } from './suggestWorkflowTitle';

const SESSION_ID = 'session-1' as SessionId;

const session = {
  id: SESSION_ID,
  workspaceId: 'workspace-1',
  goal: 'ship the thing',
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
} as unknown as Session;

const buildSuggest = () => {
  const state = {
    sessions: [session],
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    workspaceOverrides: {},
    phaseTemplates: {},
  };
  const get = (() => state) as unknown as Parameters<typeof suggestWorkflowTitle>[1];
  const set = vi.fn() as unknown as Parameters<typeof suggestWorkflowTitle>[0];
  return suggestWorkflowTitle(set, get);
};

describe('suggestWorkflowTitle', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the generated title and writes nothing to the workflow', async () => {
    invokeMock.mockResolvedValue({
      stdout: JSON.stringify({ result: 'Move checkout to server actions' }),
      stderr: '',
      exitCode: 0,
    });

    const title = await buildSuggest()(SESSION_ID, 'move the checkout flow to server actions');

    expect(title).toBe('Move checkout to server actions');
    expect(invokeMock).toHaveBeenCalledOnce();
  });

  it('skips the model for an empty goal', async () => {
    expect(await buildSuggest()(SESSION_ID, '   ')).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns null instead of throwing when generation fails', async () => {
    invokeMock.mockRejectedValue(new Error('provider unavailable'));

    expect(await buildSuggest()(SESSION_ID, 'ship it')).toBeNull();
  });
});
