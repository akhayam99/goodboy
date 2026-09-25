import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MountId,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
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

const LEDGER = 'project-ledger' as ProjectId;

const LEDGER_MOUNT: SessionProjectMount = {
  mountId: 'mount-1' as MountId,
  sessionId: SESSION_ID,
  projectId: LEDGER,
  mountName: 'ledger-core',
  worktreePath: '/wt/ledger',
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch: 'nw/fix-rounding',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const renderScripts = (value: string) =>
  renderHook(() =>
    useChatPrefix({
      session,
      value,
      setValue: vi.fn(),
      showToast: vi.fn(),
      wrapperRef: { current: null },
    }),
  );

describe('useChatPrefix, script quick action', () => {
  const runDiscoveredScript = vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 }));

  beforeEach(() => {
    runDiscoveredScript.mockClear();
    useAppStore.setState({
      projects: [{ id: LEDGER, name: 'ledger-core' }] as unknown as ReadonlyArray<Project>,
      sessionProjectMounts: {},
      discoveredScripts: {},
      discoveredScriptScans: {},
      scriptRuns: {},
      loadDiscoveredScripts: vi.fn(async () => undefined),
      runDiscoveredScript,
    });
  });

  it('asks for a project when the session has none', () => {
    const { result } = renderScripts('$');

    expect(result.current.filteredQuickItems).toEqual([]);
    expect(result.current.quickEmptyHint).toBe('Add a project to this session to run its scripts.');
  });

  it('points to the Scripts page when a mounted project has no scripts', () => {
    useAppStore.setState({
      sessionProjectMounts: { [SESSION_ID]: [LEDGER_MOUNT] },
      discoveredScripts: { [SESSION_ID]: { '/wt/ledger': [] } },
    });
    const { result } = renderScripts('$');

    expect(result.current.quickEmptyHint).toBe('No scripts in ledger-core. Save one in Scripts.');
  });

  it('lists package.json scripts, runs the picked one in its folder, and names an empty filter', async () => {
    useAppStore.setState({
      sessionProjectMounts: { [SESSION_ID]: [LEDGER_MOUNT] },
      discoveredScripts: {
        [SESSION_ID]: {
          '/wt/ledger': [
            {
              source: 'package-json',
              packageName: 'ledger-core',
              relDir: 'apps/api',
              manager: 'pnpm',
              scripts: [{ name: 'test', command: 'pnpm run test' }],
            },
          ],
        },
      },
    });
    const { result } = renderScripts('$te');

    const [item] = result.current.filteredQuickItems;
    expect(item).toMatchObject({
      label: 'test',
      sublabel: 'pnpm run test',
      trailing: { label: 'package.json' },
    });
    act(() => {
      result.current.onQuickActionSelect(item!);
    });
    await waitFor(() =>
      expect(runDiscoveredScript).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: SESSION_ID,
          name: 'test',
          command: 'pnpm run test',
          cwd: '/wt/ledger/apps/api',
        }),
      ),
    );

    const { result: missed } = renderScripts('$zz');
    expect(missed.current.filteredQuickItems).toEqual([]);
    expect(missed.current.quickEmptyHint).toBe('No scripts match "zz".');
  });
});
