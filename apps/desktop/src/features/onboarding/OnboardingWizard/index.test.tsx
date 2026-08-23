// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';

const { hookState, finishWizard, storeActions, repoLib } = vi.hoisted(() => ({
  hookState: {} as OnboardingWizardState,
  finishWizard: vi.fn(),
  storeActions: {
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    setCurrentWorkspace: vi.fn(),
    updateWorkspaceProfile: vi.fn(),
    addProject: vi.fn(),
    adoptWorkspaceSessionsRoot: vi.fn(),
  },
  repoLib: {
    initRepo: vi.fn(),
    validateGitRepo: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: typeof storeActions) => unknown) => selector(storeActions),
}));

vi.mock('../../../shared/lib/repo', () => repoLib);

vi.mock('./useOnboardingWizard', () => ({
  useOnboardingWizard: () => hookState,
}));

vi.mock('../onboarding-store', () => ({
  finishWizard,
}));

vi.mock('./Stepper', () => ({
  Stepper: ({ current, steps }: { current: number; steps: ReadonlyArray<number> }) => (
    <div data-testid="stepper">{`${current}/${steps.join(',')}`}</div>
  ),
}));

vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div data-testid="WelcomeStep" /> }));
vi.mock('./steps/ProvidersStep', () => ({
  ProvidersStep: () => <div data-testid="ProvidersStep" />,
}));
vi.mock('./steps/ShapeStep', () => ({
  ShapeStep: ({
    workspace,
    shape,
    onShapeChange,
    name,
    onNameChange,
    onSingleProject,
  }: {
    workspace: Workspace | null;
    shape: 'workspace' | 'single' | null;
    onShapeChange: (shape: 'workspace' | 'single') => void;
    name: string;
    onNameChange: (name: string) => void;
    onSingleProject: (pick: { path: string; initialize: boolean }) => void;
  }) => (
    <div data-testid="ShapeStep">
      <span data-testid="existing-name">{workspace?.name}</span>
      <span data-testid="shape">{shape ?? 'none'}</span>
      <button type="button" onClick={() => onShapeChange('workspace')}>
        pick workspace shape
      </button>
      <button type="button" onClick={() => onShapeChange('single')}>
        pick single shape
      </button>
      <button
        type="button"
        onClick={() => onSingleProject({ path: '/tmp/solo', initialize: false })}
      >
        pick single folder
      </button>
      <button
        type="button"
        onClick={() => onSingleProject({ path: '/tmp/fresh', initialize: true })}
      >
        create single folder
      </button>
      <input
        aria-label="Workspace name"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
      />
    </div>
  ),
}));
vi.mock('./steps/ProjectsStep', () => ({
  ProjectsStep: () => <div data-testid="ProjectsStep" />,
}));
vi.mock('./steps/ProfileStep', () => ({
  ProfileStep: ({ bio, onBioChange }: { bio: string; onBioChange: (bio: string) => void }) => (
    <div data-testid="ProfileStep">
      <input
        aria-label="Profile bio"
        value={bio}
        onChange={(event) => onBioChange(event.target.value)}
      />
    </div>
  ),
}));
vi.mock('./steps/ReadyStep', () => ({ ReadyStep: () => <div data-testid="ReadyStep" /> }));

const baseState: OnboardingWizardState = {
  open: true,
  mode: 'full',
  providersConnected: 0,
  hasWorkspace: false,
  workspace: null,
  workspaceId: null,
  projectCount: 0,
};

const WORKSPACE = {
  id: 'workspace-1' as WorkspaceId,
  name: 'Goodboy desktop',
  slug: 'goodboy-desktop',
  sessionsRoot: '/Users/dev/goodboy',
  overrides: {
    defaultProviderId: null,
    defaultWorkflowId: null,
    defaultBranchPrefix: null,
    parallelEnabled: null,
    defaultVerbosity: null,
    providerBindings: null,
    taskModels: null,
    roleModels: null,
    parallelAgents: null,
    providerPool: null,
  },
  createdAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-08-02T08:00:00.000Z' as IsoDateTime,
} satisfies Workspace;

const setHook = (partial: Partial<OnboardingWizardState>) =>
  Object.assign(hookState, baseState, partial);

