// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

const { emit, listen } = vi.hoisted(() => ({
  emit: vi.fn(async (_name: string, _payload: unknown) => undefined),
  listen: vi.fn(
    async (_name: string, _handler: (event: { readonly payload: unknown }) => void) => () =>
      undefined,
  ),
}));

vi.mock('@tauri-apps/api/event', () => ({ emit, listen }));

import { announceDataChanged, listenDataChanged } from './index';

const sentOrigin = (): unknown => {
  const payload = emit.mock.calls.at(-1)?.[1];
  return typeof payload === 'object' && payload !== null
    ? Reflect.get(payload, 'origin')
    : undefined;
};

afterEach(() => {
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  emit.mockClear();
  listen.mockClear();
});

describe('announceDataChanged', () => {
  it('does nothing outside the desktop app', async () => {
    await announceDataChanged({ change: { kind: 'setting', key: 'repo.check.minutes' } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('sends the change with the origin of this window', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    await announceDataChanged({ change: { kind: 'setting', key: 'repo.check.minutes' } });
    expect(emit).toHaveBeenCalledWith('goodboy:data-changed', {
      kind: 'setting',
      key: 'repo.check.minutes',
      origin: sentOrigin(),
    });
  });

  it('hands a failed send back to the caller', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    emit.mockRejectedValueOnce(new Error('event bus is closed'));
    await expect(
      announceDataChanged({ change: { kind: 'setting', key: 'repo.check.minutes' } }),
    ).rejects.toThrow('event bus is closed');
  });
});

describe('listenDataChanged', () => {
  it('listens to nothing outside the desktop app', async () => {
    await listenDataChanged({ onChange: vi.fn() });
    expect(listen).not.toHaveBeenCalled();
  });

  it('passes on a change from another window and drops the echo of its own', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    await announceDataChanged({ change: { kind: 'setting', key: 'repo.check.minutes' } });
    const ownOrigin = sentOrigin();
    expect(typeof ownOrigin).toBe('string');
    const onChange = vi.fn();
    await listenDataChanged({ onChange });
    const handler = listen.mock.calls[0]?.[1];
    handler?.({ payload: { kind: 'setting', key: 'repo.check.minutes', origin: ownOrigin } });
    expect(onChange).not.toHaveBeenCalled();
    handler?.({ payload: { kind: 'setting', key: 'repo.check.minutes', origin: 'another' } });
    expect(onChange).toHaveBeenCalledWith({ kind: 'setting', key: 'repo.check.minutes' });
  });
});
