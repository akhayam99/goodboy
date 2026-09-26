// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BranchCombobox } from './BranchCombobox';

afterEach(cleanup);

const BRANCHES = [
  { name: 'main', inUse: false, hasUncommitted: false },
  { name: 'nw/fix-posting-rounding', inUse: true, hasUncommitted: true },
  { name: 'nw/retry-queue', inUse: false, hasUncommitted: false },
];

describe('BranchCombobox', () => {
  it('searches the local branches, leaves out the excluded ones and notes busy ones', () => {
    const onChange = vi.fn();
    render(
      <BranchCombobox
        branches={BRANCHES}
        value=""
        onChange={onChange}
        disabled={false}
        loading={false}
        excludeNames={['main']}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Branch' });
    expect(trigger.textContent).toBe('Choose a branch');
    fireEvent.click(trigger);

    expect(screen.queryByRole('option', { name: 'main' })).toBeNull();
    expect(screen.getByRole('option', { name: /fix-posting/ }).textContent).toContain(
      'in use · dirty',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Search branches' }), {
      target: { value: 'retry' },
    });
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search branches' }), {
      key: 'Enter',
    });

    expect(onChange).toHaveBeenCalledWith('nw/retry-queue');
  });

  it('stays closed with no local branch', () => {
    render(
      <BranchCombobox branches={[]} value="" onChange={vi.fn()} disabled={false} loading={false} />,
    );

    const trigger = screen.getByRole<HTMLButtonElement>('combobox', { name: 'Branch' });
    expect(trigger.disabled).toBe(true);
    expect(trigger.textContent).toBe('No local branches');
  });
});