beforeEach(() => {
  finishWizard.mockClear();
  Object.assign(hookState, baseState);
  storeActions.createWorkspace.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.renameWorkspace.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.setCurrentWorkspace.mockReset().mockResolvedValue(undefined);
  storeActions.updateWorkspaceProfile.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.addProject.mockReset().mockResolvedValue({ rootPath: '/tmp/solo' });
  storeActions.adoptWorkspaceSessionsRoot.mockReset().mockResolvedValue(undefined);
  repoLib.initRepo
    .mockReset()
    .mockResolvedValue({ rootPath: '/tmp/fresh', remoteUrl: '', branch: 'main' });
  repoLib.validateGitRepo.mockReset().mockResolvedValue({
    isRepo: true,
    rootPath: '/tmp/solo',
    resolvedPath: '/tmp/solo',
    error: null,
  });
});
afterEach(cleanup);

import { OnboardingWizard } from './index';

const advance = (label: RegExp, times: number) => {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
};

const connectedWorkspaceState: Partial<OnboardingWizardState> = {
  providersConnected: 1,
  hasWorkspace: true,
  workspace: WORKSPACE,
  workspaceId: WORKSPACE.id,
  projectCount: 1,
};

const continueTo = async (testId: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(screen.getByTestId(testId)).toBeDefined());
};

const reachProfileStep = async () => {
  advance(/get started/i, 1);
  await continueTo('ShapeStep');
  await continueTo('ProjectsStep');
  await continueTo('ProfileStep');
};

