// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SCRIPT = readFileSync(
  join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'browser', 'passkey.js'),
  'utf8',
);

type CredentialCall = (options: unknown) => Promise<string>;

type Bridge = 'ready' | 'missing' | 'throwing';

type PageParams = {
  readonly bridge: Bridge;
  readonly isHandlerBroken?: boolean;
};

type BridgeParams = {
  readonly bridge: Bridge;
  readonly postMessage: unknown;
};

const windowOf = ({ bridge, postMessage }: BridgeParams): object => {
  if (bridge === 'ready') {
    return { webkit: { messageHandlers: { goodboyPasskey: { postMessage } } } };
  }
  if (bridge === 'throwing') {
    return Object.defineProperty({}, 'webkit', {
      get() {
        throw new Error('bridge-gone');
      },
    });
  }
  return {};
};

const page = ({ bridge, isHandlerBroken = false }: PageParams) => {
  const answer = Promise.resolve('credential');
  const get = vi.fn<CredentialCall>(() => answer);
  const create = vi.fn<CredentialCall>(() => answer);
  const postMessage = vi.fn();
  if (isHandlerBroken) {
    postMessage.mockImplementation(() => {
      throw new Error('handler-gone');
    });
  }
  const credentials = { get, create };
  const window = windowOf({ bridge, postMessage });
  runInNewContext(SCRIPT, { navigator: { credentials }, window, setTimeout });
  const attachHandler = () => {
    Object.assign(window, { webkit: { messageHandlers: { goodboyPasskey: { postMessage } } } });
  };
  return { credentials, get, create, postMessage, answer, attachHandler };
};

const PUBLIC_KEY = { publicKey: { challenge: new Uint8Array(32), rpId: 'cascadia.dev' } };

const THROWING_OPTIONS = Object.defineProperty({}, 'publicKey', {
  get() {
    throw new Error('options-gone');
  },
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the passkey watch script', () => {
  it('tells the host about a passkey sign-in and still runs the page request', () => {
    const tab = page({ bridge: 'ready' });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(tab.postMessage.mock.calls).toEqual([['get']]);
    expect(tab.get).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(result).toBe(tab.answer);
  });

  it('tells the host about a passkey being created', () => {
    const tab = page({ bridge: 'ready' });

    void tab.credentials.create(PUBLIC_KEY);

    expect(tab.postMessage.mock.calls).toEqual([['create']]);
    expect(tab.create).toHaveBeenCalledWith(PUBLIC_KEY);
  });

  it('stays quiet for a passkey offered quietly in an autofill list', () => {
    const tab = page({ bridge: 'ready' });

    void tab.credentials.get({ ...PUBLIC_KEY, mediation: 'conditional' });

    expect(tab.postMessage).not.toHaveBeenCalled();
    expect(tab.get).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a request that is not a passkey', () => {
    const tab = page({ bridge: 'ready' });

    void tab.credentials.get({ password: true });

    expect(tab.postMessage).not.toHaveBeenCalled();
    expect(tab.get).toHaveBeenCalledTimes(1);
  });

  it('runs the page request when no host listens', () => {
    const tab = page({ bridge: 'missing' });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(result).toBe(tab.answer);
  });

  it('tells a host whose handler arrives just after the request', () => {
    const tab = page({ bridge: 'missing' });

    void tab.credentials.get(PUBLIC_KEY);
    tab.attachHandler();
    vi.advanceTimersByTime(100);

    expect(tab.postMessage.mock.calls).toEqual([['get']]);
  });

  it('stops looking for a host that never arrives', () => {
    const tab = page({ bridge: 'missing' });

    void tab.credentials.get(PUBLIC_KEY);
    vi.advanceTimersByTime(5_000);
    tab.attachHandler();
    vi.advanceTimersByTime(5_000);

    expect(tab.postMessage).not.toHaveBeenCalled();
  });

  it('runs the page request when its options throw on read', () => {
    const tab = page({ bridge: 'ready' });

    const result = tab.credentials.get(THROWING_OPTIONS);

    expect(tab.postMessage).not.toHaveBeenCalled();
    expect(tab.get.mock.calls[0]?.[0]).toBe(THROWING_OPTIONS);
    expect(result).toBe(tab.answer);
  });

  it('runs the page request when the host bridge throws on read', () => {
    const tab = page({ bridge: 'throwing' });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(tab.get).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(result).toBe(tab.answer);
  });

  it('runs the page request when the host handler throws', () => {
    const tab = page({ bridge: 'ready', isHandlerBroken: true });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(tab.postMessage).toHaveBeenCalledTimes(1);
    expect(result).toBe(tab.answer);
  });
});
