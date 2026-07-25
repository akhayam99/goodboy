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
        {model === '' ? `${recommendedModel} recommended` : model}
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
