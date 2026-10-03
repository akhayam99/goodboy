// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { LaunchExternalTask } from '../../../inbox/launchSpecFor';
import type { LinkChoice } from './linkScope';
import { LinkWorkPicker } from './LinkWorkPicker';
import type { LinkWorkItem } from './linkWorkRows';

const ITEMS: ReadonlyArray<LinkWorkItem> = [
  {
    key: 'linear:lin-212',
    status: 'In progress',
    updatedAt: '2026-10-02T09:00:00.000Z',
    task: {
      provider: 'linear',
      externalId: 'lin-212',
      identifier: 'HAR-212',
      url: 'https://linear.app/harborline/issue/HAR-212',
      title: 'Duplicate credit on webhook redelivery',
    },
  },
  {
    key: 'linear:lin-400',
    status: 'Ongoing',
    updatedAt: '2026-10-01T09:00:00.000Z',
    task: {
      provider: 'linear',
      externalId: 'lin-400',
      identifier: 'HBL-400',
      url: 'https://linear.app/harborline/issue/HBL-400',
      title: 'Payments revamp',
    },
  },
];

type Linked = { readonly task: LaunchExternalTask; readonly choice: LinkChoice };

const renderPicker = ({ branch = 'hl/fix-duplicate-credit' }: { branch?: string | null } = {}) => {
  const linked: Array<Linked> = [];
  render(
    <LinkWorkPicker
      query=""
      onQueryChange={vi.fn()}
      items={ITEMS}
      lookedUp={[]}
      linkedKeys={new Set()}
      sources={['linear']}
      isLoading={false}
      isLinking={false}
      error={null}
      branch={branch}
      onLink={(task, choice) => linked.push({ task, choice })}
      onClose={vi.fn()}
    />,
  );
  return linked;
};

const scope = () => within(screen.getByRole('tablist', { name: 'Link scope' }));

const preview = () => within(screen.getByLabelText('Link preview'));

afterEach(cleanup);

describe('LinkWorkPicker scope', () => {
  it('links to the session by default and says it will close the task when merged', () => {
    const linked = renderPicker();

    expect(
      scope()
        .getByRole('tab', { name: /This session/ })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(preview().getByText('on this session').tagName).toBe('SPAN');
    expect(preview().getByText(/Will close HAR-212 when merged/).tagName).toBe('P');

    fireEvent.click(preview().getByRole('button', { name: 'Link HAR-212' }));

    expect(linked).toEqual([
      { task: ITEMS[0]?.task, choice: { scope: 'session', relation: 'closes' } },
    ]);
  });

  it('links to the branch, named in the segment, and keeps it open on Don’t close', () => {
    const linked = renderPicker();

    fireEvent.click(scope().getByRole('tab', { name: /This branch/ }));
    expect(scope().getByRole('tab', { name: /This branch/ }).textContent).toContain(
      'fix-duplicate-credit',
    );
    expect(preview().getByText('on hl/fix-duplicate-credit').tagName).toBe('SPAN');
    expect(preview().getByLabelText('Branch task').tagName.toLowerCase()).toBe('svg');

    fireEvent.click(preview().getByRole('button', { name: 'Don’t close' }));
    expect(preview().getByText(/Part of HAR-212\. It stays open when merged\./).tagName).toBe('P');
    fireEvent.click(preview().getByRole('button', { name: 'Link HAR-212' }));

    expect(linked.map((entry) => entry.choice)).toEqual([{ scope: 'branch', relation: 'part-of' }]);
  });

  it('puts a task on the whole workspace without ever closing it', () => {
    const linked = renderPicker();
    fireEvent.mouseMove(screen.getByRole('option', { name: /Payments revamp/ }));

    fireEvent.click(scope().getByRole('tab', { name: /Whole workspace/ }));

    expect(preview().getByText('on the Board').tagName).toBe('SPAN');
    expect(
      preview().getByText('Stays open. Shows under Ongoing on the Board, not on this session.')
        .tagName,
    ).toBe('P');
    expect(preview().queryByRole('button', { name: 'Don’t close' })).toBeNull();
    fireEvent.click(preview().getByRole('button', { name: 'Link HBL-400' }));

    expect(linked).toEqual([
      { task: ITEMS[1]?.task, choice: { scope: 'workspace', relation: 'part-of' } },
    ]);
  });

  it('turns the closing back on when the scope changes', () => {
    renderPicker();
    fireEvent.click(preview().getByRole('button', { name: 'Don’t close' }));

    fireEvent.click(scope().getByRole('tab', { name: /This branch/ }));

    expect(preview().getByText(/Will close HAR-212 when merged/).tagName).toBe('P');
  });

  it('cannot link to a branch while the session has none', () => {
    renderPicker({ branch: null });

    expect(scope().getByRole('tab', { name: /This branch/ })).toHaveProperty('disabled', true);
  });
});
