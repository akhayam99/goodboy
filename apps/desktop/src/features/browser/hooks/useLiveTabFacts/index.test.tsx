// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { listen } from '@tauri-apps/api/event';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { storySpies, stubStoryInvoke } from '../../../../store/storyHarness';
import type { BrowserTabFacts } from '../../types';
import { useLiveTabFacts } from './index';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

const CHECKOUT = nextSessionId();
const BILLING = nextSessionId();
const POLL_MS = 1500;

type FactsParams = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly state?: BrowserTabFacts['state'];
};
type ListArgs = { readonly args: { readonly sessionId: SessionId } };
type HookProps = {
  readonly sessionId: SessionId;
  readonly isWatching: boolean;
};

const factsOf = ({ id, sessionId, state = 'live' }: FactsParams): BrowserTabFacts => ({
  id,
  sessionId,
  url: `https://harborline.dev/${id}`,
  title: '',
  state,
  isShown: false,
  hiddenSinceMs: null,
  openerId: null,
  isPasskeyBlocked: false,
});

const listCalls = (): number =>
  storySpies.tauriInvoke.mock.calls.filter(([name]) => name === 'browser_tab_list').length;

const told = ({ facts }: { readonly facts: BrowserTabFacts }) => {
  const handler = vi
    .mocked(listen)
    .mock.calls.filter(([name]) => name === 'browser://tab-state')
    .map(([, callback]) => callback)
    .at(-1);
  if (handler === undefined) {
    throw new Error('Nothing listens to browser://tab-state.');
  }
  act(() => {
    handler({ event: 'browser://tab-state', id: 1, payload: facts });
  });
};

const mount = ({ sessionId, isWatching }: HookProps) => {
  const onPolled = vi.fn();
  const view = renderHook(
    (props: HookProps) => useLiveTabFacts({ ...props, onPolled, onError: () => undefined }),
    { initialProps: { sessionId, isWatching } },
  );
  return { ...view, onPolled };
};

beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} });
  vi.useFakeTimers();
  stubStoryInvoke({
    browser_tab_list: ({ args }: ListArgs) => [
      factsOf({ id: 'listed', sessionId: args.sessionId }),
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

describe('the live tab facts', () => {
  it('lists the tabs once on mount and never on a timer while the pane is parked', async () => {
    mount({ sessionId: CHECKOUT, isWatching: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(listCalls()).toBe(1);
  });

  it('lists the tabs on a timer while the pane is watched', async () => {
    mount({ sessionId: CHECKOUT, isWatching: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const before = listCalls();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    });

    expect(listCalls() - before).toBe(2);
  });

  it('stops the timer when the pane is parked again', async () => {
    const view = mount({ sessionId: CHECKOUT, isWatching: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    view.rerender({ sessionId: CHECKOUT, isWatching: false });
    const before = listCalls();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(listCalls()).toBe(before);
  });

  it('takes a tab-state event for the session without listing again', async () => {
    const view = mount({ sessionId: CHECKOUT, isWatching: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const before = listCalls();

    told({ facts: factsOf({ id: 'listed', sessionId: CHECKOUT, state: 'asleep' }) });

    expect(view.result.current.facts.map((fact) => fact.state)).toEqual(['asleep']);
    expect(listCalls()).toBe(before);
  });

  it('keeps the facts of its session when the event is for another one', async () => {
    const view = mount({ sessionId: CHECKOUT, isWatching: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    told({ facts: factsOf({ id: 'elsewhere', sessionId: BILLING }) });

    expect(view.result.current.facts.map((fact) => fact.id)).toEqual(['listed']);
    expect(view.onPolled).toHaveBeenCalledWith({
      facts: [factsOf({ id: 'elsewhere', sessionId: BILLING })],
    });
  });

  it('drops a late list that answers for the session the pane has left', async () => {
    let releaseCheckout: (facts: BrowserTabFacts[]) => void = () => undefined;
    const lateCheckout = new Promise<BrowserTabFacts[]>((resolve) => {
      releaseCheckout = resolve;
    });
    stubStoryInvoke({
      browser_tab_list: ({ args }: ListArgs) =>
        args.sessionId === CHECKOUT
          ? lateCheckout
          : [factsOf({ id: 'billing-tab', sessionId: BILLING })],
    });
    const view = mount({ sessionId: CHECKOUT, isWatching: false });
    view.rerender({ sessionId: BILLING, isWatching: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    await act(async () => {
      releaseCheckout([factsOf({ id: 'checkout-tab', sessionId: CHECKOUT })]);
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(view.result.current.facts.map((fact) => fact.id)).toEqual(['billing-tab']);
  });
});
