// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import { LibraryCard } from './index';

afterEach(cleanup);

const NOW = '2026-08-17T00:00:00.000Z' as IsoDateTime;

const step = {
  id: 'step-1' as StepDefId,
  workspaceId: 'ws-1' as WorkspaceId,
  role: 'planner',
  name: 'Plan the change',
  promptPrefix: 'Write a plan',
  createdAt: NOW,
  updatedAt: NOW,
} satisfies StepDef;

describe('LibraryCard', () => {
  it('adds a library step without requiring drag and drop', () => {
    const onAdd = vi.fn();
    render(
      <ul>
        <LibraryCard
          def={step}
          dragDisabled={false}
          onStartDrag={vi.fn()}
          onAdd={onAdd}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Plan the change to workflow' }));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('deletes a step only after its anchored confirm, never starting a drag', async () => {
    const onDelete = vi.fn();
    const onStartDrag = vi.fn();
    render(
      <ul>
        <LibraryCard
          def={step}
          dragDisabled={false}
          onStartDrag={onStartDrag}
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Plan the change' }));
    expect(onDelete).not.toHaveBeenCalled();

    const confirm = screen.getByRole('dialog', { name: 'Delete Plan the change?' });
    const deleteButton = within(confirm).getByRole('button', { name: 'Delete step' });
    fireEvent.pointerDown(deleteButton);
    fireEvent.click(deleteButton);

    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(onStartDrag).not.toHaveBeenCalled();
  });

  it('restores the row actions when the delete confirm is cancelled', async () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <LibraryCard
          def={step}
          dragDisabled={false}
          onStartDrag={vi.fn()}
          onAdd={vi.fn()}
          onEdit={vi.fn()}
          onDelete={onDelete}
        />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Plan the change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete Plan the change' })).toBeDefined();
  });
});
