// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Project, ProjectId, Workspace, WorkspaceId } from '@goodboy/types';
import type { OnboardingWizardState } from './useOnboardingWizard';

const { hookState, setupStore, storeActions, firstSession } = vi.hoisted(() => ({
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
    setCurrentWorkspace: vi.fn(),
    workspaceOverrides: {},
    providers: [],
  },
  firstSession: {
    startFirstScout: vi.fn(),
    handOffFirstSession: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: typeof storeActions) => unknown) => selector(storeActions),
}));
vi.mock('./useOnboardingWizard', () => ({
  useOnboardingWizard: () => hookState,
}));
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
vi.mock('./defaultAgent', () => ({ applyDefaultAgent: async () => undefined }));
vi.mock('./steps/WelcomeStep', () => ({
  WelcomeStep: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="WelcomeStep">
      <button type="button" onClick={onStart}>
        Get started
      </button>
    </div>
  ),
}));
vi.mock('./steps/AgentsStep', async () => {
  const { useState } = await import('react');
  const { useEscapeLayer } = await import('@goodboy/ui');
  const InnerPanel = ({ onClose }: { onClose: () => void }) => {
    useEscapeLayer(onClose);
    return <div data-testid="inner-panel" />;
  };
  return {
    AgentsStep: ({ onDone, onBack }: { onDone: () => void; onBack: (() => void) | null }) => {
      const [isPanelOpen, setIsPanelOpen] = useState(false);
      return (
        <div data-testid="AgentsStep">
          <button type="button" onClick={() => setIsPanelOpen(true)}>
            open panel
          </button>
          {isPanelOpen ? <InnerPanel onClose={() => setIsPanelOpen(false)} /> : null}
          {onBack === null ? null : (
            <button type="button" onClick={onBack}>
              Back
            </button>
          )}
          <button type="button" onClick={onDone}>
            Continue
          </button>
        </div>
      );
    },
  };
});
vi.mock('./steps/WorkspaceStep', () => ({
  WorkspaceStep: ({
    onCreated,
    onBack,
  }: {
    onCreated: (params: { workspaceId: WorkspaceId }) => void;
    onBack: (() => void) | null;
  }) => (
    <div data-testid="WorkspaceStep">
      <button type="button" onClick={() => onCreated({ workspaceId: WORKSPACE.id })}>
        create workspace
      </button>
      <button type="button" onClick={onBack ?? undefined}>
        form back
      </button>
    </div>
  ),
}));
vi.mock('./steps/ToolsStep', () => ({
  ToolsStep: ({
    mode,
    projects,
    onBack,
    onContinue,
  }: {
    mode: string;
    projects: ReadonlyArray<Project>;
    onBack: (() => void) | null;
    onContinue: () => void;
  }) => (
    <div data-testid="ToolsStep" data-kind={projects[0]?.kind}>
      {onBack === null ? null : (
        <button type="button" onClick={onBack}>
          Back
        </button>
      )}
      <button type="button" onClick={onContinue}>
        {mode === 'single' ? 'Done' : 'Continue'}
      </button>
    </div>
  ),
}));
vi.mock('./steps/FirstSessionStep', () => ({
  FirstSessionStep: ({
    workspaceId,
    folder,
    onStart,
    onDraft,
    onSkip,
    onOpenTools,
  }: {
    workspaceId: WorkspaceId;
    folder: Project | null;
    onStart: (params: {
      workspaceId: WorkspaceId;
      projectId: string | null;
      prompt: string;
    }) => Promise<void>;
    onDraft: (params: {
      workspaceId: WorkspaceId;
      projectId: string | null;
      issue: { identifier: string };
    }) => void;
    onSkip: () => void;
    onOpenTools: (() => void) | null;
  }) => (
    <div data-testid="FirstSessionStep">
      <button
        type="button"
        onClick={() =>
          void onStart({
            workspaceId,
            projectId: folder?.id ?? null,
            prompt: 'Explain how ledger-core is organized',
          }).catch(() => undefined)
        }
      >
        start scout
      </button>
      <button
        type="button"
        onClick={() =>
          onDraft({ workspaceId, projectId: folder?.id ?? null, issue: { identifier: 'ACM-112' } })
        }
      >
        draft the brief
      </button>
      <button type="button" onClick={onSkip}>
        Skip
      </button>
      {onOpenTools !== null && (
        <button type="button" onClick={onOpenTools}>
          open tools
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
  storeActions.setCurrentWorkspace.mockReset().mockResolvedValue(undefined);
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
    click(/create workspace/i);
    await waitFor(() => expect(stepOf()).toBe('tools'));
    classes.push(screen.getByTestId('wizard-column').className);
    click(/^continue$/i);
    expect(stepOf()).toBe('first-session');
    classes.push(screen.getByTestId('wizard-column').className);
    expect(new Set(classes).size).toBe(1);
    expect(classes[0]).toContain('max-w-[600px]');
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
      click(/^continue$/i);
      expect(setupStore.markStepComplete).toHaveBeenCalledWith('tools');
      expect(stepOf()).toBe('first-session');
    });
  });

  describe('workspace step', () => {
    it('leaves the action row to the form, so the frame draws none', () => {
      setHook({ providersConnected: 1 });
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      expect(screen.getByTestId('WorkspaceStep')).toBeDefined();
      expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    });

    it('makes the created workspace current, then goes on to Tools', async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/create workspace/i);
      await waitFor(() => expect(stepOf()).toBe('tools'));
      expect(storeActions.setCurrentWorkspace).toHaveBeenCalledWith(WORKSPACE.id);
    });

    it('takes the form Back to the agents step', () => {
      setHook({ providersConnected: 1 });
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/form back/i);
      expect(stepOf()).toBe('agents');
    });
  });

  describe('tools', () => {
    const reachTools = async ({ kind }: { readonly kind: Project['kind'] }) => {
      setHook(readyState({ kind }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/create workspace/i);
      await waitFor(() => expect(stepOf()).toBe('tools'));
    };

    it('keeps Tools in the stepper for a plain folder', async () => {
      await reachTools({ kind: 'folder' });
      expect(screen.getByTestId('ToolsStep').getAttribute('data-kind')).toBe('folder');
    });

    it('continues with nothing connected, then lands on the first session', async () => {
      await reachTools({ kind: 'repo' });
      expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
      click(/^continue$/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
    });
  });

  describe('first session', () => {
    const reachFirstSession = async () => {
      setHook(readyState({ kind: 'repo' }));
      render(<OnboardingWizard />);
      click(/get started/i);
      click(/^continue$/i);
      click(/create workspace/i);
      await waitFor(() => expect(stepOf()).toBe('tools'));
      click(/^continue$/i);
      expect(screen.getByTestId('FirstSessionStep')).toBeDefined();
    };

    it('finishes setup only after the first session started', async () => {
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

    it('keeps setup open when the first session fails to start', async () => {
      firstSession.startFirstScout.mockRejectedValue(
        new Error('the worktree could not be created'),
      );
      await reachFirstSession();
      click(/start scout/i);
      await waitFor(() => expect(firstSession.startFirstScout).toHaveBeenCalledOnce());
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(setupStore.finishWizard).not.toHaveBeenCalled();
      expect(stepOf()).toBe('first-session');
    });

    it('drafts the brief from an issue after the wizard closes', async () => {
      await reachFirstSession();
      click(/draft the brief/i);
      await waitFor(() => expect(firstSession.handOffFirstSession).toHaveBeenCalled(), {
        timeout: 1000,
      });
      expect(setupStore.finishWizard).toHaveBeenCalledOnce();
      expect(firstSession.handOffFirstSession).toHaveBeenCalledWith({
        workspaceId: WORKSPACE.id,
        projectId: 'project-1',
        issue: { identifier: 'ACM-112' },
      });
    });

    it('takes the missing task source back to Tools', async () => {
      await reachFirstSession();
      click(/^open tools$/i);
      expect(stepOf()).toBe('tools');
    });

    it('skips with the one skip word and ends setup', async () => {
      await reachFirstSession();
      click(/^skip$/i);
      await waitFor(() => expect(setupStore.finishWizard).toHaveBeenCalledOnce(), {
        timeout: 1000,
      });
    });
  });

  describe('single step', () => {
    it('draws no footer bar: the step owns its action row', () => {
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tools' });
      const { container } = render(<OnboardingWizard />);
      expect(container.querySelector('footer')).toBeNull();
      expect(container.querySelector('[data-slot="form-actions"]')).toBeNull();
    });

    it('opens one step with no stepper, closes with Done and writes no setup state', async () => {
      setHook({ ...readyState({ kind: 'repo' }), mode: 'single', start: 'tools' });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('ToolsStep')).toBeDefined();
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

  describe('cover', () => {
    it('lays the app backdrop behind Welcome only', () => {
      setHook({ providersConnected: 1 });
      render(<OnboardingWizard />);
      expect(screen.getByTestId('wizard-backdrop').getAttribute('data-state')).toBe('shown');
      click(/get started/i);
      expect(screen.getByTestId('wizard-backdrop').getAttribute('data-state')).toBe('hidden');
    });
  });
});
