// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { ScriptEditor } from './index';

const project = ({ id, name }: { readonly id: string; readonly name: string }) =>
  ({
    id: id as ProjectId,
    workspaceId: 'workspace-northwind' as WorkspaceId,
    name,
    kind: 'repo',
    rootPath: `/repos/${id}`,
  }) as unknown as Project;

const LEDGER = project({ id: 'ledger', name: 'ledger-core' });
const RELAY = project({ id: 'relay', name: 'notify-relay' });

type RenderParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly onSave?: () => void;
  readonly onCancel?: () => void;
};

const renderEditor = ({ projects, onSave = vi.fn(), onCancel = vi.fn() }: RenderParams) =>
  render(
    <ScriptEditor
      label="New script"
      name="Replay dead letters"
      body="pnpm --filter notify-relay exec node ./tools/replay.mjs"
      projects={projects}
      projectId={LEDGER.id}
      error={null}
      isSaving={false}
      onNameChange={vi.fn()}
      onBodyChange={vi.fn()}
      onProjectChange={vi.fn()}
      onSave={onSave}
      onCancel={onCancel}
    />,
  );

afterEach(cleanup);

describe('ScriptEditor', () => {
  it('names the only project instead of offering a select', () => {
    renderEditor({ projects: [LEDGER] });

    expect(screen.getByText('ledger-core')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Script project' })).toBeNull();
    expect(
      screen.getByText(
        'Saved scripts run in any branch of ledger-core, in every session of this workspace.',
      ),
    ).toBeDefined();
  });

  it('lets the project change when the workspace has more than one', () => {
    renderEditor({ projects: [LEDGER, RELAY] });

    expect(screen.getByRole('combobox', { name: 'Script project' })).toBeDefined();
  });

  it('saves with the modifier and Enter, and cancels with Escape', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderEditor({ projects: [LEDGER], onSave, onCancel });

    const body = screen.getByRole('textbox', { name: 'Script body' });
    fireEvent.keyDown(body, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(body, { key: 'Escape' });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
