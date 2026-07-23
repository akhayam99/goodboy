import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { OverrideSettings } from '@goodboy/types';
import { DefaultsPanel } from './index';

const { state } = vi.hoisted(() => ({
  state: {
    workspaceOverrides: {} as Record<string, OverrideSettings>,
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'cursor', connection: 'connected' },
    ],
    setWorkspaceOverrides: vi.fn(async () => undefined),
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

vi.mock('../../../../session/components/ModelSelect', () => ({
  ModelSelect: ({
    provider,
    value,
    recommendedModel,
    onChange,
  }: {
    provider: string;
    value: string;
    recommendedModel: string;
    onChange: (model: string) => void;
  }) => (
    <button
      type="button"
      aria-label={`${provider} model`}
      onClick={() => onChange('claude-sonnet-4-6')}
    >
      {value === '' ? `${recommendedModel} recommended` : value}
    </button>
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
  scoutFanout: null,
};

beforeEach(() => {
  state.workspaceOverrides = { 'ws-1': EMPTY_OVERRIDES };
  state.setWorkspaceOverrides.mockClear();
});

afterEach(cleanup);

describe('DefaultsPanel', () => {
  it('renders every task model row', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getByText('Summaries')).toBeDefined();
    expect(screen.getByText('Branch names')).toBeDefined();
    expect(screen.getByText('Planning')).toBeDefined();
    expect(screen.getByText('Agent titles')).toBeDefined();
    expect(screen.getByText('PR and MR drafts')).toBeDefined();
  });

  it('shows the resolved model for automatic preferences', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    expect(screen.getAllByText('claude-haiku-4-5 recommended')).toHaveLength(5);
  });

  it('persists a selected task model immediately', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getAllByText('claude-haiku-4-5 recommended')[0]!);

    expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
      'ws-1',
      expect.objectContaining({
        taskModels: {
          summarizer: { providerId: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
    );
  });

  it('keeps provider changes local while automatic is selected', () => {
    render(<DefaultsPanel workspaceId={'ws-1' as never} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Summaries provider' }), {
      target: { value: 'cursor' },
    });

    expect(state.setWorkspaceOverrides).not.toHaveBeenCalled();
    const modelPicker = screen.getByRole('button', { name: 'cursor model' });

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
