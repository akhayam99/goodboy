import { describe, expect, it, vi } from 'vitest';
import type { AgentId, Session, SessionId } from '@goodboy/types';
import { WORKSPACE_FEATURES } from '../../../shared/lib/features';
import type { AppStore } from '../../store';
import { resolveSkillPrompt } from './resolveSkillPrompt';

describe('resolveSkillPrompt', () => {
  it('passes a /-prefixed message through as plain text while skills are off', async () => {
    expect(WORKSPACE_FEATURES.skills).toBe(false);
    const appendTurnEvent = vi.fn();
    const get = () => ({ appendTurnEvent }) as unknown as AppStore;
    const before = {} as AppStore;
    const session = { workspaceId: 'workspace-1' } as unknown as Session;

    const result = await resolveSkillPrompt(get, {
      before,
      session,
      sessionId: 'session-1' as SessionId,
      activeAgentId: 'agent-1' as AgentId,
      workingDir: '/repo',
      content: '/review this',
      now: () => '2026-06-08T10:00:00.000Z' as never,
    });

    expect(result).toEqual({ ok: true, resolvedPrompt: '/review this' });
    expect(appendTurnEvent).not.toHaveBeenCalled();
  });
});
