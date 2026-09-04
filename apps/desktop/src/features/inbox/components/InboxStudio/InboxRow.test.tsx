import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InboxRecord } from '../../types';
import { InboxRow } from './InboxRow';

const record: InboxRecord = {
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'ENG-42',
  title: 'Ship the inbox',
  state: 'active',
  updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  url: '',
  meta: 'In Progress',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: '1',
      identifier: 'ENG-42',
      title: 'Ship the inbox',
      description: null,
      url: '',
      state: { name: 'In Progress', type: 'started' },
      team: { key: 'ENG' },
      updatedAt: '',
    },
    sessionId: null,
  },
};

afterEach(() => cleanup());

describe('InboxRow', () => {
  it('renders the identifier, title, age, provider, state and meta', () => {
    render(<InboxRow record={record} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('ENG-42')).toBeDefined();
    expect(screen.getByText('Ship the inbox')).toBeDefined();
    expect(screen.getByText('3h ago')).toBeDefined();
    expect(screen.getByText('Linear')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
  });

  it('exposes the row as a selectable option', () => {
    render(<InboxRow record={record} selected onSelect={vi.fn()} />);

    const option = screen.getByRole('option');

    expect(option.getAttribute('aria-selected')).toBe('true');
    expect(option.getAttribute('aria-current')).toBe('true');
  });

  it('reports the record when clicked', () => {
    const onSelect = vi.fn();
    render(<InboxRow record={record} selected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('option'));

    expect(onSelect).toHaveBeenCalledWith(record);
  });
});
