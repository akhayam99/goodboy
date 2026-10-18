// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';
import type { FolderPick } from './steps/ProjectStep';

const { hookState, setupStore, storeActions, repoLib, tools, firstSession } = vi.hoisted(() => ({
  hookState: {} as OnboardingWizardState,
  setupStore: {
    finishWizard: vi.fn(async () => undefined),
    pauseWizard: vi.fn(async () => undefined),
    enterWizardStep: vi.fn<(params: { readonly step: string }) => Promise<void>>(
      async () => undefined,
    ),
    markStepComplete: vi.fn(),
  },
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
vi.mock('../onboarding-store', () => setupStore);
vi.mock('./Stepper', () => ({
  Stepper: ({ current }: { current: string }) => <div data-testid="stepper">{current}</div>,
}));
vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div data-testid="WelcomeStep" /> }));
vi.mock('./steps/ProvidersStep', async () => {
  const { useState } = await import('react');
  const { useEscapeLayer } = await import('@goodboy/ui');
  const InnerPanel = ({ onClose }: { onClose: () => void }) => {
    useEscapeLayer(onClose);
    return <div data-testid="inner-panel" />;
  };
  return {
    ProvidersStep: () => {
      const [isPanelOpen, setIsPanelOpen] = useState(false);
      return (
        <div data-testid="ProvidersStep">
          <button type="button" onClick={() => setIsPanelOpen(true)}>
            open panel
          </button>
          {isPanelOpen ? <InnerPanel onClose={() => setIsPanelOpen(false)} /> : null}
        </div>
      );
    },
  };
});
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
  defaultBranchTemplate: null,
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

const closeWizard = vi.fn();

