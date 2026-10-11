import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GROUPS, ROLE_REGISTRY, TASKS } from '@goodboy/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OverrideSettings, Project, TaskModelPreference, WorkspaceId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  mergeWorkspaceOverrides,
  type WorkspaceOverridesPatch,
} from '../../../../../store/slices/overrides/patchWorkspaceOverrides';
import { chatModelKey } from '../../../../workspace-chat/chatRouting';
import { DefaultsPanel } from './index';

type SetWorkspaceOverrides = (workspaceId: string, overrides: OverrideSettings) => Promise<void>;

const { state } = vi.hoisted(() => ({
  state: {
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    workspaces: [{ id: 'ws-1', name: 'Harborline' }],
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
    ],
    projects: [] as ReadonlyArray<Project>,
    settings: {} as Record<string, string>,
    providerLimits: {},
    loadSetting: vi.fn(async (_key: string) => null as string | null),
    saveSetting: vi.fn(async (_key: string, _value: string) => undefined),
    reportError: vi.fn(),
    setWorkspaceOverrides: vi.fn<SetWorkspaceOverrides>(async () => undefined),
    patchWorkspaceOverrides: async (_params: {
      workspaceId: string;
      patch: WorkspaceOverridesPatch;
    }): Promise<void> => undefined,
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (store: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('../../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({
    ariaLabel,
    provider,
    model,
    effort,
    recommendation,
    onChange,
    commit,
    onReset,
    overridden,
    footer,
  }: {
    ariaLabel: string;
    provider: string;
    model: string;
    effort: { editable: boolean; value?: string };
    recommendation?: { provider?: string; model?: string };
    onChange: (route: { provider: string; model: string; effort: string }) => void;
    commit?: {
      label: string;
      onCommit: (route: { provider: string; model: string; effort: string }) => void;
    };
    onReset?: () => void;
    overridden?: boolean;
    footer?: ReactNode;
  }) => {
    const held = effort.value ?? 'medium';
    const shownModel = model === '' ? (recommendation?.model ?? '') : model;
    return (
      <>
        <button
          type="button"
          aria-label={`${ariaLabel} provider`}
          onClick={() => onChange({ provider: 'cursor', model: 'composer-2.5', effort: held })}
        >
          {provider}
        </button>
        <button
          type="button"
          aria-label={`${ariaLabel} model`}
          onClick={() => onChange({ provider, model: 'claude-sonnet-4-6', effort: held })}
        >
          {shownModel}
        </button>
        <button
          type="button"
          aria-label={`${ariaLabel} auto`}
          onClick={() => onChange({ provider: '', model: '', effort: held })}
        >
          auto
        </button>
        <button
          type="button"
          aria-label={`${ariaLabel} cheap model`}
          onClick={() => onChange({ provider, model: 'claude-haiku-4-5', effort: held })}
        >
          pick haiku
        </button>
        <button
          type="button"
          aria-label={`${ariaLabel} high effort`}
          disabled={!effort.editable}
          onClick={() => onChange({ provider, model: shownModel, effort: 'high' })}
        >
          {effort.value ?? ''}
        </button>
        {commit != null && (
          <button
            type="button"
            aria-label={`${ariaLabel} commit`}
            onClick={() => commit.onCommit({ provider, model: 'claude-sonnet-4-6', effort: held })}
          >
            {commit.label}
          </button>
        )}
        {onReset != null && overridden === true && (
          <button type="button" aria-label={`${ariaLabel} reset`} onClick={onReset}>
            reset
          </button>
        )}
        {footer}
      </>
    );
  },
}));

const EMPTY_OVERRIDES: OverrideSettings = {
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
};

beforeEach(() => {
  state.patchWorkspaceOverrides = ({ workspaceId, patch }) =>
    state.setWorkspaceOverrides(
      workspaceId,
      mergeWorkspaceOverrides({
        base: state.workspaceOverrides[workspaceId] ?? EMPTY_OVERRIDES,
        patch,
      }),
    );
  state.workspaceOverrides = { 'ws-1': EMPTY_OVERRIDES };
  state.projects = [];
  state.settings = {};
  state.loadSetting.mockClear();
  state.saveSetting.mockClear();
  state.setWorkspaceOverrides.mockReset();
  state.setWorkspaceOverrides.mockImplementation(async (workspaceId, overrides) => {
    state.workspaceOverrides = {
      ...state.workspaceOverrides,
      [workspaceId]: overrides,
    };
  });
});

