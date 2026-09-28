// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { useFlipList } from './index';

type Props = {
  readonly order: ReadonlyArray<string>;
};

const List = ({ order }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useFlipList({ containerRef: ref, orderKey: order.join(',') });
  return (
    <div ref={ref}>
      {order.map((key) => (
        <div key={key} data-flip-key={key} />
      ))}
    </div>
  );
};

const placeByOrder = () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(
    this: Element,
  ) {
    const key = this instanceof HTMLElement ? this.dataset.flipKey : undefined;
    const index = key === undefined ? 0 : [...(this.parentElement?.children ?? [])].indexOf(this);
    const top = key === undefined ? 0 : index * 50;
    return {
      top,
      bottom: top + 50,
      left: 0,
      right: 10,
      width: 10,
      height: 50,
      x: 0,
      y: top,
      toJSON: () => ({}),
    } as DOMRect;
  });
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useFlipList', () => {
  it('slides a row from its old place to its new one', () => {
    placeByOrder();
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    const { rerender } = render(<List order={['a', 'b', 'c']} />);
    expect(animate).not.toHaveBeenCalled();
    rerender(<List order={['c', 'a', 'b']} />);
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateY(100px)' }, { transform: 'translateY(0)' }],
      expect.objectContaining({ duration: 360 }),
    );
  });

  it('swaps in place when reduced motion is asked for', () => {
    placeByOrder();
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true });
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { rerender } = render(<List order={['a', 'b']} />);
    rerender(<List order={['b', 'a']} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
