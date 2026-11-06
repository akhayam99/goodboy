// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { QueuedRow } from '../queuedRowsOf';

type RoutingLabelProps = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
};

const routingBadgeSpy = vi.hoisted(() => vi.fn(({}: RoutingLabelProps) => null));

vi.mock('../../../../../shared/components/RoutingLabel', () => ({
  RoutingLabel: routingBadgeSpy,
}));

vi.mock('../../../../attachments/AttachmentStrip', () => ({
  AttachmentStrip: ({ items, size }: { items: ReadonlyArray<unknown>; size?: string }) => (
    <div data-testid="strip" data-size={size} data-count={items.length} />
  ),
}));

import { QueuedMessages } from './QueuedMessages';

const row = (id: string, overrides: Partial<QueuedRow> = {}): QueuedRow => ({
  id,
  source: 'agent',
  content: `message ${id}`,
  images: [],
  imageCount: 0,
  override: undefined,
  status: 'queued',
  statusText: 'Waits for this turn',
  reason: null,
  action: 'sendNow',
  ...overrides,
});

const autoRow = (id: string, overrides: Partial<QueuedRow> = {}): QueuedRow =>
  row(id, {
    source: 'auto',
    status: 'waits',
    statusText: 'Waits for the ledger export',
    action: 'sendNow',
    ...overrides,
  });

type Handlers = {
  readonly onEdit: ReturnType<typeof vi.fn>;
  readonly onRemove: ReturnType<typeof vi.fn>;
  readonly onSendNow: ReturnType<typeof vi.fn>;
  readonly onRetry: ReturnType<typeof vi.fn>;
  readonly onRaiseLimit: ReturnType<typeof vi.fn>;
};

const renderQueue = (items: ReadonlyArray<QueuedRow>): Handlers => {
  const handlers = {
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onSendNow: vi.fn(),
    onRetry: vi.fn(),
    onRaiseLimit: vi.fn(),
  };
  render(<QueuedMessages items={items} canEdit {...handlers} />);
  return handlers;
};

beforeEach(() => {
  routingBadgeSpy.mockClear();
});

afterEach(cleanup);

describe('QueuedMessages', () => {
  it('says a Retry denies the open ask, the same words as the box', () => {
    const handlers = {
      onEdit: vi.fn(),
      onRemove: vi.fn(),
      onSendNow: vi.fn(),
      onRetry: vi.fn(),
    };
    render(
      <QueuedMessages
        items={[row('outbox-1', { status: 'notDelivered', action: 'retry' })]}
        canEdit
        retryLabel="Send and deny"
        {...handlers}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send and deny' }));

    expect(handlers.onRetry).toHaveBeenCalledWith('outbox-1');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('renders each routing label from the queued item override', () => {
    renderQueue([
      row('turn-1', {
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
    const { onSendNow } = renderQueue([row('a'), row('b')]);

    expect(screen.getAllByText('Waits for this turn')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Send now' })[1]!);

    expect(onSendNow).toHaveBeenCalledWith('b');
  });

  it('shows a sending row that cannot be removed and blocks a second Send now', () => {
    const { onRemove } = renderQueue([
      row('a', { status: 'sending', statusText: 'Sending now' }),
      row('b'),
    ]);

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
    const { onEdit } = renderQueue([row('a')]);

    fireEvent.click(screen.getByText('message a'));

    expect(onEdit).toHaveBeenCalledWith('a');
  });

  it('draws an Auto row like a tray row, one line with the task it waits for', () => {
    const { onSendNow, onRemove, onEdit } = renderQueue([autoRow('outbox-1'), row('b')]);

    const rows = screen.getAllByTestId('queued-message-row');
    expect(rows.map((item) => item.getAttribute('data-source'))).toEqual(['auto', 'agent']);
    screen.getByText('Waits for the ledger export');
    fireEvent.click(screen.getAllByRole('button', { name: 'Send now' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove from queue' })[0]!);
    fireEvent.click(screen.getByText('message outbox-1'));

    expect(onSendNow).toHaveBeenCalledWith('outbox-1');
    expect(onRemove).toHaveBeenCalledWith('outbox-1');
    expect(onEdit).toHaveBeenCalledWith('outbox-1');
  });

  it('says Not delivered in one word and keeps the reason for the tooltip', () => {
    const { onRetry } = renderQueue([
      autoRow('outbox-1', {
        status: 'notDelivered',
        statusText: 'Not delivered',
        reason: 'The checks crashed.',
        action: 'retry',
      }),
    ]);

    screen.getByText('Not delivered');
    expect(screen.queryByText('The checks crashed.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledWith('outbox-1');
  });

  it('offers Change limit for a message the budget held back', () => {
    const { onRaiseLimit } = renderQueue([
      autoRow('outbox-1', {
        status: 'notDelivered',
        statusText: 'Not delivered',
        reason: 'The budget is used up.',
        action: 'raiseLimit',
      }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Change limit' }));

    expect(onRaiseLimit).toHaveBeenCalledWith('outbox-1');
  });

  it('offers no action for a stopped tree', () => {
    renderQueue([
      autoRow('outbox-1', {
        status: 'notDelivered',
        statusText: 'Not delivered',
        reason: 'Auto was stopped.',
        action: null,
      }),
    ]);

    expect(screen.queryByRole('button', { name: 'Send now' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('shows the compact thumbs of the images on both sources instead of a count', () => {
    const image = {
      id: 'image-1',
      fileName: 'sketch.png',
      mimeType: 'image/png',
      kind: 'image' as const,
      relPath: '.goodboy/attachments/sketch.png',
      workingDir: null,
    };
    renderQueue([
      autoRow('outbox-1', { images: [image, { ...image, id: 'image-2' }], imageCount: 2 }),
      row('b', { images: [image], imageCount: 1 }),
      row('c'),
    ]);

    const strips = screen.getAllByTestId('strip');
    expect(strips.map((strip) => strip.getAttribute('data-count'))).toEqual(['2', '1']);
    expect(strips.every((strip) => strip.getAttribute('data-size') === 'compact')).toBe(true);
  });

  it('shows a failure under the list', () => {
    render(
      <QueuedMessages
        items={[autoRow('outbox-1')]}
        canEdit
        failure={{ title: "Couldn't take the message back", message: 'Auto is busy.' }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onSendNow={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Auto is busy.');
  });
});
