// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';

const { emit, listen } = vi.hoisted(() => ({
  emit: vi.fn(async (_name: string, _payload: unknown) => undefined),
  listen: vi.fn(
    async (_name: string, _handler: (event: { readonly payload: unknown }) => void) => () =>
      undefined,
  ),
}));

vi.mock('@tauri-apps/api/event', () => ({ emit, listen }));

import { announceAttention, listenAttention, type AttentionReport } from './index';

const REPORT: AttentionReport = {
  workspaceId: brandId<WorkspaceId>({ value: 'ws-northwind' }),
  count: 2,
  tone: 'danger',
  reasonWords: ['Checks failing', '1 question for you'],
};

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

describe('announceAttention', () => {
  it('does nothing outside the desktop app', async () => {
    await announceAttention({ report: REPORT });
    expect(emit).not.toHaveBeenCalled();
  });

  it('sends the report on goodboy:attention with the origin of this window', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    await announceAttention({ report: REPORT });
    expect(emit).toHaveBeenCalledWith('goodboy:attention', { ...REPORT, origin: sentOrigin() });
  });

  it('hands a failed send back to the caller', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    emit.mockRejectedValueOnce(new Error('event bus is closed'));
    await expect(announceAttention({ report: REPORT })).rejects.toThrow('event bus is closed');
  });
});

describe('listenAttention', () => {
  it('listens to nothing outside the desktop app', async () => {
    await listenAttention({ onReport: vi.fn() });
    expect(listen).not.toHaveBeenCalled();
  });

  it('passes on a report from another window and drops the echo of its own', async () => {
    Reflect.set(window, '__TAURI_INTERNALS__', {});
    await announceAttention({ report: REPORT });
    const ownOrigin = sentOrigin();
    expect(typeof ownOrigin).toBe('string');
    const onReport = vi.fn();
    await listenAttention({ onReport });
    const handler = listen.mock.calls[0]?.[1];
    handler?.({ payload: { ...REPORT, origin: ownOrigin } });
    expect(onReport).not.toHaveBeenCalled();
    handler?.({ payload: { ...REPORT, origin: 'another' } });
    expect(onReport).toHaveBeenCalledWith({ report: REPORT });
  });
});
