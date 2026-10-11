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
    status: 'In progress',
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

type RenderParams = {
  readonly items?: ReadonlyArray<LinkWorkItem>;
  readonly linkedKeys?: ReadonlySet<string>;
  readonly starredKeys?: ReadonlySet<string>;
};

const renderPicker = ({
  items = ITEMS,
  linkedKeys = new Set(),
  starredKeys = new Set(),
}: RenderParams = {}) => {
  const linked: Array<Linked> = [];
  const starred: Array<LaunchExternalTask> = [];
  render(
    <LinkWorkPicker
      query=""
      onQueryChange={vi.fn()}
      items={items}
      lookedUp={[]}
      linkedKeys={linkedKeys}
      starredKeys={starredKeys}
      sources={['linear']}
      isLoading={false}
      isLinking={false}
      error={null}
      onLink={(task, choice) => linked.push({ task, choice })}
      onStar={(task) => starred.push(task)}
      onClose={vi.fn()}
    />,
  );
  return { linked, starred };
};

const preview = () => within(screen.getByLabelText('Link preview'));

afterEach(cleanup);

describe('LinkWorkPicker', () => {
  it('links to the session and says it will close the task when merged', () => {
    const { linked } = renderPicker();

    expect(preview().getByText('not on a branch yet').tagName).toBe('SPAN');
    expect(preview().getByText(/Will close HAR-212 when merged/).tagName).toBe('P');

    fireEvent.click(preview().getByRole('button', { name: 'Link HAR-212' }));

    expect(linked).toEqual([{ task: ITEMS[0]?.task, choice: { relation: 'closes' } }]);
  });

  it('keeps the session task open on Don’t close', () => {
    const { linked } = renderPicker();

    fireEvent.click(preview().getByRole('button', { name: 'Don’t close' }));
    expect(preview().getByText(/Part of HAR-212\. It stays open when merged\./).tagName).toBe('P');
    fireEvent.click(preview().getByRole('button', { name: 'Link HAR-212' }));

    expect(linked.map((entry) => entry.choice)).toEqual([{ relation: 'part-of' }]);
  });

  it('has no scope tabs and no Whole workspace choice', () => {
    renderPicker();

    expect(screen.queryByRole('tablist', { name: 'Link scope' })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Whole workspace/ })).toBeNull();
    expect(screen.queryByText(/Ongoing/)).toBeNull();
  });

  it('stars a tracker issue for the workspace without linking it', () => {
    const { linked, starred } = renderPicker();
    fireEvent.mouseMove(screen.getByRole('option', { name: /Payments revamp/ }));

    fireEvent.click(preview().getByRole('button', { name: 'Star it' }));

    expect(starred).toEqual([ITEMS[1]?.task]);
    expect(linked).toEqual([]);
  });

  it('shows an already starred issue as Starred and cannot star it again', () => {
    const { starred } = renderPicker({ starredKeys: new Set(['linear:lin-212']) });

    const button = preview().getByRole('button', { name: 'Starred' });
    fireEvent.click(button);

    expect(button.hasAttribute('disabled')).toBe(true);
    expect(starred).toEqual([]);
  });

  it('offers no star on a pull request', () => {
    renderPicker({
      items: [
        {
          key: 'github:42',
          status: 'Open',
          updatedAt: '2026-10-02T09:00:00.000Z',
          task: {
            provider: 'github',
            externalId: '42',
            identifier: 'northwind/ledger-core#42',
            url: 'https://github.com/northwind/ledger-core/pull/42',
            title: 'Retry webhook delivery',
          },
        },
      ],
    });

    expect(preview().queryByRole('button', { name: 'Star it' })).toBeNull();
    expect(preview().getByRole('button', { name: /^Link / })).toBeDefined();
  });

  it('flags a task already linked to the session and will not link it twice', () => {
    const { linked } = renderPicker({ linkedKeys: new Set(['linear:lin-212']) });

    expect(preview().getByText('Linked to this session already.')).toBeDefined();
    fireEvent.click(preview().getByRole('button', { name: 'Link HAR-212' }));

    expect(linked).toEqual([]);
  });
});
