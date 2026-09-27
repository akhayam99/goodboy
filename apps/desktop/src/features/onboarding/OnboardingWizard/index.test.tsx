// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';
import type { FolderPick } from './steps/ProjectStep';

const { hookState, finishWizard, storeActions, repoLib, tools, firstSession } = vi.hoisted(() => ({
  hookState: {} as OnboardingWizardState,
  finishWizard: vi.fn(),
  storeActions: {
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    setCurrentWorkspace: vi.fn(),
    addProject: vi.fn(),
    addProjects: vi.fn(),
    removeProject: vi.fn(),
    adoptProject: vi.fn(),
    previewProjectAdoption: vi.fn(),
  },
  repoLib: {
    validateGitRepo: vi.fn(),
    scanChildRepos: vi.fn(),
  },
  tools: {
    connected: {
      github: false,
      gitlab: false,
      bitbucket: false,
      linear: false,
      jira: false,
      sentry: false,
      slack: false,
    },
  },
  firstSession: {
    startFirstScout: vi.fn(),
    handOffFirstSession: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: typeof storeActions) => unknown) => selector(storeActions),
}));
vi.mock('../../../shared/lib/repo', () => repoLib);
vi.mock('../../../shared/hooks/useProjectAdoption', () => ({
  useProjectAdoption: () => ({ knownRepos: {}, knownConflicts: {} }),
}));
vi.mock('../../integrations/useToolConnections', () => ({
  useToolConnections: () => ({ connected: tools.connected, githubIdentity: null }),
}));
vi.mock('./useOnboardingWizard', () => ({
  useOnboardingWizard: () => hookState,
}));
vi.mock('./useProjectRemote', () => ({ useProjectRemote: () => null }));
vi.mock('./startFirstSession', () => firstSession);
vi.mock('./useStepTransition', () => ({
  useStepTransition: ({ step }: { step: string }) => ({
    current: step,
    outgoing: null,
    direction: 'forward',
    generation: 0,
    isTransitioning: false,
    removeOutgoing: () => undefined,
  }),
}));
vi.mock('../onboarding-store', () => ({ finishWizard }));
vi.mock('./Stepper', () => ({
  Stepper: ({ current, steps }: { current: string; steps: ReadonlyArray<string> }) => (
    <div data-testid="stepper">{`${current}/${steps.join(',')}`}</div>
  ),
}));
vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div data-testid="WelcomeStep" /> }));
vi.mock('./steps/ProvidersStep', () => ({
  ProvidersStep: () => <div data-testid="ProvidersStep" />,
}));
vi.mock('./steps/ProjectStep', () => ({
  ProjectStep: ({
    name,
    onNameChange,
    onPickFolder,
    detection,
    onConfirmDetection,
  }: {
    name: string;
    onNameChange: (name: string) => void;
    onPickFolder: (pick: FolderPick) => void;
    detection: { parentPath: string; repos: ReadonlyArray<{ path: string }> } | null;
    onConfirmDetection: (params: { paths: ReadonlyArray<string> }) => void;
  }) => (
    <div data-testid="ProjectStep">
      <button
        type="button"
        onClick={() =>
          onPickFolder({ path: '/Users/me/code/northwind/ledger-core', replaces: null })
        }
      >
        pick folder
      </button>
      <input
        aria-label="Workspace name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
      />
      <span data-testid="detection-count">
        {detection === null ? 'none' : String(detection.repos.length)}
      </span>
      <button
        type="button"
        onClick={() =>
          onConfirmDetection({ paths: (detection?.repos ?? []).map((repo) => repo.path) })
        }
      >
        confirm detected
      </button>
    </div>
  ),
}));
vi.mock('./steps/CodeHostStep', () => ({
  CodeHostStep: () => <div data-testid="CodeHostStep" />,
}));
vi.mock('./steps/TasksStep', () => ({
  TasksStep: ({ onBackToCodeHost }: { onBackToCodeHost: (() => void) | null }) => (
    <div data-testid="TasksStep">
      {onBackToCodeHost !== null && (
        <button type="button" onClick={onBackToCodeHost}>
          tasks back to code host
        </button>
      )}
    </div>
  ),
}));
vi.mock('./steps/FirstSessionStep', () => ({
  FirstSessionStep: ({
    hasIssueSource,
    onStartScout,
    onHandOff,
    onBackToCodeHost,
  }: {
    hasIssueSource: boolean;
    onStartScout: (prompt: string) => void;
    onHandOff: (choice: 'task' | 'workflow') => void;
    onBackToCodeHost: (() => void) | null;
  }) => (
    <div data-testid="FirstSessionStep">
      <span data-testid="issue-source">{hasIssueSource ? 'yes' : 'no'}</span>
      <button type="button" onClick={() => onStartScout('Explain how ledger-core is organized')}>
        start scout
      </button>
      <button type="button" onClick={() => onHandOff('workflow')}>
        hand off workflow
      </button>
      {onBackToCodeHost !== null && (
        <button type="button" onClick={onBackToCodeHost}>
          back to code host
        </button>
      )}
    </div>
  ),
}));

