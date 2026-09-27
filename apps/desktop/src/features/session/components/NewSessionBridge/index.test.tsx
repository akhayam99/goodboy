// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    startBlankSession: vi.fn(async () => null),
    reportError: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { NewSessionBridge } from './index';

beforeEach(() => {
  state.startBlankSession.mockReset();
  state.startBlankSession.mockImplementation(async () => null);
  state.reportError.mockClear();
});
afterEach(cleanup);

const requestNewSession = () => fireEvent(window, new CustomEvent('goodboy:new-session'));

describe('NewSessionBridge', () => {
  it('starts a blank session, with nothing asked first', () => {
    render(<NewSessionBridge />);
    requestNewSession();
    expect(state.startBlankSession).toHaveBeenCalledTimes(1);
  });

  it('ignores a second request while the first one is still creating', async () => {
    let finish: () => void = () => undefined;
    state.startBlankSession.mockImplementation(
      () =>
        new Promise<null>((resolve) => {
          finish = () => resolve(null);
        }),
    );
    render(<NewSessionBridge />);
    requestNewSession();
    requestNewSession();
    expect(state.startBlankSession).toHaveBeenCalledTimes(1);
    finish();
    await waitFor(() => {
      requestNewSession();
      expect(state.startBlankSession).toHaveBeenCalledTimes(2);
    });
  });

  it('reports a failed create', async () => {
    state.startBlankSession.mockImplementation(async () => {
      throw new Error('disk full');
    });
    render(<NewSessionBridge />);
    requestNewSession();
    await waitFor(() =>
      expect(state.reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't create the session" }),
      ),
    );
  });

  it('stops listening once unmounted', () => {
    const { unmount } = render(<NewSessionBridge />);
    unmount();
    requestNewSession();
    expect(state.startBlankSession).not.toHaveBeenCalled();
  });
});
