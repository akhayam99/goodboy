// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';

const { hookState, progressState, finishWizard } = vi.hoisted(() => ({
  hookState: {} as OnboardingWizardState,
  progressState: { completed: new Set<string>() },
  finishWizard: vi.fn(),
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
vi.mock('./steps/WorkspaceStep', () => ({
  WorkspaceStep: ({ workspace }: { workspace: Workspace | null }) => (
    <div data-testid="WorkspaceStep">{workspace?.name}</div>
  ),
}));
vi.mock('./steps/PreferencesStep', () => ({
  PreferencesStep: () => <div data-testid="PreferencesStep" />,
}));
vi.mock('./steps/CodeHostStep', () => ({ CodeHostStep: () => <div data-testid="CodeHostStep" /> }));
vi.mock('./steps/TrackerStep', () => ({ TrackerStep: () => <div data-testid="TrackerStep" /> }));
vi.mock('./steps/SentryStep', () => ({ SentryStep: () => <div data-testid="SentryStep" /> }));
vi.mock('./steps/ReadyStep', () => ({ ReadyStep: () => <div data-testid="ReadyStep" /> }));

const baseState: OnboardingWizardState = {
  open: true,
  mode: 'full',
  providersConnected: 0,
  hasWorkspace: false,
  workspace: null,
  workspaceId: null,
  projectKind: null,
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
});
afterEach(cleanup);

import { OnboardingWizard } from './index';

const advance = (label: RegExp, times: number) => {
  for (let i = 0; i < times; i += 1) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
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

    it('enables Continue on the providers step once one is connected', () => {
      setHook({ providersConnected: 1, hasWorkspace: true });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it('keeps Continue disabled on the workspace step until a workspace exists', () => {
      setHook({ providersConnected: 1, hasWorkspace: false });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(screen.getByTestId('WorkspaceStep')).toBeDefined();
      expect(
        (screen.getByRole('button', { name: /continue/i }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('passes the resolved workspace to the workspace step', () => {
      setHook({ providersConnected: 1, hasWorkspace: true, workspace: WORKSPACE });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /get started/i }));
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(screen.getByTestId('WorkspaceStep').textContent).toBe('Goodboy desktop');
    });
  });

  describe('optional steps', () => {
    it('offers Skip for now on the code host step when none is connected', () => {
      setHook({ providersConnected: 1, hasWorkspace: true, hasCodeHost: false });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 3);
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
      expect(screen.getByRole('button', { name: /skip for now/i })).toBeDefined();
    });

    it('offers Continue on the code host step once connected', () => {
      setHook({ providersConnected: 1, hasWorkspace: true, hasCodeHost: true });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 3);
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();
      expect(screen.getByRole('button', { name: /continue/i })).toBeDefined();
    });

    it('offers Continue on the tracker step for a Slack-only connect', () => {
      setHook({
        providersConnected: 1,
        hasWorkspace: true,
        hasCodeHost: true,
        hasLinear: false,
        hasJira: false,
        hasSlack: true,
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 4);
      expect(screen.getByTestId('TrackerStep')).toBeDefined();
      expect(screen.getByRole('button', { name: /^continue$/i })).toBeDefined();
      expect(screen.queryByRole('button', { name: /skip for now/i })).toBeNull();
    });

    it('announces when changing workspace removes setup steps and moves to the next valid step', () => {
      setHook({
        providersConnected: 1,
        hasWorkspace: true,
        projectKind: 'repo',
      });
      const { rerender } = render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 3);
      expect(screen.getByTestId('CodeHostStep')).toBeDefined();

      setHook({
        providersConnected: 1,
        hasWorkspace: true,
        projectKind: 'folder',
      });
      rerender(<OnboardingWizard />);

      expect(screen.getByTestId('TrackerStep')).toBeDefined();
      expect(
        screen.getByText('Code host and Sentry are skipped for standalone workspaces.'),
      ).toBeDefined();
    });
  });

  describe('setup mode', () => {
    it('starts at the preferences step with no back button', () => {
      setHook({ mode: 'setup', hasWorkspace: true });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('PreferencesStep')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
      expect(screen.queryByTestId('stepper')).toBeNull();
    });

    it('keeps only the tracker step between preferences and ready for a simple workspace', () => {
      setHook({
        mode: 'setup',
        hasWorkspace: true,
        workspaceId: 'simple-workspace' as never,
        projectKind: 'folder',
      });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('PreferencesStep')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(screen.getByTestId('TrackerStep')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
      expect(screen.getByTestId('ReadyStep')).toBeDefined();
      expect(screen.queryByTestId('CodeHostStep')).toBeNull();
      expect(screen.queryByTestId('SentryStep')).toBeNull();
    });

    it('passes the current step, filtered steps, and completed progress to the stepper', () => {
      progressState.completed = new Set(['workspace']);
      setHook({ mode: 'setup', hasWorkspace: true, projectKind: 'folder' });
      render(<OnboardingWizard />);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(screen.getByTestId('stepper').textContent).toBe('5/3,5,7/workspace');
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

    it('ignores Escape on the ready step, where Skip setup is gone', async () => {
      setHook({
        providersConnected: 1,
        hasWorkspace: true,
        hasCodeHost: true,
        hasLinear: true,
        hasSentry: true,
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 6);
      expect(screen.getByTestId('ReadyStep')).toBeDefined();
      expect(screen.queryByRole('button', { name: /skip setup/i })).toBeNull();
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(finishWizard).not.toHaveBeenCalled();
    });

    it('finishes the wizard from the ready step', async () => {
      setHook({
        providersConnected: 1,
        hasWorkspace: true,
        hasCodeHost: true,
        hasLinear: true,
        hasSentry: true,
      });
      render(<OnboardingWizard />);
      advance(/get started/i, 1);
      advance(/continue/i, 6);
      expect(screen.getByTestId('ReadyStep')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: /start building/i }));
      await waitFor(() => expect(finishWizard).toHaveBeenCalledOnce());
    });
  });
});
