// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { studioRailFoldKey, useStudioRailFold } from '../useStudioRailFold';

type ObserverCallback = (entries: ReadonlyArray<{ contentRect: { width: number } }>) => void;

const observers: ObserverCallback[] = [];

const resizeTo = (width: number) => {
  act(() => {
    observers.forEach((callback) => callback([{ contentRect: { width } }]));
  });
};

beforeEach(() => {
  localStorage.clear();
  observers.length = 0;
  class StubObserver {
    private readonly callback: ObserverCallback;
    constructor(callback: ObserverCallback) {
      this.callback = callback;
    }
    observe() {
      observers.push(this.callback);
    }
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', StubObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const Probe = () => {
  const fold = useStudioRailFold({ surface: 'inbox', foldBelow: 880 });
  return (
    <div ref={fold.paneRef}>
      <p data-testid="state">{`${fold.isCollapsed ? 'collapsed' : 'docked'} ${fold.canDock ? 'can-dock' : 'cannot-dock'}`}</p>
      <button type="button" onClick={() => fold.setFolded(true)}>
        fold
      </button>
      <button type="button" onClick={() => fold.setFolded(false)}>
        dock
      </button>
    </div>
  );
};

const state = (): string => screen.getByTestId('state').textContent ?? '';

describe('useStudioRailFold', () => {
  it('starts docked before the pane is measured', () => {
    render(<Probe />);

    expect(state()).toBe('docked can-dock');
  });

  it('folds under the threshold without saving anything, and docks again when widened', () => {
    render(<Probe />);

    resizeTo(879);

    expect(state()).toBe('collapsed cannot-dock');
    expect(localStorage.getItem(studioRailFoldKey({ surface: 'inbox' }))).toBeNull();

    resizeTo(880);

    expect(state()).toBe('docked can-dock');
  });

  it('remembers a fold per surface and reads it back on the next mount', () => {
    const first = render(<Probe />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    expect(state()).toBe('collapsed can-dock');
    expect(localStorage.getItem('goodboy:studio-rail-folded:inbox:v1')).toBe('1');

    first.unmount();
    render(<Probe />);

    expect(state()).toBe('collapsed can-dock');

    fireEvent.click(screen.getByRole('button', { name: 'dock' }));

    expect(state()).toBe('docked can-dock');
    expect(localStorage.getItem('goodboy:studio-rail-folded:inbox:v1')).toBe('0');
  });

  it('keeps the fold in memory when storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(<Probe />);

    fireEvent.click(screen.getByRole('button', { name: 'fold' }));

    expect(state()).toBe('collapsed can-dock');
  });
});
