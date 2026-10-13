// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, SessionDecision, SessionId } from '@goodboy/types';
import type { DecisionChangesSince } from '../../../../store/slices/contextDrawer/decisionChangesSince';
import { brandedId } from '../../../history/testing/brandedId';
import { DecisionChangesList } from './DecisionChangesList';

afterEach(cleanup);

type RowParams = {
  readonly number: number;
  readonly text: string;
};

const added = ({ number, text }: RowParams): SessionDecision => ({
  id: `decision-${number}`,
  sessionId: brandedId<SessionId>({ value: 'session-harborline' }),
  number,
  text,
  why: null,
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: null,
  turnOrdinal: null,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: brandedId<IsoDateTime>({ value: '2026-10-12T10:00:00.000Z' }),
  updatedAt: brandedId<IsoDateTime>({ value: '2026-10-12T10:00:00.000Z' }),
});

const changesOf = (rows: ReadonlyArray<SessionDecision>): DecisionChangesSince => ({
  added: rows,
  removed: [],
  reworded: [],
});

const opacityOf = (): boolean => {
  const heading = screen.getByText('Changed since you last looked');
  return heading.closest('.opacity-0') !== null;
};

describe('the changed-since list', () => {
  it('shows decisions that arrive while the read acknowledgement is pending', async () => {
    let finish: (isRead: boolean) => void = () => undefined;
    const onRead = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const first = changesOf([added({ number: 1, text: 'Use the ledger-core client' })]);
    const view = render(
      <DecisionChangesList changes={first} onJump={() => undefined} onRead={onRead} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));

    const next = changesOf([added({ number: 2, text: 'Retry notify-relay sends twice' })]);
    view.rerender(<DecisionChangesList changes={next} onJump={() => undefined} onRead={onRead} />);
    await act(async () => {
      finish(true);
    });

    expect(opacityOf()).toBe(false);
    expect(screen.getByRole('button', { name: 'Mark as read' }).hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.getByRole('button', { name: 'Added: decision 2' })).toBeDefined();
  });

  it('saves at the click, so leaving the tab during the fade keeps the read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
    const onRead = vi.fn(async (_params: { readonly readAt: string }) => true);
    const view = render(
      <DecisionChangesList
        changes={changesOf([added({ number: 1, text: 'Use the ledger-core client' })])}
        onJump={() => undefined}
        onRead={onRead}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    view.unmount();
    vi.useRealTimers();

    expect(onRead).toHaveBeenCalledTimes(1);
    expect(onRead).toHaveBeenCalledWith({ readAt: '2026-10-12T10:00:00.000Z' });
  });

  it('shows the list again when the acknowledgement fails', async () => {
    const onRead = vi.fn(async () => false);
    render(
      <DecisionChangesList
        changes={changesOf([added({ number: 1, text: 'Use the ledger-core client' })])}
        onJump={() => undefined}
        onRead={onRead}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));

    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(opacityOf()).toBe(false));
  });
});
