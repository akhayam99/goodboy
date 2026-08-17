import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useFileDropTarget } from './index';

type DragHandler = (event: { payload: unknown }) => void;
type DropPaths = { readonly paths: ReadonlyArray<string> };

const mocks = vi.hoisted(() => ({
  handlers: Array<DragHandler>(),
  isUnavailable: false,
}));

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => {
    if (mocks.isUnavailable) {
      throw new Error('webview unavailable');
    }
    return {
      onDragDropEvent: async (handler: DragHandler) => {
        mocks.handlers.push(handler);
        return () => {
          mocks.handlers = mocks.handlers.filter((candidate) => candidate !== handler);
        };
      },
    };
  },
}));

vi.mock('../../lib/zoom', () => ({
  currentZoom: () => 1,
}));

const mountTarget = async ({
  isEnabled = true,
  onDisabledDrop = vi.fn(),
  onDropPaths,
}: {
  readonly isEnabled?: boolean;
  readonly onDisabledDrop?: () => void;
  readonly onDropPaths: (value: DropPaths) => void;
}) => {
  const element = document.createElement('div');
  element.setAttribute('data-drop-composer', '');
  document.body.appendChild(element);
  Object.defineProperty(element, 'offsetParent', { value: document.body, configurable: true });
  const targetRef = { current: element };
  const rendered = renderHook(() =>
    useFileDropTarget({
      isEnabled,
      onDisabledDrop,
      onDropPaths,
      targetRef,
    }),
  );
  await act(async () => Promise.resolve());
  return { ...rendered, onDisabledDrop };
};

const dispatchDrop = async ({ paths }: DropPaths) => {
  await act(async () => {
    mocks.handlers.forEach((handler) => {
      handler({
        payload: {
          type: 'drop',
          position: { x: 0, y: 0 },
          paths,
        },
      });
    });
  });
};

beforeEach(() => {
  mocks.handlers = [];
  mocks.isUnavailable = false;
});

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-drop-composer]').forEach((element) => element.remove());
});

describe('useFileDropTarget', () => {
  it('delivers paths dropped on the sole visible target', async () => {
    const onDropPaths = vi.fn<(value: DropPaths) => void>();
    await mountTarget({ onDropPaths });

    await dispatchDrop({ paths: ['/tmp/image.png'] });

    expect(onDropPaths).toHaveBeenCalledWith({ paths: ['/tmp/image.png'] });
  });

  it('reports a drop on a disabled target without delivering paths', async () => {
    const onDropPaths = vi.fn<(value: DropPaths) => void>();
    const target = await mountTarget({ isEnabled: false, onDropPaths });

    await dispatchDrop({ paths: ['/tmp/image.png'] });

    expect(target.onDisabledDrop).toHaveBeenCalledOnce();
    expect(onDropPaths).not.toHaveBeenCalled();
  });

  it('routes overlapping targets to the one rendered on top', async () => {
    const lowerTarget = vi.fn<(value: DropPaths) => void>();
    const upperTarget = vi.fn<(value: DropPaths) => void>();
    await mountTarget({ onDropPaths: lowerTarget });
    await mountTarget({ onDropPaths: upperTarget });

    await dispatchDrop({ paths: ['/tmp/image.png'] });

    expect(lowerTarget).not.toHaveBeenCalled();
    expect(upperTarget).toHaveBeenCalledWith({ paths: ['/tmp/image.png'] });
  });

  it('reports when the native webview is unavailable', async () => {
    mocks.isUnavailable = true;
    const onUnavailable = vi.fn();
    renderHook(() =>
      useFileDropTarget({
        targetRef: { current: null },
        onDropPaths: vi.fn(),
        onUnavailable,
      }),
    );

    await act(async () => Promise.resolve());

    expect(onUnavailable).toHaveBeenCalledOnce();
  });
});
