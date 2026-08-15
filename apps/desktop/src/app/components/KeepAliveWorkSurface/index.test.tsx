import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Session, SessionId } from '@goodboy/types';

const useSessionByIdSpy = vi.hoisted(() => vi.fn<() => Session | null>(() => null));
const sessionWorkspaceSpy = vi.hoisted(() =>
  vi.fn<(props: { readonly isActive: boolean }) => null>(() => null),
);

vi.mock('../../../store', () => ({
  useSessionById: useSessionByIdSpy,
}));

vi.mock('../../../features/session/components/SessionWorkspace', () => ({
  SessionWorkspace: sessionWorkspaceSpy,
}));

import { KeepAliveWorkSurface } from './index';

const SESSION_ID = 'session-1' as SessionId;
const SESSION = { id: SESSION_ID } as Session;

beforeEach(() => {
  useSessionByIdSpy.mockReset();
  sessionWorkspaceSpy.mockClear();
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
    const wrapper = container.firstElementChild;
    expect(wrapper?.hasAttribute('hidden')).toBe(false);
    expect(sessionWorkspaceSpy.mock.calls[0]?.[0]?.isActive).toBe(true);
  });

  it('keeps the workspace mounted but hidden when inactive', () => {
    useSessionByIdSpy.mockReturnValue(SESSION);
    const { container } = render(<KeepAliveWorkSurface sessionId={SESSION_ID} isActive={false} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.hasAttribute('hidden')).toBe(true);
    expect(sessionWorkspaceSpy.mock.calls[0]?.[0]?.isActive).toBe(false);
  });
});
