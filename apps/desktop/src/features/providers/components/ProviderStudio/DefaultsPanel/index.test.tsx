import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OverrideSettings } from '@goodboy/types';
import { DefaultsPanel } from './index';

type SetWorkspaceOverrides = (workspaceId: string, overrides: OverrideSettings) => Promise<void>;

const { state } = vi.hoisted(() => ({
  state: {
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
    ],
    setWorkspaceOverrides: vi.fn<SetWorkspaceOverrides>(async () => undefined),
  },
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (store: typeof state) => T) => selector(state),
}));

vi.mock('../../ProviderChip', () => ({
  ProviderChip: ({
    id,
    selected,
    disabled,
    onClick,
  }: {
    id: string;
    selected: boolean;
    disabled: boolean;
    onClick: () => void;
  }) => (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick}>
      {id}
    </button>
  ),
}));

vi.mock('../../../../../shared/components/RoutingPicker', () => ({
  RoutingPicker: ({
    ariaLabel,
    provider,
    model,
    recommendedModel,
    onProvider,
    onModel,
  }: {
    ariaLabel: string;
    provider: string;
    model: string;
    recommendedModel: string;
    onProvider: (provider: string) => void;
    onModel: (model: string) => void;
  }) => (
    <>
      <button
        type="button"
        aria-label={`${ariaLabel} provider`}
        onClick={() => onProvider('cursor')}
      >
        {provider}
      </button>
      <button
        type="button"
        aria-label={`${ariaLabel} model`}
        onClick={() => onModel('claude-sonnet-4-6')}
      >
        {model === '' ? `${recommendedModel} auto` : model}
      </button>
      <button
        type="button"
        aria-label={`${ariaLabel} cheap model`}
        onClick={() => onModel('claude-haiku-4-5')}
      >
        pick haiku
      </button>
    </>
  ),
}));

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  scoutFanout: null,
};

beforeEach(() => {
  state.workspaceOverrides = { 'ws-1': EMPTY_OVERRIDES };
  state.setWorkspaceOverrides.mockReset();
  state.setWorkspaceOverrides.mockImplementation(async (workspaceId, overrides) => {
    state.workspaceOverrides = {
      ...state.workspaceOverrides,
      [workspaceId]: overrides,
    };
  });
});

afterEach(cleanup);

const TASK_LABELS = ['Summaries', 'Branch names', 'Planning', 'Agent titles', 'PR and MR drafts'];

describe('DefaultsPanel', () => {
  it('renders every task model row', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('Summaries')).toBeDefined();
    expect(screen.getByText('Branch names')).toBeDefined();
    expect(screen.getByText('Planning')).toBeDefined();
    expect(screen.getByText('Agent titles')).toBeDefined();
    expect(screen.getByText('PR and MR drafts')).toBeDefined();
  });

  it('shows the resolved model for automatic task preferences', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    for (const label of TASK_LABELS) {
      expect(screen.getByRole('button', { name: `${label} routing model` }).textContent).toBe(
        'claude-haiku-4-5 auto',
      );
    }
    expect(screen.getByLabelText('Summaries routing status: default')).toBeDefined();
    expect(screen.getByLabelText('Planner routing status: default')).toBeDefined();
  });

  it('marks a task override as custom and resets it to default', async () => {
    const { rerender } = render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByLabelText('Summaries routing status: default')).toBeDefined();
    fireEvent.click(screen.getAllByText('claude-haiku-4-5 auto')[0]!);

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
    );

    rerender(<DefaultsPanel workspaceId={'ws-1' as never} />);
    expect(screen.getByLabelText('Summaries routing status: custom')).toBeDefined();
    const reset = screen.getByRole('button', { name: 'Reset to default' });
    await waitFor(() => expect(reset.hasAttribute('disabled')).toBe(false));
    fireEvent.click(reset);

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ taskModels: null }),
    );

    rerender(<DefaultsPanel workspaceId={'ws-1' as never} />);
    expect(screen.getByLabelText('Summaries routing status: default')).toBeDefined();
  });

  it('renders a row per agent role', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('Scout')).toBeDefined();
    expect(screen.getByText('Debugger')).toBeDefined();
    expect(screen.getByText('Planner')).toBeDefined();
    expect(screen.getByText('Reviewer')).toBeDefined();
    expect(screen.getByText('Custom')).toBeDefined();
  });

  it('reads a role with no override as its compiled default', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByRole('button', { name: 'Planner routing model' }).textContent).toBe(
      'claude-opus-5 auto',
    );
  });

  it('persists a role model with an effort the model supports', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Scout routing model' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        roleModels: {
          scout: { providerId: 'anthropic', model: 'claude-sonnet-4-6', effort: 'low' },
        },
      }),
    );
  });

  it('pins a role to a cheap model with no effort ladder instead of clearing it', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Debugger routing cheap model' }));

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        roleModels: {
          investigator: { providerId: 'anthropic', model: 'claude-haiku-4-5', effort: 'medium' },
        },
      }),
    );
  });

  it('resets a stored role override to the selected default provider', async () => {
    state.workspaceOverrides = {
      'ws-1': {
        ...EMPTY_OVERRIDES,
        defaultProviderId: 'cursor',
        roleModels: {
          reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'max' },
        },
      },
    };
    const { rerender } = render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByRole('button', { name: 'Reviewer routing model' }).textContent).toBe(
      'claude-opus-5',
    );
    expect(screen.getByLabelText('Reviewer routing status: custom')).toBeDefined();
    const reset = screen.getByRole('button', { name: 'Reset to default' });
    await waitFor(() => expect(reset.hasAttribute('disabled')).toBe(false));
    fireEvent.click(reset);

    expect(state.setWorkspaceOverrides).toHaveBeenLastCalledWith(
      'ws-1',
      expect.objectContaining({ roleModels: null }),
    );

    rerender(<DefaultsPanel workspaceId={'ws-1' as never} />);
    expect(screen.getByLabelText('Reviewer routing status: default')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reviewer routing provider' }).textContent).toBe(
      'cursor',
    );
  });

  it('keeps provider changes local while automatic is selected', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Summaries routing provider' }));

    expect(state.setWorkspaceOverrides).not.toHaveBeenCalled();
    const modelPicker = screen.getByRole('button', { name: 'Summaries routing model' });

    fireEvent.click(modelPicker);

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'cursor', model: 'claude-sonnet-4-6' },
        },
      }),
    );
  });
});
