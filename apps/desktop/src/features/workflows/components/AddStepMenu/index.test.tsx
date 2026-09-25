// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import { savedStepGroups } from '../../savedSteps';
import { AddStepMenu } from '.';

const workspaceStep: StepDef = {
  id: 'lib-payout' as StepDefId,
  workspaceId: 'ws-1' as WorkspaceId,
  role: 'reviewer',
  name: 'Payout safety review',
  promptPrefix: 'Flag any change to a reconciled payout.',
  baseStepId: 'seed_reviewer' as StepDefId,
  createdAt: '2026-09-25T12:00:00.000Z' as StepDef['createdAt'],
  updatedAt: '2026-09-25T12:00:00.000Z' as StepDef['updatedAt'],
};

const renderMenu = (onPick = vi.fn()) => {
  render(
    <AddStepMenu
      groups={savedStepGroups({ defs: [workspaceStep] })}
      disabled={false}
      onPick={onPick}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
  return onPick;
};

const search = () => screen.getByRole('combobox', { name: 'Search steps' });

afterEach(cleanup);

describe('AddStepMenu', () => {
  it('offers a blank step, then the built-in steps, then this workspace', () => {
    renderMenu();
    const list = screen.getByRole('listbox', { name: 'Steps' });
    const options = within(list).getAllByRole('option');
    expect(options[0]?.textContent).toContain('Blank step');
    expect(options).toHaveLength(10);
    expect(within(list).getByText('Built in')).toBeDefined();
    expect(within(list).getByText('This workspace')).toBeDefined();
    expect(within(list).getByText(/Based on Review/)).toBeDefined();
  });

  it('adds a blank step on Enter when nothing is searched', () => {
    const onPick = renderMenu();
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('narrows the list as you search and picks the first match on Enter', () => {
    const onPick = renderMenu();
    fireEvent.change(search(), { target: { value: 'payout' } });
    const list = screen.getByRole('listbox', { name: 'Steps' });
    expect(within(list).getAllByRole('option')).toHaveLength(2);
    expect(within(list).queryByText('Built in')).toBeNull();
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'lib-payout' }));
  });

  it('moves through the options with the arrow keys', () => {
    const onPick = renderMenu();
    fireEvent.keyDown(search(), { key: 'ArrowDown' });
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'seed_scout' }));
  });

  it('says when no saved step matches', () => {
    renderMenu();
    fireEvent.change(search(), { target: { value: 'nothing like this' } });
    expect(screen.getByText('No saved steps match that search')).toBeDefined();
  });
});
