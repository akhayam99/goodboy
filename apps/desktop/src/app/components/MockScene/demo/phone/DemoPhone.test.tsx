// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DemoPhone } from './DemoPhone';
import { DEMO_GROUPS } from '../demoGroups';
import { DEMO_LINKS } from '../demoLinks';
import { PHONE_LINKS } from './phoneLinks';
import { deviceNoun } from './deviceNoun';
import { shouldOpenDemoPhone } from './shouldOpenDemoPhone';

type PointerParams = {
  readonly isCoarse: boolean;
};

type DeferredCopy = {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: Error) => void;
};

const PHONE_QUERY = '(hover: none) and (pointer: coarse)';
const COPY_HELPER = 'Copy the link to open it on your Mac.';
const SHARE_HELPER = 'Share the link to open it on your Mac.';
const FAILED_STATUS = 'Copying did not work. Select the link to copy it yourself.';

const stubPointer = ({ isCoarse }: PointerParams) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === PHONE_QUERY ? isCoarse : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

type NavigatorParams = {
  readonly key: 'share' | 'clipboard';
  readonly value: unknown;
};

const setNavigator = ({ key, value }: NavigatorParams) => {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
};

const deferred = (): DeferredCopy => {
  const handlers: { resolve: () => void; reject: (error: Error) => void } = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<void>((resolve, reject) => {
    handlers.resolve = resolve;
    handlers.reject = reject;
  });
  return { promise, resolve: handlers.resolve, reject: handlers.reject };
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const status = (): string => screen.getByRole('status').textContent ?? '';

const pressHandoff = () => {
  fireEvent.click(screen.getByRole('button', { name: /Open on your Mac/ }));
};

beforeEach(() => {
  stubPointer({ isCoarse: true });
  window.history.replaceState(null, '', '/');
  setNavigator({ key: 'share', value: undefined });
  setNavigator({ key: 'clipboard', value: undefined });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('demo phone gate', () => {
  it('opens the phone page for the playground on a coarse pointer without hover', () => {
    expect(shouldOpenDemoPhone({ search: '', mode: 'demo' })).toBe(true);
    expect(shouldOpenDemoPhone({ search: '?scene=demo', mode: 'development' })).toBe(true);
  });

  it('keeps single scenes and mock dev on their own page', () => {
    expect(shouldOpenDemoPhone({ search: '?scene=chat-shell', mode: 'demo' })).toBe(false);
    expect(shouldOpenDemoPhone({ search: '', mode: 'development' })).toBe(false);
  });

  it('gives a fine pointer the real playground whatever the width', () => {
    stubPointer({ isCoarse: false });
    expect(shouldOpenDemoPhone({ search: '', mode: 'demo' })).toBe(false);
  });

  it('says computer only on a clearly Linux platform', () => {
    expect(deviceNoun({ userAgent: 'X11; Linux x86_64', platform: undefined })).toBe('computer');
    expect(deviceNoun({ userAgent: 'Linux; Android 14', platform: undefined })).toBe('Mac');
    expect(deviceNoun({ userAgent: 'iPhone', platform: undefined })).toBe('Mac');
    expect(deviceNoun({ userAgent: 'anything', platform: 'Linux' })).toBe('computer');
  });
});

describe('demo phone page', () => {
  it('renders the page without any app frame and stars the repository', () => {
    render(<DemoPhone />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Give your agents a structure to work in',
    );
    expect(document.querySelector('iframe')).toBeNull();
    const star = screen.getByRole('link', { name: /Star on GitHub/ });
    expect(star.getAttribute('href')).toBe(DEMO_LINKS.github);
    expect(star.getAttribute('href')).toBe('https://github.com/akhayam99/goodboy');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      Object.values(DEMO_GROUPS).map((group) => `${group.title}${group.line}`),
    );
  });

  it('shares the canonical demo link with the requested chapter', async () => {
    window.history.replaceState(null, '', '/?scene=demo&debug=1#review');
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    setNavigator({ key: 'share', value: share });
    setNavigator({ key: 'clipboard', value: { writeText } });
    render(<DemoPhone />);
    expect(status()).toBe(SHARE_HELPER);

    pressHandoff();
    await flush();

    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${PHONE_LINKS.demo}#review` }),
    );
    expect(writeText).not.toHaveBeenCalled();
    expect(status()).toBe('Link shared');
  });

  it('treats a cancelled share as nothing happened', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    const writeText = vi.fn(() => Promise.resolve());
    setNavigator({ key: 'share', value: share });
    setNavigator({ key: 'clipboard', value: { writeText } });
    render(<DemoPhone />);

    pressHandoff();
    await flush();

    expect(writeText).not.toHaveBeenCalled();
    expect(status()).toBe(SHARE_HELPER);
  });

  it('copies without the share sheet and confirms only once the copy resolved', async () => {
    const copy = deferred();
    const writeText = vi.fn(() => copy.promise);
    setNavigator({ key: 'clipboard', value: { writeText } });
    render(<DemoPhone />);
    expect(status()).toBe(COPY_HELPER);

    pressHandoff();
    await flush();
    expect(writeText).toHaveBeenCalledWith(PHONE_LINKS.demo);
    expect(status()).toBe(COPY_HELPER);

    copy.resolve();
    await flush();
    expect(status()).toBe('Link copied');
  });

  it('shows the link to select and Try again when the copy fails, and recovers on retry', async () => {
    const copy = deferred();
    const writeText = vi
      .fn()
      .mockReturnValueOnce(copy.promise)
      .mockReturnValueOnce(Promise.resolve());
    setNavigator({ key: 'clipboard', value: { writeText } });
    render(<DemoPhone />);

    pressHandoff();
    copy.reject(new Error('denied'));
    await flush();
    await flush();

    expect(status()).toBe(FAILED_STATUS);
    const link = screen.getByRole<HTMLInputElement>('textbox', { name: 'Demo link' });
    expect(link.value).toBe(PHONE_LINKS.demo);
    expect(link.readOnly).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await flush();

    expect(status()).toBe('Link copied');
    expect(screen.queryByRole('textbox', { name: 'Demo link' })).toBeNull();
  });

  it('keeps a cancelled share neutral even after a failure', async () => {
    const share = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error('blocked')))
      .mockImplementationOnce(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    setNavigator({ key: 'share', value: share });
    render(<DemoPhone />);

    pressHandoff();
    await flush();
    await flush();
    expect(status()).toBe(FAILED_STATUS);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await flush();
    await flush();

    expect(status()).toBe(SHARE_HELPER);
  });

  it('keeps only the latest answer when the visitor presses twice', async () => {
    const first = deferred();
    const second = deferred();
    const writeText = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    setNavigator({ key: 'clipboard', value: { writeText } });
    render(<DemoPhone />);

    pressHandoff();
    pressHandoff();
    second.reject(new Error('denied'));
    await flush();
    first.resolve();
    await flush();

    expect(status()).toBe(FAILED_STATUS);
  });
});
