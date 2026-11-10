// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { runInNewContext } from 'vm';
import { describe, expect, it, vi } from 'vitest';

const SCRIPT = readFileSync(
  join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'browser', 'passkey.js'),
  'utf8',
);

type CredentialCall = (options: unknown) => Promise<string>;

type PageParams = {
  readonly hasHandler: boolean;
  readonly isHandlerBroken?: boolean;
};

const page = ({ hasHandler, isHandlerBroken = false }: PageParams) => {
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
  const window = hasHandler
    ? { webkit: { messageHandlers: { goodboyPasskey: { postMessage } } } }
    : {};
  runInNewContext(SCRIPT, { navigator: { credentials }, window });
  return { credentials, get, create, postMessage, answer };
};

const PUBLIC_KEY = { publicKey: { challenge: new Uint8Array(32), rpId: 'cascadia.dev' } };

describe('the passkey watch script', () => {
  it('tells the host about a passkey sign-in and still runs the page request', () => {
    const tab = page({ hasHandler: true });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(tab.postMessage.mock.calls).toEqual([['get']]);
    expect(tab.get).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(result).toBe(tab.answer);
  });

  it('tells the host about a passkey being created', () => {
    const tab = page({ hasHandler: true });

    void tab.credentials.create(PUBLIC_KEY);

    expect(tab.postMessage.mock.calls).toEqual([['create']]);
    expect(tab.create).toHaveBeenCalledWith(PUBLIC_KEY);
  });

  it('stays quiet for a passkey offered quietly in an autofill list', () => {
    const tab = page({ hasHandler: true });

    void tab.credentials.get({ ...PUBLIC_KEY, mediation: 'conditional' });

    expect(tab.postMessage).not.toHaveBeenCalled();
    expect(tab.get).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a request that is not a passkey', () => {
    const tab = page({ hasHandler: true });

    void tab.credentials.get({ password: true });

    expect(tab.postMessage).not.toHaveBeenCalled();
    expect(tab.get).toHaveBeenCalledTimes(1);
  });

  it('runs the page request when no host listens', () => {
    const tab = page({ hasHandler: false });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(result).toBe(tab.answer);
  });

  it('runs the page request when the host handler throws', () => {
    const tab = page({ hasHandler: true, isHandlerBroken: true });

    const result = tab.credentials.get(PUBLIC_KEY);

    expect(tab.postMessage).toHaveBeenCalledTimes(1);
    expect(result).toBe(tab.answer);
  });
});