describe('OnboardingWizard', () => {
  it('renders nothing when closed', () => {
    setHook({ open: false });
    const { container } = render(<OnboardingWizard />);
    expect(container.firstChild).toBeNull();
  });

  it('opens on the welcome step with no stepper, back, or skip', () => {
    setHook({ hasWorkspace: false });
    render(<OnboardingWizard />);
    expect(screen.getByTestId('WelcomeStep')).toBeDefined();
    expect(screen.getByRole('button', { name: /get started/i })).toBeDefined();
    expect(screen.queryByTestId('stepper')).toBeNull();
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /skip setup/i })).toBeNull();
  });

  describe('mandatory gates', () => {
    it('keeps Continue disabled on the providers step until one is connected', () => {
      setHook({ providersConnected: 0, hasWorkspace: true });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      expect(screen.getByTestId('ProvidersStep')).toBeDefined();
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('keeps Create workspace disabled until a shape is chosen and a name is typed', () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      expect(screen.getByTestId('ShapeStep')).toBeDefined();
      const cta = screen.getByRole('button', { name: /create workspace/i }) as HTMLButtonElement;
      expect(cta.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Demo Team' } });
      expect(cta.disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: /pick workspace shape/i }));
      expect(cta.disabled).toBe(false);
    });

    it('creates the workspace from the typed name and advances to projects', async () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      storeActions.createWorkspace.mockImplementation(async () => {
        setHook({ ...connectedWorkspaceState, projectCount: 0 });
        return WORKSPACE;
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      fireEvent.click(screen.getByRole('button', { name: /pick workspace shape/i }));
      fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Demo Team' } });
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

      await waitFor(() => expect(screen.getByTestId('ProjectsStep')).toBeDefined());
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'Demo Team' });
      expect(storeActions.setCurrentWorkspace).toHaveBeenCalledWith(WORKSPACE.id);
    });

    it('creates the container implicitly from a picked git folder and skips the projects step', async () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      storeActions.createWorkspace.mockImplementation(async ({ name }: { name: string }) => {
        setHook(connectedWorkspaceState);
        return { ...WORKSPACE, name };
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      fireEvent.click(screen.getByRole('button', { name: /pick single shape/i }));
      fireEvent.click(screen.getByRole('button', { name: /pick single folder/i }));

      await waitFor(() => expect(screen.getByTestId('ProfileStep')).toBeDefined());
      expect(screen.queryByTestId('ProjectsStep')).toBeNull();
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'solo' });
      expect(storeActions.addProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPath: '/tmp/solo',
        requireRepo: true,
      });
      expect(storeActions.adoptWorkspaceSessionsRoot).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPath: '/tmp/solo',
      });
    });

    it('refuses a picked folder without a git repository and stays on the shape step', async () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      repoLib.validateGitRepo.mockResolvedValue({
        isRepo: false,
        rootPath: null,
        resolvedPath: '/tmp/solo',
        error: 'not a git repository',
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      fireEvent.click(screen.getByRole('button', { name: /pick single shape/i }));
      fireEvent.click(screen.getByRole('button', { name: /pick single folder/i }));

      await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
      expect(screen.getByRole('alert').textContent).toMatch(/no git repository/i);
      expect(storeActions.createWorkspace).not.toHaveBeenCalled();
      expect(screen.getByTestId('ShapeStep')).toBeDefined();
    });

    it('initializes a fresh repository for New project and links it', async () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      storeActions.createWorkspace.mockImplementation(async ({ name }: { name: string }) => {
        setHook(connectedWorkspaceState);
        return { ...WORKSPACE, name };
      });
      storeActions.addProject.mockResolvedValue({ rootPath: '/tmp/fresh' });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      fireEvent.click(screen.getByRole('button', { name: /pick single shape/i }));
      fireEvent.click(screen.getByRole('button', { name: /create single folder/i }));

      await waitFor(() => expect(screen.getByTestId('ProfileStep')).toBeDefined());
      expect(repoLib.initRepo).toHaveBeenCalledWith({ path: '/tmp/fresh' });
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'fresh' });
      expect(storeActions.addProject).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        rootPath: '/tmp/fresh',
        requireRepo: true,
      });
    });

    it('prefills the existing workspace name and renames only on change', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      expect(screen.getByTestId('shape').textContent).toBe('workspace');
      const input = screen.getByLabelText('Workspace name') as HTMLInputElement;
      expect(input.value).toBe('Goodboy desktop');
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

      await waitFor(() => expect(screen.getByTestId('ProjectsStep')).toBeDefined());
      expect(storeActions.createWorkspace).not.toHaveBeenCalled();
      expect(storeActions.renameWorkspace).not.toHaveBeenCalled();
    });

    it('keeps Continue disabled on the projects step until one project is linked', async () => {
      setHook({ ...connectedWorkspaceState, projectCount: 0 });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 2);
      await waitFor(() => expect(screen.getByTestId('ProjectsStep')).toBeDefined());
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  describe('profile step', () => {
    it('continues past an empty bio without spending a profile write', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      await reachProfileStep();
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => expect(screen.getByTestId('ReadyStep')).toBeDefined());
      expect(storeActions.updateWorkspaceProfile).not.toHaveBeenCalled();
    });

    it('persists the typed bio as the whole profile', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      await reachProfileStep();

      fireEvent.change(screen.getByLabelText('Profile bio'), {
        target: { value: '  I lead design for the checkout team.  ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => expect(screen.getByTestId('ReadyStep')).toBeDefined());
      expect(storeActions.updateWorkspaceProfile).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        profile: { bio: 'I lead design for the checkout team.' },
      });
    });
  });

  describe('setup mode', () => {
    it('starts at the profile step with no back button', () => {
      setHook({ ...connectedWorkspaceState, mode: 'setup' });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('ProfileStep')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
      expect(screen.queryByTestId('stepper')).toBeNull();
    });

    it('passes the current step and filtered steps to the stepper', async () => {
      setHook({ ...connectedWorkspaceState, mode: 'setup' });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() => expect(screen.getByTestId('stepper').textContent).toBe('5/4,5'));
    });
  });

  describe('exit', () => {
    it('shows Skip setup once a workspace exists and finishes the wizard', async () => {
      setHook({ hasWorkspace: true });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /skip setup/i }));
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce());
    });

    it('finishes the wizard on Escape wherever Skip setup is offered', async () => {
      setHook({ hasWorkspace: true });
      render(<OnboardingWizard />);
      expect(screen.getByRole('button', { name: /skip setup/i })).toBeDefined();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce());
    });

    it('ignores Escape before a workspace exists, so no dead end behind the wizard', async () => {
      setHook({ hasWorkspace: false });
      render(<OnboardingWizard />);
      expect(screen.queryByRole('button', { name: /skip setup/i })).toBeNull();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(finishWizard).not.toHaveBeenCalled();
    });

    it('finishes the wizard from the ready step', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      await reachProfileStep();
      await continueTo('ReadyStep');
      expect(screen.queryByRole('button', { name: /skip setup/i })).toBeNull();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(finishWizard).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: /start building/i }));
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce());
    });
  });
});
