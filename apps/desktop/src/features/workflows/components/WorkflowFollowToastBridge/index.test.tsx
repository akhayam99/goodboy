// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import { markUserStart } from '../../../../shared/lib/userStarts';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { captureLocation } from '../../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../../store/slices/navigation/locationKey';
import { WorkflowFollowToastBridge } from './';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    markAgentViewed: async () => undefined,
  }),
);

const SESSION_ID = 'sess-harborline' as SessionId;
const OTHER_SESSION_ID = 'sess-northwind' as SessionId;

let useAppStore: StoryStore;
let startCount = 0;
let RUN_ID: WorkflowRunId;
let AGENT_ID: AgentId;
let REVIEW_ID: AgentId;

type StepParams = {
  readonly agentId?: AgentId;
};

const fireStepStarted = ({ agentId = AGENT_ID }: StepParams = {}) => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('goodboy:workflow-step-started', {
        detail: { sessionId: SESSION_ID, agentId, stepName: 'Implement' },
      }),
    );
  });
};

const renderBridge = () =>
  render(
    <ToastProvider>
      <WorkflowFollowToastBridge />
    </ToastProvider>,
  );

const currentKey = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  startCount += 1;
  RUN_ID = `run-ledger-core-${startCount}` as WorkflowRunId;
  AGENT_ID = `agent-implement-${startCount}` as AgentId;
  REVIEW_ID = `agent-review-${startCount}` as AgentId;
  useAppStore.setState({
    currentSessionId: OTHER_SESSION_ID,
    sessionPhaseRuns: {
      [SESSION_ID]: [
        anAgent({ id: AGENT_ID, sessionId: SESSION_ID, workflowRunId: RUN_ID }),
        anAgent({ id: REVIEW_ID, sessionId: SESSION_ID, workflowRunId: RUN_ID }),
      ],
    },
  });
});

afterEach(() => {
  cleanup();
});

describe('WorkflowFollowToastBridge', () => {
  it('offers one Follow toast for a step the orchestrator started', () => {
    renderBridge();

    fireStepStarted();

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByText('Implement started')).toBeDefined();
    expect(screen.getByText('The run moved on to the next step.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('lands on the started agent when Follow is pressed', () => {
    renderBridge();
    fireStepStarted();

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(currentKey()).toBe(`s/${SESSION_ID}/agents/agent/${AGENT_ID}`);
  });

  it('raises nothing for a step whose run the user just started', () => {
    markUserStart({ key: RUN_ID });
    renderBridge();

    fireStepStarted();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('raises nothing for a step whose agent the user just started', () => {
    const agentId = `agent-user-started-${startCount}` as AgentId;
    markUserStart({ key: agentId });
    renderBridge();

    fireStepStarted({ agentId });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('folds quick successive advances of one run into one toast', () => {
    renderBridge();

    fireStepStarted();
    fireStepStarted({ agentId: REVIEW_ID });

    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('toasts when generation finishes outside the studio', () => {
    const open = vi.fn();
    window.addEventListener('goodboy:open-workflow-studio', open);
    useAppStore.setState({
      workflowGenerations: {
        'workspace-1': {
          status: 'complete',
          workspaceId: 'workspace-1' as WorkspaceId,
          workflowId: 'workflow-1',
          notificationId: 'notice-1',
          undoSnapshot: null,
        },
      } as never,
    });

    renderBridge();
    expect(screen.getByText('Your workflow is ready.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(open).toHaveBeenCalledOnce();
    window.removeEventListener('goodboy:open-workflow-studio', open);
  });

  it('stays quiet while the operator already watches the workflows lens', () => {
    useAppStore.setState({ activeLens: { [SESSION_ID]: 'workflows' } });
    renderBridge();

    fireStepStarted();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stays quiet when that agent is already selected', () => {
    useAppStore.setState({
      activeLens: { [SESSION_ID]: 'agents' },
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
    });
    renderBridge();

    fireStepStarted();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stops listening once unmounted', () => {
    const view = renderBridge();
    view.unmount();

    fireStepStarted();

    expect(screen.queryByRole('status')).toBeNull();
  });
});
