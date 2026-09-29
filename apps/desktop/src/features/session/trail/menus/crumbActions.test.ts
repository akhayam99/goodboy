// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@goodboy/types';
import { newArtifactAction, retryStepActions, savedCopyActions } from './crumbActions';

const agentWith = (status: Agent['status']): Agent =>
  JSON.parse(JSON.stringify({ id: 'agent-1', name: 'Implement the fix', status }));

describe('retryStepActions', () => {
  it('offers a retry on a failed or blocked step', () => {
    const onRetry = vi.fn();

    const failed = retryStepActions({ agent: agentWith('failed'), isTurnLive: false, onRetry });
    const blocked = retryStepActions({ agent: agentWith('blocked'), isTurnLive: false, onRetry });
    failed[0]?.onRun();

    expect(failed.map((action) => action.label)).toEqual(['Retry step']);
    expect(blocked.map((action) => action.label)).toEqual(['Retry step']);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers nothing on a step that still runs or finished', () => {
    const onRetry = vi.fn();

    expect(retryStepActions({ agent: agentWith('running'), isTurnLive: false, onRetry })).toEqual(
      [],
    );
    expect(retryStepActions({ agent: agentWith('completed'), isTurnLive: false, onRetry })).toEqual(
      [],
    );
    expect(retryStepActions({ agent: agentWith('failed'), isTurnLive: true, onRetry })).toEqual([]);
  });
});

describe('newArtifactAction', () => {
  it('runs the handler it was given', () => {
    const onRun = vi.fn();

    const action = newArtifactAction({ onRun });
    action.onRun();

    expect(action.label).toBe('New artifact');
    expect(onRun).toHaveBeenCalled();
  });
});

describe('savedCopyActions', () => {
  it('offers the saved copy only when the workspace has a folder for it', () => {
    const onReveal = vi.fn();
    const onCopyPath = vi.fn();

    const actions = savedCopyActions({ hasWorkspace: true, onReveal, onCopyPath });
    actions.forEach((action) => action.onRun());

    expect(actions.map((action) => action.label)).toEqual(['Show saved copy', 'Copy folder path']);
    expect(onReveal).toHaveBeenCalled();
    expect(onCopyPath).toHaveBeenCalled();
    expect(savedCopyActions({ hasWorkspace: false, onReveal, onCopyPath })).toEqual([]);
  });
});
