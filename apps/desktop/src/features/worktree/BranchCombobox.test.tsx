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

  it('offers teammates branches with author and pull request, searchable by both', () => {
    const onChange = vi.fn();
    render(
      <BranchCombobox
        branches={[
          { name: 'ak/own-work', inUse: false, hasUncommitted: false, source: 'local' },
          {
            name: 'grw-1348-cta-for-the-slot',
            inUse: false,
            hasUncommitted: false,
            source: 'pr',
            author: 'pat-harborline',
            prNumber: 9900,
            isDraft: false,
            title: 'Skip the slot step',
          },
          {
            name: 'old-experiment',
            inUse: false,
            hasUncommitted: false,
            source: 'remote',
            author: 'Sam Northwind',
            prNumber: null,
            isDraft: false,
            title: null,
          },
        ]}
        value=""
        onChange={onChange}
        disabled={false}
        loading={false}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Branch' }));

    expect(screen.getByRole('option', { name: /grw-1348/ }).textContent).toContain(
      'PR #9900 · pat-harborline',
    );
    expect(screen.getByRole('option', { name: /old-experiment/ }).textContent).toContain(
      'Sam Northwind',
    );
    screen.getByText('On this Mac');
    screen.getByText('Open pull requests');
    screen.getByText('On origin');

    const search = screen.getByRole('combobox', { name: 'Search branches' });
    fireEvent.change(search, { target: { value: '9900' } });
    expect(screen.queryByRole('option', { name: /old-experiment/ })).toBeNull();
    fireEvent.change(search, { target: { value: 'northwind' } });
    expect(screen.queryByRole('option', { name: /grw-1348/ })).toBeNull();
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('old-experiment');
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
