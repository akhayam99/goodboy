// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime } from '@goodboy/types';
import type { AgentQueuedTurn } from '../../../../../store/slices/agentQueue/types';

type RoutingLabelProps = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
};

const routingBadgeSpy = vi.hoisted(() => vi.fn(({}: RoutingLabelProps) => null));

vi.mock('../../../../../shared/components/RoutingLabel', () => ({
  RoutingLabel: routingBadgeSpy,
}));

import { QueuedMessages } from './QueuedMessages';

const item = (id: string, overrides: Partial<AgentQueuedTurn> = {}): AgentQueuedTurn =>
  ({
    id,
    agentId: 'agent-1',
    content: `message ${id}`,
    attachments: [],
    override: undefined,
    status: 'queued',
    createdAt: '2026-09-25T10:00:00.000Z' as IsoDateTime,
    ...overrides,
  }) as AgentQueuedTurn;

type Handlers = {
  readonly onEdit: ReturnType<typeof vi.fn>;
  readonly onRemove: ReturnType<typeof vi.fn>;
  readonly onSendNow: ReturnType<typeof vi.fn>;
};

const renderQueue = (items: ReadonlyArray<AgentQueuedTurn>): Handlers => {
  const handlers = { onEdit: vi.fn(), onRemove: vi.fn(), onSendNow: vi.fn() };
  render(<QueuedMessages items={items} canEdit {...handlers} />);
  return handlers;
};

beforeEach(() => {
  routingBadgeSpy.mockClear();
});

afterEach(cleanup);

describe('QueuedMessages', () => {
  it('renders each routing label from the queued item override', () => {
    renderQueue([
      item('turn-1', {
        override: {
          providerId: 'codex',
          model: 'gpt-5.6-terra',
          selection: { key: 'gpt-5.6-luna', effort: 'xhigh' },
        },
      }),
    ]);

    expect(routingBadgeSpy).toHaveBeenCalledOnce();
    expect(routingBadgeSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ provider: 'codex', model: 'gpt-5.6-terra', effort: 'xhigh' }),
    );
  });

  it('says a queued message waits for this turn and can be sent now', () => {
    const { onSendNow } = renderQueue([item('a'), item('b')]);

    expect(screen.getAllByText('Waits for this turn')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Send now' })[1]!);

    expect(onSendNow).toHaveBeenCalledWith('b');
  });

  it('shows a sending row that cannot be removed and blocks a second Send now', () => {
    const { onRemove } = renderQueue([item('a', { status: 'sending' }), item('b')]);

    expect(screen.getByText('Sending now')).toBeTruthy();
    const rows = screen.getAllByTestId('queued-message-row');
    expect(rows[0]?.getAttribute('data-status')).toBe('sending');
    const removeButtons = screen.getAllByRole('button', { name: 'Remove from queue' });
    expect(removeButtons[0]?.hasAttribute('disabled')).toBe(true);
    fireEvent.click(removeButtons[0]!);
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send now' }).hasAttribute('disabled')).toBe(true);
  });

  it('opens a queued message for editing on click', () => {
    const { onEdit } = renderQueue([item('a')]);

    fireEvent.click(screen.getByText('message a'));

    expect(onEdit).toHaveBeenCalledWith('a');
  });
});