const baseState: OnboardingWizardState = {
  isOpen: true,
  close: closeWizard,
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
  Object.values(setupStore).forEach((spy) => spy.mockClear());
  closeWizard.mockClear();
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

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const pressEscape = () => fireEvent.keyDown(window, { key: 'Escape' });
const stepOf = () => screen.getByRole('dialog').getAttribute('data-step');

describe('OnboardingWizard', () => {
  it('renders nothing when closed', () => {
    setHook({ isOpen: false });
    const { container } = render(<OnboardingWizard />);
    expect(container.firstChild).toBeNull();
  });

  it('opens on Welcome with the stepper, no lockup, and Set up later', () => {
    const { container } = render(<OnboardingWizard />);
    expect(screen.getByTestId('WelcomeStep')).toBeDefined();
    expect(screen.getByTestId('stepper').textContent).toBe('welcome');
    expect(container.querySelector('[data-brand-tile]')).toBeNull();
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /^set up later$/i })).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Goodboy setup' })).toBeDefined();
  });

  it('draws the lockup in the header on every step after Welcome', () => {
    const { container } = render(<OnboardingWizard />);
    click(/get started/i);
    const header = container.querySelector('header');
    expect(header?.querySelector('[data-brand-tile]')).not.toBeNull();
    expect(header?.textContent).toContain('Goodboy');
  });

  it('lets a returning user set setup aside before a workspace exists', () => {
    vi.useFakeTimers();
    render(<OnboardingWizard />);
    click(/set up later/i);
    vi.advanceTimersByTime(250);
    expect(setupStore.pauseWizard).toHaveBeenCalledOnce();
    expect(setupStore.finishWizard).not.toHaveBeenCalled();
    expect(hookState.close).toHaveBeenCalledOnce();
  });

  it('pauses at the current step on Set up later', () => {
    vi.useFakeTimers();
    render(<OnboardingWizard />);
    click(/get started/i);
    expect(setupStore.enterWizardStep).toHaveBeenLastCalledWith({ step: 'agents' });
    click(/set up later/i);
    vi.advanceTimersByTime(250);
    expect(setupStore.pauseWizard).toHaveBeenCalledOnce();
  });

  it('keeps setup open on Escape at Welcome', () => {
    vi.useFakeTimers();
    render(<OnboardingWizard />);
    pressEscape();
    vi.advanceTimersByTime(250);
    expect(screen.getByTestId('WelcomeStep')).toBeDefined();
    expect(setupStore.finishWizard).not.toHaveBeenCalled();
    expect(setupStore.pauseWizard).not.toHaveBeenCalled();
    expect(hookState.close).not.toHaveBeenCalled();
  });

  it('goes back one step on Escape and never ends setup', () => {
    vi.useFakeTimers();
    setHook({ providersConnected: 1 });
    render(<OnboardingWizard />);
    click(/get started/i);
    click(/^continue$/i);
    expect(stepOf()).toBe('workspace');
    pressEscape();
    expect(stepOf()).toBe('agents');
    pressEscape();
    expect(stepOf()).toBe('welcome');
    pressEscape();
    vi.advanceTimersByTime(250);
    expect(stepOf()).toBe('welcome');
    expect(setupStore.finishWizard).not.toHaveBeenCalled();
    expect(hookState.close).not.toHaveBeenCalled();
  });

  it('closes the innermost open thing on Escape before going back', () => {
    render(<OnboardingWizard />);
    click(/get started/i);
    click(/open panel/i);
    expect(screen.getByTestId('inner-panel')).toBeDefined();
    pressEscape();
    expect(screen.queryByTestId('inner-panel')).toBeNull();
    expect(stepOf()).toBe('agents');
    pressEscape();
    expect(stepOf()).toBe('welcome');
  });

  it('writes each step on entering it, never Welcome', () => {
    setHook({ providersConnected: 1 });
    render(<OnboardingWizard />);
    expect(setupStore.enterWizardStep).not.toHaveBeenCalled();
    click(/get started/i);
    click(/^continue$/i);
    expect(setupStore.enterWizardStep.mock.calls.map(([params]) => params)).toEqual([
      { step: 'agents' },
      { step: 'workspace' },
    ]);
  });

  it('keeps every step in one 600 px column', async () => {
    setHook(readyState({ kind: 'repo' }));
    render(<OnboardingWizard />);
    const classes = [screen.getByTestId('wizard-column').className];
    click(/get started/i);
    classes.push(screen.getByTestId('wizard-column').className);
    click(/^continue$/i);
    classes.push(screen.getByTestId('wizard-column').className);
    click(/^continue$/i);
    await waitFor(() => expect(stepOf()).toBe('tools'));
    classes.push(screen.getByTestId('wizard-column').className);
    click(/skip for now/i);
    expect(stepOf()).toBe('first-session');
    classes.push(screen.getByTestId('wizard-column').className);
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('max-w-[600px]');
  });

  it('keeps Continue disabled on the agents step until one is connected', () => {
    render(<OnboardingWizard />);
    click(/get started/i);
    const next = screen.getByRole('button', { name: /^continue$/i }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(screen.getByText(/connect one provider to continue/i)).toBeDefined();
  });

  describe('resume', () => {
    it('reopens at the saved step with the steps before it behind Back', () => {
      setHook({ ...readyState({ kind: 'repo' }), mode: 'setup', start: 'tools' });
      render(<OnboardingWizard />);
      expect(stepOf()).toBe('tools');
      expect(screen.getByTestId('stepper').textContent).toBe('tools');
      expect(setupStore.enterWizardStep).toHaveBeenCalledWith({ step: 'tools' });
      click(/^back$/i);
      expect(stepOf()).toBe('workspace');
    });

    it('stays on the first resumed step on Escape', () => {
      setHook({ ...readyState({ kind: 'repo' }), mode: 'setup', start: 'agents' });
      render(<OnboardingWizard />);
      pressEscape();
      expect(stepOf()).toBe('agents');
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    });

    it('marks Tools done once the user moves past it', () => {
      setHook({ ...readyState({ kind: 'repo' }), mode: 'setup', start: 'tools' });
      render(<OnboardingWizard />);
      click(/skip for now/i);
      expect(setupStore.markStepComplete).toHaveBeenCalledWith('tools');
      expect(stepOf()).toBe('first-session');
    });
  });

  describe('workspace step', () => {
    const reachWorkspace = () => {
      setHook({ providersConnected: 1 });
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      expect(screen.getByTestId('ProjectStep')).toBeDefined();
    };

    it('names the workspace after the picked folder, never its parent', async () => {
      reachWorkspace();
      click(/pick folder/i);
      await waitFor(() => expect(storeActions.addProject).toHaveBeenCalled());
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'Ledger core' });
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
      reachWorkspace();
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
      reachWorkspace();
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

    it('keeps the step and shows the cause when a pick fails, then retries', async () => {
      repoLib.validateGitRepo.mockRejectedValueOnce(new Error('Permission denied'));
      reachWorkspace();
      click(/pick folder/i);
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Permission'));
      expect(storeActions.createWorkspace).not.toHaveBeenCalled();
      click(/pick folder/i);
      await waitFor(() => expect(storeActions.addProject).toHaveBeenCalledOnce());
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('renames the workspace on Continue only when the name changed, then goes to Tools', async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      fireEvent.change(screen.getByRole('textbox', { name: 'Workspace name' }), {
        target: { value: 'Northwind Labs' },
      });
      click(/^continue$/i);
      await waitFor(() => expect(screen.getByTestId('CodeHostStep')).toBeDefined());
      expect(stepOf()).toBe('tools');
      expect(storeActions.renameWorkspace).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        name: 'Northwind Labs',
      });
    });
  });

  describe('tools', () => {
    const reachTools = async ({ kind }: { readonly kind: Project['kind'] }) => {
      setHook(readyState({ kind }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/^continue$/i);
      await waitFor(() => expect(stepOf()).toBe('tools'));
    };

    it('holds the code host and the task sources on one step', async () => {
      await reachTools({ kind: 'repo' });
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
      expect(screen.getByTestId('TasksStep')).toBeDefined();
      expect(screen.queryByRole('button', { name: /tasks back to code host/i })).toBeNull();
    });

    it('keeps the Tools step for a plain folder, with only the task sources', async () => {
      await reachTools({ kind: 'folder' });
      expect(screen.queryByTestId('CodeHostStep')).toBeNull();
      expect(screen.getByTestId('TasksStep')).toBeDefined();
    });

    it('lets Tools be skipped, then lands on the first session', async () => {
      await reachTools({ kind: 'repo' });
      expect(
        (screen.getByRole('button', { name: /^continue$/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
      click(/skip for now/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
      expect(screen.getByTestId('issue-source').textContent).toBe('no');
    });

    it('continues without Skip once a code host is connected', async () => {
      tools.connected.github = true;
      await reachTools({ kind: 'repo' });
      expect(screen.queryByRole('button', { name: /skip for now/i })).toBeNull();
      click(/^continue$/i);
      expect(stepOf()).toBe('first-session');
    });
  });

  describe('first session', () => {
    const reachFirstSession = async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/^continue$/i);
      await waitFor(() => expect(stepOf()).toBe('tools'));
      click(/skip for now/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
    };

    it('starts Scout with the prompt in a real session, then finishes setup', async () => {
      await reachFirstSession();
      click(/start scout/i);
      await waitFor(() => expect(setupStore.finishWizard).toHaveBeenCalledOnce(), {
        timeout: 1000,
      });
      expect(firstSession.startFirstScout).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        projectId: 'project-1',
        prompt: 'Explain how ledger-core is organized',
      });
      expect(hookState.close).toHaveBeenCalledOnce();
    });

    it('hands a workflow start to the new session after the wizard closes', async () => {
      await reachFirstSession();
      click(/hand off workflow/i);
      await waitFor(() => expect(firstSession.handOffFirstSession).toHaveBeenCalled(), {
        timeout: 1000,
      });
      expect(setupStore.finishWizard).toHaveBeenCalledOnce();
      expect(firstSession.handOffFirstSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        projectId: 'project-1',
        choice: 'workflow',
      });
    });

    it('takes the empty task source back to Tools', async () => {
      await reachFirstSession();
      click(/^back to code host$/i);
      expect(stepOf()).toBe('tools');
    });

    it('keeps Back right-aligned beside the step action', async () => {
      await reachFirstSession();
      const back = screen.getByRole('button', { name: /^back$/i });
      const skip = screen.getByRole('button', { name: /skip, open the board/i });
      expect(back.parentElement).toBe(skip.parentElement);
    });

    it('offers Skip, open the board instead of a primary in the action row', async () => {
      await reachFirstSession();
      expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull();
      click(/skip, open the board/i);
      await waitFor(() => expect(setupStore.finishWizard).toHaveBeenCalledOnce(), {
        timeout: 1000,
      });
    });
  });

  describe('single step', () => {
    it('ends each step with Back and the primary inline, never in a footer bar', async () => {
      tools.connected.linear = true;
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tools' });
      const { container } = render(<OnboardingWizard />);
      const done = screen.getByRole('button', { name: /^done$/i });
      expect(done.closest('[data-slot="form-actions"]')).not.toBeNull();
      expect(container.querySelector('footer')).toBeNull();
    });

    it('opens one step with no stepper, closes with Done and writes no setup state', async () => {
      tools.connected.linear = true;
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tools' });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('TasksStep')).toBeDefined();
      expect(screen.queryByTestId('stepper')).toBeNull();
      expect(setupStore.enterWizardStep).not.toHaveBeenCalled();
      click(/^done$/i);
      await waitFor(() => expect(hookState.close).toHaveBeenCalledOnce(), { timeout: 1000 });
      expect(setupStore.finishWizard).not.toHaveBeenCalled();
      expect(setupStore.markStepComplete).not.toHaveBeenCalled();
    });

    it('closes a single step on Escape', () => {
      vi.useFakeTimers();
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tools' });
      render(<OnboardingWizard />);
      pressEscape();
      vi.advanceTimersByTime(250);
      expect(hookState.close).toHaveBeenCalledOnce();
      expect(setupStore.pauseWizard).not.toHaveBeenCalled();
    });
  });
});
