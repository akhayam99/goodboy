import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { LinearIssue } from '../../../integrations/linear/client';
import type { InboxRecord } from '../../types';

const h = vi.hoisted(() => ({ openUrl: vi.fn(async () => undefined) }));

vi.mock('../../../../shared/lib/editor', () => ({ openUrl: h.openUrl }));

const { InboxRow } = await import('./InboxRow');

const ISSUE: LinearIssue = {
  id: '1',
  identifier: 'ENG-42',
  title: 'Ship the inbox',
  description: null,
  url: '',
  state: { name: 'In Progress', type: 'started' },
  team: { key: 'ENG' },
  updatedAt: '',
};

const record: InboxRecord = {
  key: 'linear:issue:1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'ENG-42',
  title: 'Ship the inbox',
  state: 'active',
  updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  url: 'https://example.invalid/linear/ENG-42',
  stateLabel: 'In Progress',
  context: 'Cascadia',
  payload: { provider: 'linear', kind: 'issue', issue: ISSUE, sessionId: null },
};

afterEach(() => cleanup());

describe('InboxRow', () => {
  it('reads as one line: identifier, title, context, native state and age', () => {
    render(<InboxRow record={record} selected={false} onSelect={vi.fn()} />);

    expect(screen.getByText('ENG-42')).toBeDefined();
    expect(screen.getByText('Ship the inbox')).toBeDefined();
    expect(screen.getByText('Cascadia')).toBeDefined();
    expect(screen.getByText('In Progress')).toBeDefined();
    expect(screen.getByText('3h ago')).toBeDefined();
    expect(screen.queryByText('Linear')).toBeNull();
  });

  it('exposes the row as a selectable option', () => {
    render(<InboxRow record={record} selected onSelect={vi.fn()} />);

    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true');
  });

  it('reports the record when clicked', () => {
    const onSelect = vi.fn();
    render(<InboxRow record={record} selected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('option'));

    expect(onSelect).toHaveBeenCalledWith(record);
  });

  it('marks a record that already has a session with a leading dot', () => {
    const { unmount } = render(<InboxRow record={record} selected={false} onSelect={vi.fn()} />);
    expect(screen.queryByLabelText('Has a session')).toBeNull();
    unmount();

    render(
      <InboxRow
        record={{
          ...record,
          payload: {
            provider: 'linear',
            kind: 'issue',
            issue: ISSUE,
            sessionId: 'session-1' as SessionId,
          },
        }}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Has a session')).toBeDefined();
  });

  it('opens the record in its tool without selecting it', () => {
    const onSelect = vi.fn();
    render(<InboxRow record={record} selected={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByTitle('Open ENG-42 in Linear'));

    expect(h.openUrl).toHaveBeenCalledWith('https://example.invalid/linear/ENG-42');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
