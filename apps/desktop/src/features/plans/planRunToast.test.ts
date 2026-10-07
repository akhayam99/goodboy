import { describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { isUserStart } from '../../shared/lib/userStarts';
import { planRunToast } from './planRunToast';

const SESSION_ID = 'session-ledger-core' as SessionId;

const toastFor = (result: Parameters<typeof planRunToast>[0]['result']) => {
  const navigate = vi.fn();
  return { navigate, toast: planRunToast({ result, sessionId: SESSION_ID, navigate }) };
};

describe('planRunToast', () => {
  it('offers Follow as an info toast when an agent runs the plan', () => {
    const agentId = 'agent-plan-started' as AgentId;

    const { toast } = toastFor({ kind: 'started', agentId, scope: 'session' });

    expect(toast).toMatchObject({
      kind: 'info',
      title: 'Implementer started',
      dedupeKey: `follow:${agentId}`,
      action: { label: 'Follow' },
    });
  });

  it('marks the started agent as a user start so the bridge stays quiet', () => {
    const agentId = 'agent-plan-marked' as AgentId;
    expect(isUserStart({ key: agentId })).toBe(false);

    toastFor({ kind: 'started', agentId, scope: 'workflow' });

    expect(isUserStart({ key: agentId })).toBe(true);
  });

  it('follows to the agent page as a push', () => {
    const agentId = 'agent-plan-follow' as AgentId;
    const { navigate, toast } = toastFor({ kind: 'started', agentId, scope: 'session' });

    toast?.action?.onClick();

    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId },
    });
  });

  it('keeps the warning and offers Follow when the plan started outside its run', () => {
    const agentId = 'agent-plan-outside' as AgentId;

    const { toast } = toastFor({
      kind: 'startedOutside',
      agentId,
      note: 'Started outside the run, it was discarded',
    });

    expect(toast).toMatchObject({
      kind: 'warning',
      title: 'Implementer started',
      message: 'Started outside the run, it was discarded',
      dedupeKey: `follow:${agentId}`,
      action: { label: 'Follow' },
    });
    expect(isUserStart({ key: agentId })).toBe(true);
  });

  it('leaves a refusal as it was: the reason, the way to the run, no start mark', () => {
    const { toast } = toastFor({
      kind: 'refused',
      reason: 'The next step (Review) does not run plans',
      workflowRunId: 'run-plan-refused' as WorkflowRunId,
    });

    expect(toast).toMatchObject({
      kind: 'warning',
      title: 'Plan not started',
      action: { label: 'Open the run' },
    });
    expect(toast).not.toHaveProperty('dedupeKey');
    expect(isUserStart({ key: 'run-plan-refused' })).toBe(false);
  });

  it('says nothing when a gate already told the owner why', () => {
    expect(toastFor({ kind: 'refused', reason: null, workflowRunId: null }).toast).toBeNull();
  });
});
