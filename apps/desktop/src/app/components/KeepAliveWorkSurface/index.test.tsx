import { useEffect, useState, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const useSessionByIdSpy = vi.hoisted(() => vi.fn<() => Session | null>(() => null));
const sessionWorkspaceSpy = vi.hoisted(() => vi.fn<() => null>(() => null));
const tick = vi.hoisted(() => ({
  value: 0,
  listeners: new Set<() => void>(),
}));
const probe = vi.hoisted(() => ({ renders: 0, mounts: 0, cleanups: 0 }));

vi.mock('../../../store', () => ({
  useSessionById: useSessionByIdSpy,
}));

vi.mock('../../hooks/useGoToBoard', () => ({
  useGoToBoard: () => () => undefined,
}));

vi.mock('../../../features/session/components/SessionWorkspace', () => ({
  SessionWorkspace: () => {
    sessionWorkspaceSpy();
    const [draft, setDraft] = useState('');
    const value = useSyncExternalStore(
      (listener) => {
        tick.listeners.add(listener);
        return () => tick.listeners.delete(listener);
      },
      () => tick.value,
    );
    probe.renders += 1;
    useEffect(() => {
      probe.mounts += 1;
      return () => {
        probe.cleanups += 1;
      };
    }, []);
    return (
      <div>
        <input aria-label="Draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <span>{`tick ${value}`}</span>
      </div>
    );
  },
}));

import { KeepAliveWorkSurface } from './index';

const SESSION_ID = 'session-1' as SessionId;
const SESSION = { id: SESSION_ID } as Session;

const bump = () =>
  act(() => {
    tick.value += 1;
    tick.listeners.forEach((listener) => listener());
  });

beforeEach(() => {
  useSessionByIdSpy.mockReset();
  sessionWorkspaceSpy.mockClear();
  tick.value = 0;
  probe.renders = 0;
  probe.mounts = 0;
  probe.cleanups = 0;
});

afterEach(cleanup);

describe('KeepAliveWorkSurface', () => {
  it('renders nothing when the session is missing', () => {
    useSessionByIdSpy.mockReturnValue(null);
    const { container } = render(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive />);
    expect(container.firstChild).toBeNull();
    expect(sessionWorkspaceSpy).not.toHaveBeenCalled();
  });

  it('mounts the workspace visible when active', () => {
    useSessionByIdSpy.mockReturnValue(SESSION);
    const { container } = render(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive />);
    expect(container.firstElementChild?.getAttribute('style') ?? '').not.toContain('display: none');
    screen.getByLabelText('Draft');
  });

  it('keeps the workspace mounted but hidden when inactive', () => {
    useSessionByIdSpy.mockReturnValue(SESSION);
    const { container } = render(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive={false} />);
    expect(container.firstElementChild?.getAttribute('style') ?? '').toContain('display: none');
  });

  it('keeps a draft across a hide and a show and stops its effects while hidden', () => {
    useSessionByIdSpy.mockReturnValue(SESSION);
    const view = (isActive: boolean) => (
      <KeepAliveWorkSurface sessionId={SESSION_ID} isActive={isActive} />
    );
    const { rerender } = render(view(true));
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Reply to Harborline' } });
    expect(probe.mounts).toBe(1);

    rerender(view(false));
    expect(probe.cleanups).toBe(1);
    rerender(view(true));

    expect(screen.getByLabelText<HTMLInputElement>('Draft').value).toBe('Reply to Harborline');
    expect(probe.mounts).toBe(2);
  });

  it('does not render a hidden session on a store change and catches up when it shows', () => {
    useSessionByIdSpy.mockReturnValue(SESSION);
    const { rerender } = render(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive={false} />);
    const before = probe.renders;

    bump();
    bump();
    bump();

    expect(probe.renders).toBe(before);
    rerender(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive />);
    screen.getByText('tick 3');
  });
});
