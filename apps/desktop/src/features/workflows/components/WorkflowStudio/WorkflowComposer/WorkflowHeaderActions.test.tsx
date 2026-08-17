// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowHeaderActions } from './WorkflowHeaderActions';

afterEach(cleanup);

type Params = { readonly isNew?: boolean };

const renderActions = ({ isNew = false }: Params = {}) => {
  const onReset = vi.fn();
  const onDelete = vi.fn();
  render(
    <WorkflowHeaderActions
      isNew={isNew}
      saving={false}
      generating={false}
      canGenerate={true}
      onDuplicate={vi.fn()}
      onDelete={onDelete}
      onGenerate={vi.fn()}
      onReset={onReset}
      onBack={vi.fn()}
    />,
  );
  return { onReset, onDelete };
};

describe('WorkflowHeaderActions', () => {
  it('clears the reset confirmation once confirmed', () => {
    const { onReset } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    const confirmGroup = screen.getByRole('group', { name: 'Discard local changes?' });
    fireEvent.click(within(confirmGroup).getByRole('button', { name: 'Reset' }));

    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: 'Discard local changes?' })).toBeNull();
  });

  it('clears the delete confirmation once confirmed', () => {
    const { onDelete } = renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirmGroup = screen.getByRole('group', { name: 'Delete this workflow?' });
    fireEvent.click(within(confirmGroup).getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledOnce();
    expect(screen.queryByRole('group', { name: 'Delete this workflow?' })).toBeNull();
  });
});
