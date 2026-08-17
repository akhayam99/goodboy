// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
