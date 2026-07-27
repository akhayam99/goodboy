// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId, WorkspaceId } from '@goodboy/types';

type Store = {
  readonly workspaceOverrides: null;
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) =>
    selector({
      workspaceOverrides: null,
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
    fireEvent.click(screen.getByRole('button', { name: /^step routing:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Verbose' }));
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Summarize changes',
        verbosityDefault: 'verbose',
      }),
    );
  });
});
