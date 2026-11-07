import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { brandId, type Agent, type TurnProviderOverride, type WorkflowRunId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { aPlannerQuestion } from '../../../../../../test/planDrawerFixtures';
import { useBlockedStepAnswer } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const session = aSession();
const blockedAgent: Agent = anAgent({
  sessionId: session.id,
  status: 'blocked',
  workflowRunId: brandId<WorkflowRunId>({ value: 'run-1' }),
});

let useAppStore: StoryStore;

type PendingAnswer = {
  readonly answer: Mock<() => Promise<void>>;
  readonly settle: (outcome: 'resolve' | 'reject') => void;
};

const pendingAnswer = (): PendingAnswer => {
  const settlers: Array<(outcome: 'resolve' | 'reject') => void> = [];
  const answer = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        settlers.push((outcome) =>
          outcome === 'resolve' ? resolve() : reject(new Error('Down.')),
        );
      }),
  );
  return { answer, settle: (outcome) => settlers.forEach((settle) => settle(outcome)) };
};

type HookParams = {
  readonly hasAttachments?: boolean;
  readonly isBlocked?: boolean;
  readonly override?: TurnProviderOverride;
};

const setup = ({ hasAttachments = false, isBlocked = false, override }: HookParams = {}) => {
  const onSend = vi.fn(async () => undefined);
  const view = renderHook(() =>
    useBlockedStepAnswer({
      sessionId: session.id,
      agentId: blockedAgent.id,
      hasDraft: true,
      hasAttachments,
      isBlocked,
      override,
      basePlaceholder: 'Message',
      onSend,
    }),
  );
  return { view, onSend };
};

const draftOf = (): string => useAppStore.getState().agentDraft[blockedAgent.id] ?? '';

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [blockedAgent] },
    agentDraft: { [blockedAgent.id]: 'Attach it to the notes only.' },
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBlockedStepAnswer', () => {
  it('clears the field before the turn ends and sends the answer once for two presses', async () => {
    const pending = pendingAnswer();
    useAppStore.setState({ answerBlockedStep: pending.answer });
    const { view } = setup();

    await act(async () => {
      void view.result.current.step?.send();
      void view.result.current.step?.send();
    });

    expect(pending.answer).toHaveBeenCalledTimes(1);
    expect(pending.answer).toHaveBeenCalledWith({
      sessionId: session.id,
      agentId: blockedAgent.id,
      text: 'Attach it to the notes only.',
    });
    expect(draftOf()).toBe('');
    await act(async () => {
      pending.settle('resolve');
    });
  });

  it('keeps what the user types while the turn runs', async () => {
    const pending = pendingAnswer();
    useAppStore.setState({ answerBlockedStep: pending.answer });
    const { view } = setup();
    await act(async () => {
      void view.result.current.step?.send();
    });

    act(() => {
      useAppStore.getState().setAgentDraft(blockedAgent.id, 'Next thing');
    });
    await act(async () => {
      pending.settle('resolve');
    });

    expect(draftOf()).toBe('Next thing');
  });

  it('gives the answer back to the field when the send fails', async () => {
    const pending = pendingAnswer();
    useAppStore.setState({ answerBlockedStep: pending.answer });
    const { view } = setup();
    await act(async () => {
      void view.result.current.step?.send();
    });

    await act(async () => {
      pending.settle('reject');
    });

    expect(draftOf()).toBe('Attach it to the notes only.');
    expect(view.result.current.step?.error).toBe('Down.');
  });

  it('keeps newer text on a failed send instead of the old answer', async () => {
    const pending = pendingAnswer();
    useAppStore.setState({ answerBlockedStep: pending.answer });
    const { view } = setup();
    await act(async () => {
      void view.result.current.step?.send();
    });
    act(() => {
      useAppStore.getState().setAgentDraft(blockedAgent.id, 'A better answer');
    });

    await act(async () => {
      pending.settle('reject');
    });

    expect(draftOf()).toBe('A better answer');
  });

  it('sends nothing and says why while attachments are in the field', async () => {
    const answerBlockedStep = vi.fn(async () => undefined);
    useAppStore.setState({ answerBlockedStep });
    const { view, onSend } = setup({ hasAttachments: true });

    await act(async () => {
      view.result.current.sendDraft();
    });

    expect(answerBlockedStep).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(view.result.current.step?.error).toBe('Remove the attachments to answer the step');
    expect(draftOf()).toBe('Attach it to the notes only.');
    expect(view.result.current.placeholder).toBe('Message');
  });

  it('sends nothing while the composer is blocked', async () => {
    const answerBlockedStep = vi.fn(async () => undefined);
    const askAgentToContinue = vi.fn(async () => undefined);
    useAppStore.setState({ answerBlockedStep, askAgentToContinue });
    const { view, onSend } = setup({ isBlocked: true });

    await act(async () => {
      await view.result.current.step?.send();
      view.result.current.sendDraft();
    });

    expect(answerBlockedStep).not.toHaveBeenCalled();
    expect(askAgentToContinue).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(view.result.current.step?.isComposerBlocked).toBe(true);
  });

  it('falls back to normal dispatch while the store holds a live turn of the step', async () => {
    const answerBlockedStep = vi.fn(async () => undefined);
    useAppStore.setState({
      answerBlockedStep,
      agentTurnState: {
        [blockedAgent.id]: {
          kind: 'starting',
          startedAt: JSON.parse('"2026-10-16T15:00:00.000Z"'),
        },
      },
    });
    const { view, onSend } = setup();

    await act(async () => {
      view.result.current.sendDraft();
    });

    expect(view.result.current.step).toBeNull();
    expect(answerBlockedStep).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('falls back to normal dispatch while a question is open', async () => {
    const answerBlockedStep = vi.fn(async () => undefined);
    useAppStore.setState({
      answerBlockedStep,
      loadSessionOpenQuestions: async () => undefined,
      sessionOpenQuestions: {
        [session.id]: [
          aPlannerQuestion({ sessionId: session.id, createdByAgentId: blockedAgent.id }),
        ],
      },
    });
    const { view, onSend } = setup();

    await act(async () => {
      view.result.current.sendDraft();
    });

    expect(view.result.current.step).toBeNull();
    expect(answerBlockedStep).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('forwards the composer route to the answer and to Continue', async () => {
    const override: TurnProviderOverride = { providerId: 'codex', model: 'gpt-6' };
    const answerBlockedStep = vi.fn(async () => undefined);
    const askAgentToContinue = vi.fn(async () => undefined);
    useAppStore.setState({ answerBlockedStep, askAgentToContinue });
    const { view } = setup({ override });

    await act(async () => {
      await view.result.current.step?.send();
    });
    act(() => {
      useAppStore.getState().setAgentDraft(blockedAgent.id, '');
    });
    await act(async () => {
      await view.result.current.step?.send();
    });

    expect(answerBlockedStep).toHaveBeenCalledWith(expect.objectContaining({ override }));
    expect(askAgentToContinue).toHaveBeenCalledWith(expect.objectContaining({ override }));
  });

  it('restores the answer and tells why when the step starts no turn', async () => {
    const answerBlockedStep = vi.fn(async () => {
      throw new Error('The step did not start a turn. Your answer is back in the box.');
    });
    useAppStore.setState({ answerBlockedStep });
    const { view } = setup();

    await act(async () => {
      await view.result.current.step?.send();
    });

    expect(draftOf()).toBe('Attach it to the notes only.');
    expect(view.result.current.step?.error).toContain('back in the box');
  });
});
