// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getModelProvider } from '@goodboy/core';
import type { IsoDateTime, ProviderId, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';

type Store = {
  readonly workspaceOverrides: null;
  readonly providers: ReadonlyArray<never>;
  readonly cliRequirements: ReadonlyArray<never>;
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      workspaceOverrides: null,
      providers: [],
      cliRequirements: [],
    }),
  useCurrentWorkspace: () => null,
}));

import { LibraryStepForm } from './index';

afterEach(cleanup);

describe('LibraryStepForm', () => {
  it('persists verbosity through the routing picker', () => {
    const onCommit = vi.fn();
    render(
      <LibraryStepForm
        def={null}
        workspaceId={'workspace-1' as WorkspaceId}
        connectedProviders={['anthropic' as ProviderId]}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('step name'), {
      target: { value: 'Summarize changes' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Step routing:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Verbose' }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Summarize changes',
        verbosityDefault: 'verbose',
      }),
    );
  });

  it('never pairs a model with a provider that does not own it', () => {
    const onCommit = vi.fn();
    const def: StepDef = {
      id: 'step-1' as StepDefId,
      workspaceId: 'workspace-1' as WorkspaceId,
      role: 'custom',
      name: 'Draft the summary',
      promptPrefix: '',
      providerDefault: 'anthropic' as ProviderId,
      modelDefault: 'claude-sonnet-4-6',
      createdAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
    };
    render(
      <LibraryStepForm
        def={def}
        workspaceId={'workspace-1' as WorkspaceId}
        connectedProviders={['anthropic', 'cursor'] as ReadonlyArray<ProviderId>}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Step routing:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));

    expect(onCommit.mock.calls.length).toBeGreaterThan(0);
    const last = onCommit.mock.calls.at(-1)?.[0];
    expect(last?.providerDefault).toBe('cursor');
    expect(getModelProvider(last?.modelDefault ?? '')).toBe('cursor');
    for (const [args] of onCommit.mock.calls) {
      expect(args.providerDefault === 'anthropic' && args.modelDefault !== def.modelDefault).toBe(
        false,
      );
    }
  });

  it('saves every edit of a global step into one workspace copy', () => {
    const onCommit = vi.fn();
    const def: StepDef = {
      id: 'seed_scout' as StepDefId,
      workspaceId: null,
      role: 'scout',
      name: 'Scout',
      promptPrefix: 'Map the code.',
      createdAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
      updatedAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
    };
    render(
      <LibraryStepForm
        def={def}
        workspaceId={'workspace-1' as WorkspaceId}
        connectedProviders={['anthropic' as ProviderId]}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );

    const nameInput = screen.getByPlaceholderText('step name');
    fireEvent.blur(nameInput);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.change(nameInput, { target: { value: 'Scout ledger-core' } });
    fireEvent.blur(nameInput);
    const instructions = screen.getByPlaceholderText('default role instructions…');
    fireEvent.change(instructions, { target: { value: 'Map the ledger code.' } });
    fireEvent.blur(instructions);
    fireEvent.blur(nameInput);

    expect(onCommit).toHaveBeenCalledTimes(2);
    const ids = new Set(onCommit.mock.calls.map(([args]) => args.id));
    expect(ids.size).toBe(1);
    const [copyId] = [...ids];
    expect(typeof copyId).toBe('string');
    expect(copyId).not.toBe(def.id);
    for (const [args] of onCommit.mock.calls) {
      expect(args.workspaceId).toBe('workspace-1');
    }
    expect(onCommit.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ name: 'Scout ledger-core', promptPrefix: 'Map the ledger code.' }),
    );
  });
});
