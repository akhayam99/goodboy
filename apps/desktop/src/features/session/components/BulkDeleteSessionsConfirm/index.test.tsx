// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    bulkDeleteTask: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { BulkDeleteSessionsConfirm } from './index';

const WS_ID = 'ws-1' as WorkspaceId;

function makeSession(id: string, goal: string): Session {
  return {
    id: id as SessionId,
    workspaceId: WS_ID,
    goal,
    state: { kind: 'idle', lastActivityAt: '2026-05-28T00:00:00.000Z' },
    workflowRuns: [],
  } as unknown as Session;
}

function renderConfirm(overrides: Partial<Parameters<typeof BulkDeleteSessionsConfirm>[0]> = {}) {
  const props = {
    sessions: [makeSession('s-1', 'alpha'), makeSession('s-2', 'beta')],
    onClose: vi.fn(),
    onConfirmed: vi.fn(),
    ...overrides,
  };
  render(<BulkDeleteSessionsConfirm {...props} />);
  return props;
}

beforeEach(() => {
  state.bulkDeleteTask.mockReset();
  state.bulkDeleteTask.mockResolvedValue(undefined);
});

afterEach(cleanup);

describe('BulkDeleteSessionsConfirm', () => {
  it('titles with the count and lists every session goal plus the undo warning', () => {
    renderConfirm();
    const panel = screen.getByRole('group', { name: 'Delete 2 sessions?' });
    expect(within(panel).getByText(/Delete 2 sessions\?/)).toBeDefined();
    expect(within(panel).getByText('alpha')).toBeDefined();
    expect(within(panel).getByText('beta')).toBeDefined();
    expect(within(panel).getByText(/This cannot be undone/i)).toBeDefined();
  });

  it('confirms by calling bulkDeleteTask with the ids, then onConfirmed and onClose', async () => {
    const props = renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/ }));
    await waitFor(() => expect(state.bulkDeleteTask).toHaveBeenCalledWith(['s-1', 's-2']));
    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledTimes(1));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('cancels by calling onClose without deleting', () => {
    const props = renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/ }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(state.bulkDeleteTask).not.toHaveBeenCalled();
  });

  it('disables both controls while the delete is in flight', async () => {
    let release: () => void = () => undefined;
    state.bulkDeleteTask.mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          release = () => resolve(undefined);
        }),
    );
    renderConfirm();
    const confirm = screen.getByRole('button', { name: /^Delete \(2\)$/ }) as HTMLButtonElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm.disabled).toBe(true));
    expect((screen.getByRole('button', { name: /^Cancel$/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    release();
    await waitFor(() => expect(confirm.disabled).toBe(false));
  });

  it('surfaces an Error message and keeps the confirmation open when the delete throws', async () => {
    state.bulkDeleteTask.mockRejectedValue(new Error('worktree locked'));
    const props = renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/ }));
    await waitFor(() => expect(screen.getByText('worktree locked')).toBeDefined());
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onConfirmed).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: /^Delete \(2\)$/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
  });

  it('unwraps a thrown plain object with a message property', async () => {
    state.bulkDeleteTask.mockRejectedValue({ message: 'object failure' });
    renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/ }));
    await waitFor(() => expect(screen.getByText('object failure')).toBeDefined());
  });

  it('stringifies a thrown primitive that has no message', async () => {
    state.bulkDeleteTask.mockRejectedValue('boom');
    renderConfirm();
    fireEvent.click(screen.getByRole('button', { name: /^Delete \(2\)$/ }));
    await waitFor(() => expect(screen.getByText('boom')).toBeDefined());
  });

  it('handles a single-session delete count of one', () => {
    renderConfirm({ sessions: [makeSession('s-1', 'solo')] });
    const panel = screen.getByRole('group', { name: 'Delete 1 sessions?' });
    expect(within(panel).getByRole('button', { name: /^Delete \(1\)$/ })).toBeDefined();
  });
});
