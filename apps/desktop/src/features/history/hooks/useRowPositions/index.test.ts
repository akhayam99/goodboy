// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { useRowPositions } from './index';

type Params = {
  readonly parent: HTMLElement;
  readonly top: number;
  readonly height: number;
  readonly key?: string;
};

const row = ({ parent, top, height, key }: Params): HTMLElement => {
  const element = document.createElement('div');
  if (key !== undefined) {
    element.dataset.graphKey = key;
  }
  Object.defineProperties(element, {
    offsetTop: { configurable: true, value: top },
    offsetHeight: { configurable: true, value: height },
    offsetParent: { configurable: true, value: parent },
  });
  parent.appendChild(element);
  return element;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('history row positions', () => {
  it('skips day headers as nodes and anchors taller rows to their first line', () => {
    installFakeResizeObserver();
    const list = document.createElement('div');
    const commits = row({ parent: list, top: 0, height: 168 });
    row({ parent: commits, top: 0, height: 28 });
    row({ parent: commits, top: 28, height: 28, key: 'acme' });
    row({ parent: commits, top: 56, height: 28 });
    row({ parent: commits, top: 84, height: 84, key: 'harborline' });
    row({ parent: list, top: 168, height: 28, key: 'fork' });
    const { result } = renderHook(() =>
      useRowPositions({ listRef: { current: list }, layoutKey: 'acme,harborline' }),
    );
    expect([...result.current.y]).toEqual([
      ['acme', 42],
      ['harborline', 98],
      ['fork', 182],
    ]);
    expect(result.current.height).toBe(196);
  });

  it('remeasures expanded rows and excludes the absolute drop slot from graph height', () => {
    const observers = installFakeResizeObserver();
    const list = document.createElement('div');
    const commit = row({ parent: list, top: 28, height: 28, key: 'acme' });
    const fork = row({ parent: list, top: 56, height: 28, key: 'fork' });
    const slot = row({ parent: list, top: 500, height: 0 });
    slot.dataset.historySlot = '';
    const { result } = renderHook(() =>
      useRowPositions({ listRef: { current: list }, layoutKey: 'acme' }),
    );
    expect(result.current.height).toBe(84);
    Object.defineProperty(commit, 'offsetHeight', { value: 100 });
    Object.defineProperty(fork, 'offsetTop', { value: 128 });
    act(() => observers.resizeAll());
    expect(result.current.y.get('acme')).toBe(42);
    expect(result.current.y.get('fork')).toBe(142);
    expect(result.current.height).toBe(156);
  });
});