const OVERRIDES = {
  defaultProviderId: null,
  defaultBranchPrefix: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
  attributionFooter: null,
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
  afterMerge: null,
} as const;

const STAMP = '2026-09-20T08:00:00.000Z' as IsoDateTime;

const WORKSPACE = {
  id: 'workspace-1' as WorkspaceId,
  name: 'Northwind',
  slug: 'northwind',
  overrides: OVERRIDES,
  createdAt: STAMP,
  updatedAt: STAMP,
} satisfies Workspace;

const project = ({ kind }: { readonly kind: Project['kind'] }): Project => ({
  id: 'project-1' as ProjectId,
  workspaceId: WORKSPACE.id,
  name: 'ledger-core',
  rootPath: '/Users/me/code/northwind/ledger-core',
  kind,
  overrides: OVERRIDES,
  createdAt: STAMP,
  updatedAt: STAMP,
});

const baseState: OnboardingWizardState = {
  open: true,
  mode: 'full',
  start: null,
  providersConnected: 0,
  hasWorkspace: false,
  workspace: null,
  workspaceId: null,
  projectCount: 0,
  projects: [],
};

const readyState = ({
  kind,
}: {
  readonly kind: Project['kind'];
}): Partial<OnboardingWizardState> => ({
  providersConnected: 1,
  hasWorkspace: true,
  workspace: WORKSPACE,
  workspaceId: WORKSPACE.id,
  projectCount: 1,
  projects: [project({ kind })],
});

const setHook = (partial: Partial<OnboardingWizardState>) =>
  Object.assign(hookState, baseState, partial);

