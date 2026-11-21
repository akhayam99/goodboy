// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SessionBudget, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  setSessionBudget: vi.fn(async () => undefined),
  clearSessionBudget: vi.fn(async () => undefined),
  setSessionAutoRun: vi.fn<() => Promise<undefined>>(async () => undefined),
  live: { isAutoRun: false },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      setSessionBudget: h.setSessionBudget,
      clearSessionBudget: h.clearSessionBudget,
      setSessionAutoRun: h.setSessionAutoRun,
      sessions: [{ id: 'session-1', autoRun: h.live.isAutoRun }],
    }),
}));

import { SpendLimitEditor } from './SpendLimitEditor';

const SESSION_ID = 'session-1' as SessionId;
const LIMIT = { softCapUsd: 20, onExceed: 'pause', warnRatio: 0.8 } as unknown as SessionBudget;

afterEach(() => {
  cleanup();
  h.setSessionBudget.mockClear();
  h.clearSessionBudget.mockClear();
  h.setSessionAutoRun.mockReset();
  h.setSessionAutoRun.mockImplementation(async () => undefined);
  h.live.isAutoRun = false;
});

describe('SpendLimitEditor', () => {
  it('ends with cancel and save inline, and saving still sets the limit', async () => {
    const onDone = vi.fn();
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);

    const save = screen.getByRole('button', { name: 'Save' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(save.closest('[data-slot="form-actions"]')).not.toBeNull();
    expect(cancel.parentElement).toBe(save.parentElement);

    fireEvent.click(save);
    await waitFor(() => expect(h.setSessionBudget).toHaveBeenCalledWith(SESSION_ID, 20, 'pause'));
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it('saves a session limit with cents typed into the field', async () => {
    const user = userEvent.setup();
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={vi.fn()} />);

    await user.clear(screen.getByLabelText('Limit in dollars'));
    await user.type(screen.getByLabelText('Limit in dollars'), '2.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.setSessionBudget).toHaveBeenCalledWith(SESSION_ID, 2.5, 'pause'));
  });

  it('holds the run setting: saving with the box ticked starts next steps without asking', async () => {
    const onDone = vi.fn();
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Start next steps without asking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.setSessionAutoRun).toHaveBeenCalledWith(SESSION_ID, true));
    expect(h.setSessionBudget).toHaveBeenCalledWith(SESSION_ID, 20, 'pause');
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it('leaves the run setting alone when the box did not change', async () => {
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.setSessionBudget).toHaveBeenCalled());
    expect(h.setSessionAutoRun).not.toHaveBeenCalled();
  });

  it('keeps a run setting another window changed while the form was open', async () => {
    const onDone = vi.fn();
    const { rerender } = render(
      <SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />,
    );

    h.live.isAutoRun = true;
    rerender(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);
    const box = screen.getByRole('checkbox', { name: 'Start next steps without asking' });
    expect(box).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(h.setSessionBudget).toHaveBeenCalledWith(SESSION_ID, 20, 'pause');
    expect(h.setSessionAutoRun).not.toHaveBeenCalled();
  });

  it('says the limit saved when only the run setting failed, and the retry sends only that', async () => {
    const onDone = vi.fn();
    h.setSessionAutoRun.mockRejectedValueOnce(new Error('database is locked'));
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Start next steps without asking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText(/Saved the limit, but couldn't change/);
    screen.getByText(/database is locked/);
    expect(onDone).not.toHaveBeenCalled();
    expect(h.setSessionBudget).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(h.setSessionBudget).toHaveBeenCalledOnce();
    expect(h.setSessionAutoRun).toHaveBeenCalledTimes(2);
    expect(h.setSessionAutoRun).toHaveBeenLastCalledWith(SESSION_ID, true);
  });

  it('cancels without touching the limit', () => {
    const onDone = vi.fn();
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(h.setSessionBudget).not.toHaveBeenCalled();
  });
});
