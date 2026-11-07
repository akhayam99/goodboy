// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useMeasuredNode } from './index';

type MeasureParams = {
  readonly node: HTMLElement;
};

const measureHeight = ({ node }: MeasureParams): number => node.offsetHeight;

const Probe = () => {
  const { ref, value } = useMeasuredNode({ measure: measureHeight, initial: 0 });
  return (
    <div ref={ref} data-testid="probe">
      {value}
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useMeasuredNode', () => {
  it('reads the node once it is mounted', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(42);

    render(<Probe />);

    expect(screen.getByTestId('probe').textContent).toBe('42');
  });

  it('reads again when the observer reports a new size and stops observing on unmount', () => {
    const disconnect = vi.fn();
    const observers: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(10);

    const view = render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('10');

    height.mockReturnValue(30);
    act(() => observers.forEach((notify) => notify()));
    expect(screen.getByTestId('probe').textContent).toBe('30');

    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