beforeEach(() => {
  finishWizard.mockClear();
  firstSession.startFirstScout.mockReset().mockResolvedValue(undefined);
  firstSession.handOffFirstSession.mockReset();
  Object.assign(hookState, baseState);
  Object.assign(tools.connected, {
    github: false,
    gitlab: false,
    bitbucket: false,
    linear: false,
    jira: false,
  });
  storeActions.createWorkspace
    .mockReset()
    .mockImplementation(async ({ name }: { name: string }) => ({ ...WORKSPACE, name }));
  storeActions.renameWorkspace.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.setCurrentWorkspace.mockReset().mockResolvedValue(undefined);
  storeActions.addProject
    .mockReset()
    .mockResolvedValue({ kind: 'linked', project: project({ kind: 'repo' }) });
  storeActions.addProjects
    .mockReset()
    .mockImplementation(async ({ rootPaths }: { rootPaths: ReadonlyArray<string> }) => ({
      linked: rootPaths.map((rootPath) => ({ rootPath })),
      conflicts: [],
    }));
  storeActions.removeProject.mockReset().mockResolvedValue(undefined);
  storeActions.adoptProject.mockReset().mockResolvedValue(undefined);
  storeActions.previewProjectAdoption.mockReset().mockResolvedValue(null);
  repoLib.scanChildRepos.mockReset().mockResolvedValue([]);
  repoLib.validateGitRepo.mockReset().mockResolvedValue({
    isRepo: true,
    rootPath: '/Users/me/code/northwind/ledger-core',
    resolvedPath: '/Users/me/code/northwind/ledger-core',
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

import { OnboardingWizard } from './index';
import { workspaceNameFor } from './folderNames';

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('OnboardingWizard', () => {
  it('renders nothing when closed', () => {
    setHook({ open: false });
    const { container } = render(<OnboardingWizard />);
    expect(container.firstChild).toBeNull();
  });

  it('opens on Welcome with the stepper already there and a way out', () => {
    render(<OnboardingWizard />);
    expect(screen.getByTestId('WelcomeStep')).toBeDefined();
    expect(screen.getByTestId('stepper').textContent).toBe(
      'welcome/welcome,providers,project,code-host,tasks,first-session',
    );
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^skip setup$/i })).toBeDefined();
  });

  it('lets a returning user skip setup before a workspace exists', async () => {
    vi.useFakeTimers();
    render(<OnboardingWizard />);
    click(/i've used goodboy before/i);
    vi.advanceTimersByTime(250);
    expect(finishWizard).toHaveBeenCalledOnce();
  });

  it('closes on Escape even before a workspace exists', () => {
    vi.useFakeTimers();
    render(<OnboardingWizard />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    vi.advanceTimersByTime(250);
    expect(finishWizard).toHaveBeenCalledOnce();
  });

  it('keeps Continue disabled on the provider step until one is connected', () => {
    render(<OnboardingWizard />);
    click(/get started/i);
    const next = screen.getByRole('button', { name: /^continue$/i }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByText(/connect one provider to continue/i)).toBeDefined();
  });

  describe('project step', () => {
    const reachProject = () => {
      setHook({ providersConnected: 1 });
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      expect(screen.getByTestId('ProjectStep')).toBeDefined();
    };

    it('creates the workspace from the parent folder and links the picked repository', async () => {
      reachProject();
      click(/pick folder/i);
      await waitFor(() => expect(storeActions.addProject).toHaveBeenCalled());
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'Northwind' });
      expect(storeActions.addProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPath: '/Users/me/code/northwind/ledger-core',
        requireRepo: false,
      });
      expect(screen.getByTestId('ProjectStep')).toBeDefined();
    });

    it('links a folder without git as a plain folder project', async () => {
      repoLib.validateGitRepo.mockResolvedValue({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/Users/me/notes/research-notes',
        error: null,
      });
      reachProject();
      click(/pick folder/i);
      await waitFor(() => expect(storeActions.addProject).toHaveBeenCalled());
      expect(storeActions.addProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPath: '/Users/me/notes/research-notes',
        requireRepo: false,
      });
    });

    it('offers the git folders found inside and links the ones picked', async () => {
      repoLib.validateGitRepo.mockResolvedValue({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/Users/me/code/northwind',
        error: null,
      });
      repoLib.scanChildRepos.mockResolvedValue([
        { name: 'ledger-core', path: '/Users/me/code/northwind/ledger-core' },
        { name: 'payments-api', path: '/Users/me/code/northwind/payments-api' },
      ]);
      reachProject();
      click(/pick folder/i);
      await waitFor(() => expect(screen.getByTestId('detection-count').textContent).toBe('2'));
      expect(storeActions.addProject).not.toHaveBeenCalled();

      click(/confirm detected/i);
      await waitFor(() => expect(storeActions.addProjects).toHaveBeenCalled());
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'Northwind' });
      expect(storeActions.addProjects).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPaths: [
          '/Users/me/code/northwind/ledger-core',
          '/Users/me/code/northwind/payments-api',
        ],
      });
    });

    it('renames the workspace on Continue only when the name changed, then goes to Code host', async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      fireEvent.change(screen.getByRole('textbox', { name: 'Workspace name' }), {
        target: { value: 'Northwind Labs' },
      });
      click(/^continue$/i);
      await waitFor(() => expect(screen.getByTestId('CodeHostStep')).toBeDefined());
      expect(storeActions.renameWorkspace).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        name: 'Northwind Labs',
      });
    });
  });

  describe('code host and tasks', () => {
    const reachCodeHost = async ({ kind }: { readonly kind: Project['kind'] }) => {
      setHook(readyState({ kind }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/^continue$/i);
      await waitFor(() => expect(screen.queryByTestId('ProjectStep')).toBeNull());
    };

    it('skips Code host by itself when the project is not a git folder', async () => {
      await reachCodeHost({ kind: 'folder' });
      expect(screen.getByTestId('TasksStep')).toBeDefined();
      expect(screen.getByTestId('stepper').textContent).not.toContain('code-host');
      expect(screen.queryByRole('button', { name: /tasks back to code host/i })).toBeNull();
    });

    it('lets Code host and Tasks be skipped, then lands on the first session', async () => {
      await reachCodeHost({ kind: 'repo' });
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
      expect(
        (screen.getByRole('button', { name: /^continue$/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
      click(/skip for now/i);
      expect(screen.getByTestId('TasksStep')).toBeDefined();
      click(/skip for now/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
      expect(screen.getByTestId('issue-source').textContent).toBe('no');
    });

    it('continues without Skip once a code host is connected', async () => {
      tools.connected.github = true;
      await reachCodeHost({ kind: 'repo' });
      expect(screen.queryByRole('button', { name: /skip for now/i })).toBeNull();
      click(/^continue$/i);
      expect(screen.getByTestId('TasksStep')).toBeDefined();
    });

    it('goes back to Code host from the tasks step', async () => {
      await reachCodeHost({ kind: 'repo' });
      click(/skip for now/i);
      click(/tasks back to code host/i);
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
    });
  });

  describe('first session', () => {
    const reachFirstSession = async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/^continue$/i);
      await waitFor(() => expect(screen.getByTestId('CodeHostStep')).toBeDefined());
      click(/skip for now/i);
      click(/skip for now/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
    };

    it('starts Scout with the prompt in a real session, then closes the wizard', async () => {
      await reachFirstSession();
      click(/start scout/i);
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce(), { timeout: 1000 });
      expect(firstSession.startFirstScout).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        projectId: 'project-1',
        prompt: 'Explain how ledger-core is organized',
      });
    });

    it('hands a workflow start to the new session after the wizard closes', async () => {
      await reachFirstSession();
      click(/hand off workflow/i);
      await waitFor(() => expect(firstSession.handOffFirstSession).toHaveBeenCalled(), {
        timeout: 1000,
      });
      expect(finishWizard).toHaveBeenCalledOnce();
      expect(firstSession.handOffFirstSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        projectId: 'project-1',
        choice: 'workflow',
      });
    });

    it('takes the empty task source back to Code host', async () => {
      await reachFirstSession();
      click(/^back to code host$/i);
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
    });

    it('offers Skip, open the board instead of a footer primary', async () => {
      await reachFirstSession();
      expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull();
      click(/skip, open the board/i);
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce(), { timeout: 1000 });
    });
  });

  describe('single step', () => {
    it('opens one step with no stepper and closes with Done', async () => {
      tools.connected.linear = true;
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tasks' });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('TasksStep')).toBeDefined();
      expect(screen.queryByTestId('stepper')).toBeNull();
      click(/^done$/i);
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce(), { timeout: 1000 });
    });
  });
});

describe('workspaceNameFor', () => {
  it('names the workspace after the parent folder', () => {
    expect(workspaceNameFor({ rootPath: '/Users/me/code/northwind/ledger-core' })).toBe(
      'Northwind',
    );
  });
});
