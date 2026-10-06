// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';

const h = vi.hoisted(() => ({ openLens: vi.fn() }));

vi.mock('../../openLens', () => ({ openLens: h.openLens }));

import { startAgentAction, startWorkflowAction, stopStepActions } from './trailMenuActions';

const SESSION_ID = 'session-1' as SessionId;
const stepAgent = (status: Agent['status']) => anAgent({ name: 'review step', status });

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('stopStepActions', () => {
  it('offers Stop this step on a running agent, with the confirm copy', () => {
    const onStop = vi.fn();
    const [stop] = stopStepActions({ agent: stepAgent('running'), isTurnLive: false, onStop });
    expect(stop?.id).toBe('stop');
    expect(stop?.label).toBe('Stop this step');
    expect(stop?.confirm).toEqual({
      title: 'Stop review step?',
      description: 'The edits it made so far stay in the branch. Later steps wait for you.',
      confirmLabel: 'Stop step',
    });
    stop?.onRun();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('offers it on any agent whose turn is live', () => {
    expect(
      stopStepActions({ agent: stepAgent('completed'), isTurnLive: true, onStop: vi.fn() }),
    ).toHaveLength(1);
  });

  it('offers nothing on an idle agent', () => {
    expect(
      stopStepActions({ agent: stepAgent('completed'), isTurnLive: false, onStop: vi.fn() }),
    ).toEqual([]);
  });
});

describe('startWorkflowAction', () => {
  it('fires the builder event for the session', () => {
    const listener = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', listener);
    const action = startWorkflowAction({ sessionId: SESSION_ID });
    action.onRun();
    window.removeEventListener('goodboy:open-workflow-builder', listener);
    expect(action.label).toBe('Start a run');
    expect((listener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ sessionId: SESSION_ID });
  });
});

describe('startAgentAction', () => {
  it('opens the agents lens then asks the create popover to open on the next frame', () => {
    const frames = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    const listener = vi.fn();
    const eventName = 'goodboy:open-create-agent:session-1';
    window.addEventListener(eventName, listener);
    const action = startAgentAction({ sessionId: SESSION_ID });
    action.onRun();
    expect(h.openLens).toHaveBeenCalledWith({ sessionId: SESSION_ID, lens: 'agents' });
    expect(listener).not.toHaveBeenCalled();
    (frames.mock.calls[0]?.[0] as FrameRequestCallback)(0);
    window.removeEventListener(eventName, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(action.label).toBe('Start agent');
  });
});
