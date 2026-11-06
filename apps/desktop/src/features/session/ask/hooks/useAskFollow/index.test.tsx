import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useAskFollow } from '.';

type HostProps = {
  readonly contentLength: number;
  readonly turnCount: number;
};

const Host = ({ contentLength, turnCount }: HostProps) => {
  const endRef = useRef<HTMLDivElement | null>(null);
  useAskFollow({ endRef, isActive: true, contentLength, turnCount });
  return (
    <div data-testid="scroller" className="overflow-y-auto">
      <div ref={endRef} />
    </div>
  );
};

const stubScroller = ({
  scroller,
  top,
}: {
  readonly scroller: HTMLElement;
  readonly top: number;
}) => {
  Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(scroller, 'clientHeight', { value: 300, configurable: true });
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event('scroll'));
};

describe('useAskFollow', () => {
  afterEach(cleanup);

  it('follows the end while the reader sits at the bottom, and stays put after scrolling up', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender, getByTestId } = render(<Host contentLength={0} turnCount={1} />);
    const scroller = getByTestId('scroller');
    scrollIntoView.mockClear();

    stubScroller({ scroller, top: 700 });
    rerender(<Host contentLength={40} turnCount={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    stubScroller({ scroller, top: 100 });
    rerender(<Host contentLength={80} turnCount={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('stays put after a short scroll up inside the pin slack', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender, getByTestId } = render(<Host contentLength={0} turnCount={1} />);
    const scroller = getByTestId('scroller');

    stubScroller({ scroller, top: 700 });
    stubScroller({ scroller, top: 680 });
    scrollIntoView.mockClear();
    rerender(<Host contentLength={40} turnCount={1} />);
    expect(scrollIntoView).not.toHaveBeenCalled();

    stubScroller({ scroller, top: 700 });
    rerender(<Host contentLength={80} turnCount={1} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('follows again when a new question is sent', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const { rerender, getByTestId } = render(<Host contentLength={0} turnCount={1} />);
    stubScroller({ scroller: getByTestId('scroller'), top: 100 });
    scrollIntoView.mockClear();

    rerender(<Host contentLength={0} turnCount={2} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
