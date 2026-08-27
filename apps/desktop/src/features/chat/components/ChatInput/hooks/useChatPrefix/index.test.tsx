import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { useChatPrefix } from './index';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const SESSION_ID = 'session-1' as SessionId;

const workflow: Workflow = {
  id: WF_ID,
  workspaceId: WS_ID,
  name: 'ship it',
  description: '',
  steps: [
    {
      id: 'step-0' as StepId,
      workflowId: WF_ID,
      ordinal: 0,
      name: 'Step',
      role: 'engineer',
      effort: 'medium',
      verbosity: 'normal',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Workflow;

const session: Session = {
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  workflowRuns: [],
  autoRun: false,
} as unknown as Session;

const mockAttach = vi.fn(async () => undefined);

const initialState = useAppStore.getState();

function renderChatPrefix() {
  return renderHook(() =>
    useChatPrefix({
      session,
      value: '~',
      setValue: vi.fn(),
      showToast: vi.fn(),
      wrapperRef: { current: null },
    }),
  );
}

beforeEach(() => {
  mockAttach.mockClear();
  useAppStore.setState({
    ...initialState,
    skills: {},
    projectScripts: {},
    phaseTemplates: { [WS_ID]: [workflow] },
    sessionPhaseRuns: {},
    agentKindOverride: {},
    attachWorkflowToSession: mockAttach,
  });
});

afterEach(() => {
  useAppStore.setState(initialState, true);
});

describe('useChatPrefix, workflow quick action', () => {
  it('attaches the workflow with navigate: true so the picked workflow is shown', async () => {
    const { result } = renderChatPrefix();

    const item = result.current.filteredQuickItems.find((it) => it.id === `workflow:${WF_ID}`);
    expect(item).toBeDefined();

    act(() => {
      result.current.onQuickActionSelect(item!);
    });

    await waitFor(() =>
      expect(mockAttach).toHaveBeenCalledWith(SESSION_ID, WF_ID, { navigate: true }),
    );
  });
});
