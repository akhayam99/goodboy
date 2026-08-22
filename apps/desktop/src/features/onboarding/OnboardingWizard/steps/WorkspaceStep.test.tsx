// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';

vi.mock('../../../workspace/components/WorkspaceLinkForm', () => ({
  WorkspaceLinkForm: ({
    onComplete,
    onCancel,
    cancelLabel,
    modes,
  }: {
    onComplete: (params: { readonly mode: 'single' | 'multi' | 'simple' }) => void;
    onCancel: () => void;
    cancelLabel: string;
    modes: ReadonlyArray<string>;
  }) => (
    <div data-testid="workspace-link-form" data-modes={modes.join(',')}>
      <button onClick={() => onComplete({ mode: 'single' })}>Complete single</button>
      <button onClick={() => onComplete({ mode: 'multi' })}>Complete multi</button>
      <button onClick={onCancel}>{cancelLabel}</button>
    </div>
  ),
}));

import { WorkspaceStep, type WorkspaceAudience } from './WorkspaceStep';

const Harness = ({ workspace }: { workspace: Workspace | null }) => {
  const [audience, setAudience] = useState<WorkspaceAudience | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  return (
    <WorkspaceStep
      workspace={workspace}
      audience={audience}
      onAudienceChange={setAudience}
      isChanging={isChanging}
      onIsChangingChange={setIsChanging}
    />
  );
};

const REPOSITORY_WORKSPACE = {
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

afterEach(cleanup);

describe('WorkspaceStep', () => {
  it('asks how the user works before showing any workspace form', () => {
    const onAddWorkspace = vi.fn();
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    render(<Harness workspace={null} />);

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();
    expect(screen.queryByTestId('workspace-link-form')).toBeNull();
    expect(onAddWorkspace).not.toHaveBeenCalled();
    window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
  });

  it('offers the repository paths and the standalone path to a developer', () => {
    render(<Harness workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));

    expect(screen.getByRole('heading', { name: 'Add workspace' })).toBeDefined();
    expect(screen.getByTestId('workspace-link-form').getAttribute('data-modes')).toBe(
      'single,multi,simple',
    );
  });

  it('tells a developer what standalone gives up until a code host is linked', () => {
    render(<Harness workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));

    expect(
      screen.getByText(
        /Standalone skips git: plain folders, no branch, no diff and no pull requests until you link a code host\./,
      ),
    ).toBeDefined();
  });

  it('keeps the form open after adding the first single-project workspace', () => {
    const { rerender } = render(<Harness workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete single' }));
    rerender(<Harness workspace={REPOSITORY_WORKSPACE} />);

    expect(screen.getByTestId('workspace-link-form')).toBeDefined();
  });

  it('sends everyone else straight to the standalone path', () => {
    render(<Harness workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I do not write code/ }));

    expect(screen.getByTestId('workspace-link-form').getAttribute('data-modes')).toBe('simple');
  });

  it('goes back to the question from the form', () => {
    render(<Harness workspace={null} />);

    fireEvent.click(screen.getByRole('button', { name: /I write code/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();
    expect(screen.queryByTestId('workspace-link-form')).toBeNull();
  });

  it('shows the connected repository name, path, and normalized kind', () => {
    render(<Harness workspace={REPOSITORY_WORKSPACE} />);

    expect(screen.getByRole('heading', { name: 'Workspace connected' })).toBeDefined();
    expect(screen.getByText('Goodboy desktop')).toBeDefined();
    expect(screen.getByText('/Users/dev/goodboy')).toBeDefined();
    expect(screen.getByText('Workspace')).toBeDefined();
  });

  it('treats an explicit repo kind the same as an undefined kind', () => {
    const { rerender } = render(<Harness workspace={REPOSITORY_WORKSPACE} />);
    expect(screen.getByText('Workspace')).toBeDefined();

    rerender(<Harness workspace={REPOSITORY_WORKSPACE} />);

    expect(screen.getByText('Workspace')).toBeDefined();
  });

  it('shows the standalone kind and lets the user change the workspace inline', () => {
    render(<Harness workspace={REPOSITORY_WORKSPACE} />);

    fireEvent.click(screen.getByRole('button', { name: 'Change workspace' }));

    expect(screen.getByRole('heading', { name: 'How do you work?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Workspace')).toBeDefined();
  });
});
