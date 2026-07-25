// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

type DragHandler = (event: { payload: unknown }) => void;

const { hooks } = vi.hoisted(() => ({
  hooks: {
    handler: null as DragHandler | null,
    zoom: 1,
    read: vi.fn(async (path: string) => ({
      fileName: path.split('/').pop() ?? path,
      mimeType: 'image/png',
      dataBase64: 'aGk=',
    })),
  },
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: async (cb: DragHandler) => {
      hooks.handler = cb;
      return () => {
        hooks.handler = null;
      };
    },
  }),
}));

vi.mock('../../../../../shared/lib/zoom', () => ({
  currentZoom: () => hooks.zoom,
}));

vi.mock('../../../turn', () => ({
  readDroppedAttachment: (path: string) => hooks.read(path),
}));

import { usePendingAttachments } from './usePendingAttachments';

const COMPOSER_RECT = { left: 100, right: 300, top: 400, bottom: 500 };

const mountWithComposer = async (showToast: ReturnType<typeof vi.fn>, enabled = true) => {
  const rendered = renderHook(() => usePendingAttachments({ showToast, enabled }));
  const el = document.createElement('div');
  document.body.appendChild(el);
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
  el.getBoundingClientRect = () =>
    ({ ...COMPOSER_RECT, width: 200, height: 100, x: 100, y: 400 }) as DOMRect;
  await act(async () => {
    (rendered.result.current.composerRef as { current: HTMLDivElement | null }).current = el;
  });
  return rendered;
};

const drop = async (x: number, y: number, paths: ReadonlyArray<string>) => {
  await act(async () => {
    hooks.handler?.({ payload: { type: 'drop', position: { x, y }, paths } });
  });
};

beforeEach(() => {
  hooks.handler = null;
  hooks.zoom = 1;
  hooks.read = vi.fn(async (path: string) => ({
    fileName: path.split('/').pop() ?? path,
    mimeType: 'image/png',
    dataBase64: 'aGk=',
  }));
  window.devicePixelRatio = 1;
});
afterEach(cleanup);

describe('usePendingAttachments drop target', () => {
  it('accepts a drop landing inside the composer', async () => {
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast);
    await drop(200, 450, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0]?.fileName).toBe('a.png');
  });

  it('ignores a drop outside the composer', async () => {
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast);
    await drop(10, 10, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(0);
  });

  it('accounts for the webview zoom factor when hit testing', async () => {
    hooks.zoom = 2;
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast);
    await drop(400, 900, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(1);
  });

  it('reports unsupported files instead of dropping them silently', async () => {
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast);
    await drop(200, 450, ['/tmp/archive.zip']);
    expect(result.current.attachments).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith('warning', expect.stringContaining('unsupported type'));
  });

  it('explains why a drop is refused while the provider is disconnected', async () => {
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast, false);
    await drop(200, 450, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('connect the provider'),
    );
  });

  it('highlights only while the pointer is over the composer', async () => {
    const showToast = vi.fn();
    const { result } = await mountWithComposer(showToast);
    await act(async () => {
      hooks.handler?.({ payload: { type: 'over', position: { x: 10, y: 10 } } });
    });
    expect(result.current.isDragging).toBe(false);
    await act(async () => {
      hooks.handler?.({ payload: { type: 'over', position: { x: 200, y: 450 } } });
    });
    expect(result.current.isDragging).toBe(true);
  });
});
