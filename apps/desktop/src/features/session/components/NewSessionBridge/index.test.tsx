// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    openSessionDraft: vi.fn(),
    createSession: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { NewSessionBridge } from './index';

beforeEach(() => {
  state.openSessionDraft.mockClear();
  state.createSession.mockClear();
});
afterEach(cleanup);

const requestNewSession = () => fireEvent(window, new CustomEvent('goodboy:new-session'));

describe('NewSessionBridge', () => {
  it('opens the draft and creates no session', () => {
    render(<NewSessionBridge />);
    requestNewSession();
    expect(state.openSessionDraft).toHaveBeenCalledTimes(1);
    expect(state.createSession).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<NewSessionBridge />);
    unmount();
    requestNewSession();
    expect(state.openSessionDraft).not.toHaveBeenCalled();
  });
});