afterEach(cleanup);

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const roleRow = (label: string): HTMLElement =>
  screen.getByRole('button', { name: (name) => name.startsWith(label) });

const roleSummary = (label: string): HTMLElement => {
  const summary = roleRow(label).querySelector<HTMLElement>('[data-role-summary]');
  if (summary === null) {
    throw new Error(`${label} row has no model summary`);
  }
  return summary;
};

const TASK_LABELS = [
  'Step summaries',
  'Plan drafting',
  'Prose polish',
  'Agent naming',
  'Workflow orchestrator',
  'PR and MR drafts',
  'Rebase',
];

const SONNET_TASK_LABELS: ReadonlySet<string> = new Set([
  'Plan drafting',
  'Workflow orchestrator',
  'PR and MR drafts',
  'Rebase',
]);

describe('DefaultsPanel', () => {
  it('sums up the provider policy and names the provider new work starts on', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        providerPool: [
          { id: 'cursor', state: 'on' },
          { id: 'anthropic', state: 'backup' },
        ],
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    const trigger = screen.getByRole('button', { name: /Cursor · Claude as backup/ });
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(
      screen.getByText('New work starts on Cursor. Backup only if no On provider can work.'),
    ).toBeDefined();
  });

  it('reads every connected provider as On while no policy is saved', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByRole('button', { name: /^Claude, Cursor/ })).toBeDefined();
  });

  it('renders every task model row', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    for (const label of TASK_LABELS) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('shows the resolved model with an auto status for automatic task preferences', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    for (const label of TASK_LABELS) {
      expect(screen.getByRole('button', { name: `${label} routing model` }).textContent).toBe(
        SONNET_TASK_LABELS.has(label) ? 'sonnet-5.5' : 'haiku-4.5',
      );
    }
    expect(screen.queryByRole('button', { name: 'Step summaries routing reset' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Planner routing reset' })).toBeNull();
  });

  it('marks a task override as custom and resets it to auto', async () => {
    const { rerender } = render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.queryByRole('button', { name: 'Step summaries routing reset' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing model' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
    );

    rerender(<DefaultsPanel workspaceId={'ws-1' as never} />);
    expect(screen.queryByText(/\d pinned$/)).toBeNull();
    const reset = screen.getByRole('button', { name: 'Step summaries routing reset' });
    await waitFor(() => expect(reset.hasAttribute('disabled')).toBe(false));
    fireEvent.click(reset);

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ taskModels: null }),
    );

    rerender(<DefaultsPanel workspaceId={'ws-1' as never} />);
    expect(screen.queryByRole('button', { name: 'Step summaries routing reset' })).toBeNull();
  });

  it('persists an effort for a task model', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Workflow orchestrator routing model' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Workflow orchestrator routing high effort' }),
    );

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          workflow_orchestrator: {
            providerId: 'anthropic',
            model: 'claude-sonnet-4-6',
            effort: 'high',
          },
        },
      }),
    );
  });

  it('drops the effort when the task model has no effort ladder', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'sonnet-4.6', effort: 'high' },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing cheap model' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
        },
      }),
    );
  });

  it('keeps both task pins when two rows change before a re-render', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing cheap model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan drafting routing cheap model' }));

    const taskModels = state.workspaceOverrides['ws-1']?.taskModels ?? {};
    expect(Object.keys(taskModels).sort()).toEqual(['plan_generation', 'summarizer']);
  });

  it('renders a row per agent role', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('Scout')).toBeDefined();
    expect(screen.getByText('Debugger')).toBeDefined();
    expect(screen.getByText('Planner')).toBeDefined();
    expect(screen.getByText('Reviewer')).toBeDefined();
    expect(screen.getByText('Resolver')).toBeDefined();
    expect(screen.getByText('Generalist')).toBeDefined();
  });

  it('shows what Auto picks on each closed role row', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(roleRow('Planner').textContent).toContain('Opus 5.5');
    expect(roleRow('Scout').textContent).toContain('Haiku 4.5');
    expect(roleRow('Planner').getAttribute('aria-expanded')).toBe('false');
  });

  it('renders an auto role and a pinned set of two in the same shape', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          reviewer: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-opus-5-5' },
              { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
            ],
          },
        },
      },
    };
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    const shape = /^[A-Za-z0-9. ]+·(Minimal|Low|Medium|High|Very high|Max)(\+\d)?$/;
    const auto = roleSummary('Planner');
    const pinned = roleSummary('Reviewer');
    expect(auto.textContent).toMatch(shape);
    expect(pinned.textContent).toMatch(shape);
    expect(pinned.textContent).toBe('Opus 5.5·High+1');
    expect(auto.textContent).not.toContain('+');
    expect(auto.querySelectorAll('svg')).toHaveLength(1);
    expect(pinned.querySelectorAll('svg')).toHaveLength(1);
    expect(auto.firstElementChild?.tagName).toBe('svg');
    expect(pinned.firstElementChild?.tagName).toBe('svg');
  });

  it('opens a role to show how it runs, read only, from the engine', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(roleRow('Scout'));

    const how = screen.getByRole('region', { name: 'How Scout runs' });
    expect(how.textContent).toContain('Read only');
    expect(how.textContent).toContain(ROLE_REGISTRY.scout.explain.does);
    expect(how.textContent).toContain('Up to 4 scouts, 2 levels');
    expect(how.textContent).toContain('Parallel agents is off in this workspace');
    expect(how.textContent).toContain(
      'Scouts it starts use the same providers as the parent, filtered by your provider order.',
    );
  });

  it('says a planner never splits and launches nothing', () => {
    state.workspaceOverrides = { 'ws-1': { ...EMPTY_OVERRIDES, parallelAgents: true } };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(roleRow('Planner'));

    const how = screen.getByRole('region', { name: 'How Planner runs' });
    expect(how.textContent).toContain('Never splits');
    expect(how.textContent).toContain('Nothing. It hands the plan to the steps that follow.');
    expect(how.textContent).not.toContain('Parallel agents is off');
  });

  it('starts a role with no set and adds a model to it', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(roleRow('Planner'));
    const set = screen.getByRole('region', { name: 'Models for planning' });
    expect(set.textContent).toContain('Not set. Auto picks the model');
    fireEvent.click(screen.getByRole('button', { name: 'Add model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Planner add model model' }));
    expect(state.setWorkspaceOverrides).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Planner add model commit' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledTimes(1);
    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-sonnet-4-6',
            effort: 'high',
            models: [{ providerId: 'anthropic', model: 'claude-sonnet-4-6' }],
          },
        },
      }),
    );
  });

  it('shows the effort of the model that runs when a choice overrides the role effort', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'low' },
              { providerId: 'anthropic', model: 'claude-sonnet-5-5' },
            ],
          },
        },
      },
    };
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    expect(roleSummary('Planner').textContent).toBe('Opus 5.5·Low+1');
  });

  it('reads an old pin and fallback as a set of two and shows it on the row', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5',
            effort: 'high',
            fallback: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
          },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(roleSummary('Planner').textContent).toBe('Opus 5·High+1');
    fireEvent.click(roleRow('Planner'));
    const chips = within(screen.getByRole('list', { name: 'Planner models' })).getAllByRole(
      'group',
    );
    expect(chips.map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Opus 5, position 1',
      'Haiku 4.5, position 2',
    ]);
  });

  it('moves a model with alt and an arrow, and removes one with backspace', async () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-opus-5-5' },
              { providerId: 'anthropic', model: 'claude-haiku-4-5' },
            ],
          },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(roleRow('Planner'));

    fireEvent.keyDown(screen.getByRole('group', { name: 'Opus 5.5, position 1' }), {
      key: 'ArrowRight',
      altKey: true,
    });

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-haiku-4-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-haiku-4-5' },
              { providerId: 'anthropic', model: 'claude-opus-5-5' },
            ],
          },
        },
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove Haiku 4.5' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.keyDown(screen.getByRole('group', { name: /^Haiku 4.5, position/ }), {
      key: 'Backspace',
    });

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [{ providerId: 'anthropic', model: 'claude-opus-5-5' }],
          },
        },
      }),
    );
  });

  it('clears the role when its last model is removed', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(roleRow('Reviewer'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Opus 5' }));

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ roleModels: null }),
    );
  });

  it('scrolls to the background task the link came for', () => {
    const scrolled: Array<string | null> = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this.getAttribute('data-default-row'));
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} focusSection="summarizer" />);
    Element.prototype.scrollIntoView = original;

    expect(scrolled).toEqual(['summarizer']);
  });

  it('strikes out a model that left the catalog and stops at three', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        roleModels: {
          planner: {
            providerId: 'anthropic',
            model: 'claude-opus-5-5',
            effort: 'high',
            models: [
              { providerId: 'anthropic', model: 'claude-opus-5-5' },
              { providerId: 'codex', model: 'gpt-6.1-sol' },
              { providerId: 'anthropic', model: 'claude-fable-1' },
            ],
          },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(roleRow('Planner'));

    const gone = screen.getByRole('group', { name: /position 3, no longer in the catalog$/ });
    expect(gone.textContent).toContain('Gone, skipped');
    const add = screen.getByRole('button', { name: 'Up to 3' });
    expect(add.hasAttribute('disabled')).toBe(true);
  });

  it('pins the provider with its model in one write when picked while automatic is selected', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing provider' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledTimes(1);
    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'cursor', model: 'composer-2.5' },
        },
      }),
    );
  });

  it('shows the providers, agents and background tasks on one page', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('When a provider is out')).toBeDefined();
    expect(screen.getByText('Step summaries')).toBeDefined();
    expect(screen.getByText('Scout')).toBeDefined();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('renders 11 roles and 11 tasks inside their groups', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    const agents = screen.getByRole('region', { name: 'Agents' });
    const tasks = screen.getByRole('region', { name: 'Background tasks' });
    expect(within(agents).getAllByRole('button', { expanded: false })).toHaveLength(11);
    expect(tasks.querySelectorAll('[aria-label$=" routing model"]')).toHaveLength(11);
    for (const group of DEFAULT_GROUPS.tasks) {
      const node = screen.getByRole('group', { name: group.label });
      for (const id of group.members) {
        const task = TASKS.find((candidate) => candidate.id === id);
        expect(node.textContent).toContain(task?.label);
      }
    }
    const planner = screen.getByRole('group', { name: 'Explore and plan' });
    expect(planner.textContent).toContain(ROLE_REGISTRY.planner.summary);
  });

  it('clears a task override when auto is picked in the model picker', () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing auto' }));

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ taskModels: null }),
    );
  });

  it('counts only the task overrides the panel can show, and drops the rest on write', () => {
    const storedTaskModels: Readonly<Record<string, TaskModelPreference>> = {
      branch_naming: { providerId: 'anthropic', model: 'claude-sonnet-5' },
      summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
    };
    state.workspaceOverrides = {
      'ws-1': { ...EMPTY_OVERRIDES, taskModels: storedTaskModels },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.queryByText('Branch naming')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Models actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all to Auto' }));
    expect(screen.getByText('Reset 1 pinned model to Auto?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Step summaries routing auto' }));

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ taskModels: null }),
    );
  });

  it('shows Reset all to Auto as a header button only while something is pinned', () => {
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    expect(screen.queryByRole('button', { name: 'Reset all to Auto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Models actions' })).toBeNull();
  });

  it('counts pins across roles and tasks and resets them all to Auto after a confirm', async () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
        },
        roleModels: {
          scout: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'low' },
          reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
        },
      },
    };
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.queryByText(/\d pinned$/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Models actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all to Auto' }));
    expect(screen.getByText('Reset 3 pinned models to Auto?')).toBeDefined();
    expect(state.setWorkspaceOverrides).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));

    await waitFor(() =>
      expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
        'ws-1',
        expect.objectContaining({ taskModels: null, roleModels: null }),
      ),
    );
  });
  it('counts a saved new-chat model as pinned and resets it with the rest', async () => {
    state.settings = {
      'chat.default_model.ws-1': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: null,
      }),
    };
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    expect(screen.queryByRole('button', { name: 'Models actions' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all to Auto' }));
    expect(screen.getByText('Reset 1 pinned model to Auto?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));

    await waitFor(() =>
      expect(state.saveSetting).toHaveBeenLastCalledWith('chat.default_model.ws-1', ''),
    );
  });

  it('saves a new-chat model per workspace in the settings store', () => {
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'New chats routing model' }));

    expect(state.saveSetting).toHaveBeenLastCalledWith(
      'chat.default_model.ws-1',
      JSON.stringify({
        provider: 'anthropic',
        model: chatModelKey({ provider: 'anthropic', modelId: 'claude-sonnet-4-6' }),
        effort: null,
      }),
    );
  });

  it('shows a saved new-chat model as overridden and clears it back to Auto', () => {
    state.settings = {
      'chat.default_model.ws-1': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'high',
      }),
    };
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'New chats routing reset' }));

    expect(state.saveSetting).toHaveBeenLastCalledWith('chat.default_model.ws-1', '');
  });

  it('pins an effort for new chats on the saved model', () => {
    state.settings = {
      'chat.default_model.ws-1': JSON.stringify({
        provider: 'anthropic',
        model: 'opus-5',
        effort: 'low',
      }),
    };
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'New chats routing high effort' }));

    expect(state.saveSetting).toHaveBeenLastCalledWith(
      'chat.default_model.ws-1',
      JSON.stringify({ provider: 'anthropic', model: 'opus-5', effort: 'high' }),
    );
  });

  describe('with a provider turned off', () => {
    const CURSOR_ONLY = [
      { id: 'cursor', state: 'on' },
      { id: 'anthropic', state: 'off' },
    ] as const;

    const OPUS_PIN = { providerId: 'anthropic', model: 'claude-opus-5-5', effort: 'high' } as const;

    it('says how many agents pin a model that cannot run and puts only those back to Auto', async () => {
      state.workspaceOverrides = {
        'ws-1': {
          ...EMPTY_OVERRIDES,
          providerPool: CURSOR_ONLY,
          roleModels: {
            planner: OPUS_PIN,
            reviewer: OPUS_PIN,
            scout: { providerId: 'cursor', model: 'composer-2.5', effort: 'low' },
          },
        },
      };
      render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

      expect(
        screen.getByText(
          'With Cursor as the only provider, 2 of 11 agents use a pin that cannot run. Auto picks apply.',
        ),
      ).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Back to Auto for those 2' }));
      const confirm = screen.getByRole('dialog', { name: 'Put 2 agents back to Auto?' });
      expect(state.setWorkspaceOverrides).not.toHaveBeenCalled();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Back to Auto' }));

      await waitFor(() =>
        expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
          'ws-1',
          expect.objectContaining({
            roleModels: {
              scout: { providerId: 'cursor', model: 'composer-2.5', effort: 'low' },
            },
          }),
        ),
      );
    });

    it('stays quiet while every pin can run', () => {
      state.workspaceOverrides = {
        'ws-1': {
          ...EMPTY_OVERRIDES,
          providerPool: [
            { id: 'anthropic', state: 'on' },
            { id: 'cursor', state: 'on' },
          ],
          roleModels: { planner: OPUS_PIN },
        },
      };
      render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

      expect(screen.queryByText(/use a pin that cannot run/)).toBeNull();
      expect(screen.queryByRole('button', { name: /^Back to Auto for/ })).toBeNull();
    });

    it('marks every row Pinned or Auto and names the skipped pin on a role and a task', () => {
      state.workspaceOverrides = {
        'ws-1': {
          ...EMPTY_OVERRIDES,
          providerPool: CURSOR_ONLY,
          roleModels: { planner: OPUS_PIN },
          taskModels: {
            summarizer: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
          },
        },
      };
      render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

      expect(roleRow('Planner').textContent).toContain('Pinned');
      expect(roleRow('Scout').textContent).toContain('Auto');
      expect(screen.getAllByText('Pinned')).toHaveLength(2);
      expect(
        screen.getByText(/^Pinned Opus 5\.5 is skipped: Claude is Off\. Using /),
      ).toBeDefined();
      expect(
        screen.getByText(/^Pinned Haiku 4\.5 is skipped: Claude is Off\. Using /),
      ).toBeDefined();
    });
  });

  it('puts the project notice on the page when a project of the workspace pins models', () => {
    state.projects = [
      aProject({
        workspaceId: WORKSPACE_ID,
        name: 'payments-api',
        overrides: {
          ...EMPTY_OVERRIDES,
          taskModels: { summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-5' } },
        },
      }),
    ];
    render(<DefaultsPanel workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText('1 project has its own model settings')).toBeDefined();
  });
});
