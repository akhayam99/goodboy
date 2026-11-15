// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchTerminalFit } from './watchTerminalFit';

type Query = {
  readonly media: string;
  readonly listeners: Set<() => void>;
};

const queries: Array<Query> = [];
const observed: Array<() => void> = [];

const fireDprChange = (): void => {
  const query = queries.at(-1);
  for (const listener of Array.from(query?.listeners ?? [])) {
    listener();
  }
};

beforeEach(() => {
  queries.length = 0;
  observed.length = 0;
  vi.stubGlobal('matchMedia', (media: string) => {
    const query: Query = { media, listeners: new Set() };
    queries.push(query);
    return {
      media,
      matches: true,
      addEventListener: (_type: string, listener: () => void) => query.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        query.listeners.delete(listener),
    };
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly callback: () => void;
      constructor(callback: () => void) {
        this.callback = callback;
        observed.push(callback);
      }
      observe() {
        return undefined;
      }
      disconnect() {
        observed.splice(observed.indexOf(this.callback), 1);
      }
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
});

describe('the terminal fit under app zoom', () => {
  it('refits when the zoom changes the pixel ratio and watches the new ratio after', () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    const onFit = vi.fn();
    const stop = watchTerminalFit({ container: document.createElement('div'), onFit });
    expect(queries.at(-1)?.media).toBe('(resolution: 2dppx)');

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    fireDprChange();

    expect(onFit).toHaveBeenCalledTimes(1);
    expect(queries.at(-1)?.media).toBe('(resolution: 3dppx)');
    expect(queries[0]?.listeners.size).toBe(0);
    stop();
  });

  it('refits when the box resizes and stops listening once stopped', () => {
    const onFit = vi.fn();
    const stop = watchTerminalFit({ container: document.createElement('div'), onFit });
    observed[0]?.();
    expect(onFit).toHaveBeenCalledTimes(1);

    stop();

    expect(observed).toHaveLength(0);
    expect(queries.at(-1)?.listeners.size).toBe(0);
  });
});
