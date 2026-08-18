// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

import type { ToastKind } from '../../../../../app/components/Toast';

type DragHandler = (event: { payload: unknown }) => void;
type ShowToast = (kind: ToastKind, message: string) => void;

const { hooks } = vi.hoisted(() => ({
  hooks: {
    handlers: [] as DragHandler[],
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
      hooks.handlers.push(cb);
      return () => {
        hooks.handlers = hooks.handlers.filter((h) => h !== cb);
      };
    },
  }),
}));

vi.mock('../../../../../shared/lib/zoom', () => ({
  currentZoom: () => hooks.zoom,
}));

vi.mock('../../../../../shared/lib/readDroppedAttachment', () => ({
  readDroppedAttachment: ({ absolutePath }: { absolutePath: string }) => hooks.read(absolutePath),
}));

import { usePendingAttachments } from './usePendingAttachments';

const COMPOSER_RECT = { left: 100, right: 300, top: 400, bottom: 500 };

const mountComposer = async (
  showToast: Mock<ShowToast>,
  rect: { left: number; right: number; top: number; bottom: number },
  enabled = true,
) => {
  const rendered = renderHook(() => usePendingAttachments({ showToast, enabled }));
  const el = document.createElement('div');
  el.setAttribute('data-drop-composer', '');
  document.body.appendChild(el);
  Object.defineProperty(el, 'offsetParent', { value: document.body, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      x: rect.left,
      y: rect.top,
    }) as DOMRect;
  await act(async () => {
    (rendered.result.current.composerRef as { current: HTMLDivElement | null }).current = el;
  });
  return rendered;
};

const mountWithComposer = async (showToast: Mock<ShowToast>, enabled = true) =>
  mountComposer(showToast, COMPOSER_RECT, enabled);

const dispatch = async (payload: unknown) => {
  await act(async () => {
    hooks.handlers.forEach((h) => h({ payload }));
  });
};

const drop = async (x: number, y: number, paths: ReadonlyArray<string>) => {
  await dispatch({ type: 'drop', position: { x, y }, paths });
};

beforeEach(() => {
  hooks.handlers = [];
  hooks.zoom = 1;
  hooks.read = vi.fn(async (path: string) => ({
    fileName: path.split('/').pop() ?? path,
    mimeType: 'image/png',
    dataBase64: 'aGk=',
  }));
  window.devicePixelRatio = 1;
});
afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-drop-composer]').forEach((el) => el.remove());
});

describe('usePendingAttachments drop target', () => {
  it('accepts a drop landing anywhere when it is the sole visible composer', async () => {
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountWithComposer(showToast);
    await drop(10, 10, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(1);
    expect(result.current.attachments[0]?.fileName).toBe('a.png');
  });

  it('reports unsupported files instead of dropping them silently', async () => {
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountWithComposer(showToast);
    await drop(200, 450, ['/tmp/archive.zip']);
    expect(result.current.attachments).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith('warning', expect.stringContaining('unsupported type'));
  });

  it('explains why a drop is refused while the provider is disconnected', async () => {
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountWithComposer(showToast, false);
    await drop(200, 450, ['/tmp/a.png']);
    expect(result.current.attachments).toHaveLength(0);
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('connect the provider'),
    );
  });

  it('highlights the sole visible composer no matter where the pointer sits', async () => {
    const showToast = vi.fn<ShowToast>();
    const { result } = await mountWithComposer(showToast);
    await dispatch({ type: 'over', position: { x: 10, y: 10 } });
    expect(result.current.isDragging).toBe(true);
  });

  it('accepts a drop at devicePixelRatio 2 using the logical-point candidate', async () => {
    window.devicePixelRatio = 2;
    const decoyRect = { left: 600, right: 700, top: 10, bottom: 60 };
    const showToastA = vi.fn<ShowToast>();
    const showToastB = vi.fn<ShowToast>();
    const target = await mountComposer(showToastA, COMPOSER_RECT);
    const decoy = await mountComposer(showToastB, decoyRect);
    await drop(200, 450, ['/tmp/a.png']);
    expect(target.result.current.attachments).toHaveLength(1);
    expect(decoy.result.current.attachments).toHaveLength(0);
  });

  it('accepts a drop at devicePixelRatio 2 with a non-default zoom', async () => {
    window.devicePixelRatio = 2;
    hooks.zoom = 1.5;
    const decoyRect = { left: 500, right: 700, top: 50, bottom: 150 };
    const showToastA = vi.fn<ShowToast>();
    const showToastB = vi.fn<ShowToast>();
    const target = await mountComposer(showToastA, COMPOSER_RECT);
    const decoy = await mountComposer(showToastB, decoyRect);
    await drop(375, 720, ['/tmp/a.png']);
    expect(target.result.current.attachments).toHaveLength(1);
    expect(decoy.result.current.attachments).toHaveLength(0);
  });

  it('routes a multi-composer drop to the composer under the pointer', async () => {
    const decoyRect = { left: 600, right: 700, top: 10, bottom: 60 };
    const showToastA = vi.fn<ShowToast>();
    const showToastB = vi.fn<ShowToast>();
    const first = await mountComposer(showToastA, COMPOSER_RECT);
    const second = await mountComposer(showToastB, decoyRect);
    await drop(650, 30, ['/tmp/b.png']);
    expect(first.result.current.attachments).toHaveLength(0);
    expect(second.result.current.attachments).toHaveLength(1);
    expect(second.result.current.attachments[0]?.fileName).toBe('b.png');
  });

  it('warns on an ambiguous miss when several composers are visible but neither candidate hits', async () => {
    const decoyRect = { left: 600, right: 700, top: 10, bottom: 60 };
    const showToastA = vi.fn<ShowToast>();
    const showToastB = vi.fn<ShowToast>();
    await mountComposer(showToastA, COMPOSER_RECT);
    await mountComposer(showToastB, decoyRect);
    await drop(0, 0, ['/tmp/a.png']);
    expect(showToastA).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('drop the file on a message box'),
    );
  });
});
