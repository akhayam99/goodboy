// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SessionBudget, SessionId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  setSessionBudget: vi.fn(async () => undefined),
  clearSessionBudget: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: unknown) => T) =>
    selector({
      setSessionBudget: h.setSessionBudget,
      clearSessionBudget: h.clearSessionBudget,
    }),
}));

import { SpendLimitEditor } from './SpendLimitEditor';

const SESSION_ID = 'session-1' as SessionId;
const LIMIT = { softCapUsd: 20, onExceed: 'pause' } as unknown as SessionBudget;

afterEach(() => {
  cleanup();
  h.setSessionBudget.mockClear();
  h.clearSessionBudget.mockClear();
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

  it('cancels without touching the limit', () => {
    const onDone = vi.fn();
    render(<SpendLimitEditor sessionId={SESSION_ID} limit={LIMIT} onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(h.setSessionBudget).not.toHaveBeenCalled();
  });
});
