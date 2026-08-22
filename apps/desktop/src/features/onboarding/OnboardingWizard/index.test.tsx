// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';
import type { ProfileDraft } from './steps/ProfileStep';

const { hookState, progressState, finishWizard, storeActions } = vi.hoisted(() => ({
  hookState: {} as OnboardingWizardState,
  progressState: { completed: new Set<string>() },
  finishWizard: vi.fn(),
  storeActions: {
    createWorkspace: vi.fn(),
    renameWorkspace: vi.fn(),
    setCurrentWorkspace: vi.fn(),
    updateWorkspaceProfile: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: typeof storeActions) => unknown) => selector(storeActions),
}));

vi.mock('../hooks/useOnboardingProgress', () => ({
  useOnboardingProgress: () => progressState,
}));

vi.mock('./useOnboardingWizard', () => ({
  useOnboardingWizard: () => hookState,
}));

vi.mock('../onboarding-store', () => ({
  finishWizard,
}));

vi.mock('./Stepper', () => ({
  Stepper: ({
    current,
    steps,
    completed,
  }: {
    current: number;
    steps: ReadonlyArray<number>;
    completed: ReadonlySet<string>;
  }) => (
    <div data-testid="stepper">{`${current}/${steps.join(',')}/${[...completed].join(',')}`}</div>
  ),
}));

vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div data-testid="WelcomeStep" /> }));
vi.mock('./steps/ProvidersStep', () => ({
  ProvidersStep: () => <div data-testid="ProvidersStep" />,
}));
vi.mock('./steps/WorkspaceNameStep', () => ({
  WorkspaceNameStep: ({
    workspace,
    name,
    onNameChange,
  }: {
    workspace: Workspace | null;
    name: string;
    onNameChange: (name: string) => void;
  }) => (
    <div data-testid="WorkspaceNameStep">
      <span data-testid="existing-name">{workspace?.name}</span>
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
  ProfileStep: ({
    draft,
    onDraftChange,
  }: {
    draft: ProfileDraft;
    onDraftChange: (draft: ProfileDraft) => void;
  }) => (
    <div data-testid="ProfileStep">
      <button
        type="button"
        onClick={() => onDraftChange({ ...draft, role: 'developer', discipline: 'frontend' })}
      >
        pick developer
      </button>
    </div>
  ),
}));
vi.mock('./steps/PreferencesStep', () => ({
  PreferencesStep: () => <div data-testid="PreferencesStep" />,
}));
vi.mock('./steps/IntegrationsStep', () => ({
  IntegrationsStep: () => <div data-testid="IntegrationsStep" />,
}));
vi.mock('./steps/ReadyStep', () => ({ ReadyStep: () => <div data-testid="ReadyStep" /> }));

const baseState: OnboardingWizardState = {
  open: true,
  mode: 'full',
  providersConnected: 0,
  hasWorkspace: false,
  workspace: null,
  workspaceId: null,
  projectKind: null,
  projectCount: 0,
  githubConnected: false,
  gitlabConnected: false,
  bitbucketConnected: false,
  hasCodeHost: false,
  hasLinear: false,
  hasJira: false,
  hasSlack: false,
  hasSentry: false,
  refreshGithubStatus: vi.fn(),
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
  progressState.completed = new Set();
  Object.assign(hookState, baseState);
  storeActions.createWorkspace.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.renameWorkspace.mockReset().mockResolvedValue(WORKSPACE);
  storeActions.setCurrentWorkspace.mockReset().mockResolvedValue(undefined);
  storeActions.updateWorkspaceProfile.mockReset().mockResolvedValue(WORKSPACE);
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
  projectKind: 'repo',
  projectCount: 1,
};

const continueTo = async (testId: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  await waitFor(() => expect(screen.getByTestId(testId)).toBeDefined());
};

const reachProfileStep = async () => {
  advance(/get started/i, 1);
  await continueTo('WorkspaceNameStep');
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

    it('keeps Create workspace disabled until a name is typed', () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
      expect(screen.getByTestId('WorkspaceNameStep')).toBeDefined();
      const cta = screen.getByRole('button', { name: /create workspace/i }) as HTMLButtonElement;
      expect(cta.disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Serenis' } });
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
      fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: 'Serenis' } });
      fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

      await waitFor(() => expect(screen.getByTestId('ProjectsStep')).toBeDefined());
      expect(storeActions.createWorkspace).toHaveBeenCalledWith({ name: 'Serenis' });
      expect(storeActions.setCurrentWorkspace).toHaveBeenCalledWith(WORKSPACE.id);
    });

    it('prefills the existing workspace name and renames only on change', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 1);
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
    it('keeps Continue disabled until a role is chosen, then persists the profile', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      await reachProfileStep();
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: /pick developer/i }));
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => expect(screen.getByTestId('PreferencesStep')).toBeDefined());
      expect(storeActions.updateWorkspaceProfile).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        profile: {
          role: 'developer',
          discipline: 'frontend',
          topics: [],
          notes: null,
        },
      });
    });
  });

  describe('optional steps', () => {
    it('offers Skip for now on the integrations step when nothing is connected', async () => {
      setHook(connectedWorkspaceState);
      render(<OnboardingWizard />);
      await reachProfileStep();
      fireEvent.click(screen.getByRole('button', { name: /pick developer/i }));
      await continueTo('PreferencesStep');
      await continueTo('IntegrationsStep');
      expect(screen.getByRole('button', { name: /skip for now/i })).toBeDefined();
    });

    it('offers Continue on the integrations step once anything is connected', async () => {
      setHook({ ...connectedWorkspaceState, hasSlack: true });
      render(<OnboardingWizard />);
      await reachProfileStep();
      fireEvent.click(screen.getByRole('button', { name: /pick developer/i }));
      await continueTo('PreferencesStep');
      await continueTo('IntegrationsStep');
      expect(screen.getByRole('button', { name: /^continue$/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /skip for now/i })).toBeNull();
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

    it('passes the current step, filtered steps, and completed progress to the stepper', async () => {
      progressState.completed = new Set(['workspace']);
      setHook({ ...connectedWorkspaceState, mode: 'setup' });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /pick developer/i }));
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await waitFor(() =>
        expect(screen.getByTestId('stepper').textContent).toBe('5/4,5,6,7/workspace'),
      );
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
      setHook({ ...connectedWorkspaceState, hasSlack: true });
      render(<OnboardingWizard />);
      await reachProfileStep();
      fireEvent.click(screen.getByRole('button', { name: /pick developer/i }));
      await continueTo('PreferencesStep');
      await continueTo('IntegrationsStep');
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
