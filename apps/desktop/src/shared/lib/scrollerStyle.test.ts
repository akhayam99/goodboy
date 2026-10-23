import { afterEach, expect, it, vi } from 'vitest';
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { createInvokeMock } from '../../test/invokeMock';
import { systemScrollerStyle } from './scrollerStyle';

afterEach(() => {
  clearMocks();
  vi.unstubAllGlobals();
});

it('uses hover scrollbars in a browser before scene IPC is installed', async () => {
  clearMocks();

  expect(await systemScrollerStyle()).toBe('hover');
});

it('uses the native scrollbar preference when Tauri is available', async () => {
  const invoke = createInvokeMock({ handlers: { system_scroller_style: 'always' } });
  mockIPC(invoke);
  vi.stubGlobal('isTauri', true);

  expect(await systemScrollerStyle()).toBe('always');
  expect(invoke).toHaveBeenCalledWith('system_scroller_style', {});
});

it('keeps the browser default after scene IPC is installed', async () => {
  const invoke = createInvokeMock({ handlers: { system_scroller_style: undefined } });
  mockIPC(invoke);

  expect(await systemScrollerStyle()).toBe('hover');
  expect(invoke).not.toHaveBeenCalled();
});

it('uses hover scrollbars for an unknown native preference', async () => {
  mockIPC(createInvokeMock({ handlers: { system_scroller_style: 'unknown' } }));
  vi.stubGlobal('isTauri', true);

  expect(await systemScrollerStyle()).toBe('hover');
});
