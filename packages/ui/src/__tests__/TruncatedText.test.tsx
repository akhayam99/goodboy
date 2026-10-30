// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TruncatedText } from '../components/TruncatedText';

afterEach(cleanup);

const measured = ({ scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) => {
  const element = screen.getByText('release-train/payments-api');
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: clientWidth });
  return element;
};

const hoverAfterIntent = (element: HTMLElement): void => {
  vi.useFakeTimers();
  fireEvent.mouseEnter(element);
  act(() => {
    vi.advanceTimersByTime(400);
  });
  vi.useRealTimers();
};

describe('TruncatedText', () => {
  it('shows the whole text in a tooltip when it is cut', () => {
    render(<TruncatedText>release-train/payments-api</TruncatedText>);

    hoverAfterIntent(measured({ scrollWidth: 240, clientWidth: 120 }));

    expect(screen.getByRole('tooltip').textContent).toBe('release-train/payments-api');
  });

  it('shows no tooltip when the text fits', () => {
    render(<TruncatedText>release-train/payments-api</TruncatedText>);

    hoverAfterIntent(measured({ scrollWidth: 120, clientWidth: 120 }));

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows a given tooltip in place of its text and never a native title', () => {
    render(
      <TruncatedText tooltip="Branch release-train/payments-api">
        release-train/payments-api
      </TruncatedText>,
    );
    const element = measured({ scrollWidth: 240, clientWidth: 120 });

    hoverAfterIntent(element);

    expect(screen.getByRole('tooltip').textContent).toBe('Branch release-train/payments-api');
    expect(element.getAttribute('title')).toBeNull();
    expect(element.className).toContain('truncate');
  });

  it('renders the element it is told to and keeps the caller class', () => {
    render(
      <TruncatedText as="h3" className="text-title">
        release-train/payments-api
      </TruncatedText>,
    );

    const element = screen.getByRole('heading', { level: 3 });
    expect(element.className).toContain('text-title');
    expect(element.className).toContain('truncate');
  });
  it('clamps to two lines when asked and keeps the one-line default otherwise', () => {
    render(<TruncatedText lines={2}>release-train/payments-api</TruncatedText>);

    const element = screen.getByText('release-train/payments-api');
    expect(element.className).toContain('line-clamp-2');
    expect(element.className).not.toContain('truncate');
  });

  it('joins the tab order only while its text is cut when it is focusable', () => {
    const heightOf = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get');
    const clientOf = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get');
    heightOf.mockReturnValue(40);
    clientOf.mockReturnValue(20);
    const cut = render(
      <TruncatedText lines={2} isFocusable>
        release-train/payments-api
      </TruncatedText>,
    );
    expect(screen.getByText('release-train/payments-api').getAttribute('tabindex')).toBe('0');
    cut.unmount();

    heightOf.mockReturnValue(20);
    render(
      <TruncatedText lines={2} isFocusable>
        release-train/payments-api
      </TruncatedText>,
    );
    expect(screen.getByText('release-train/payments-api').getAttribute('tabindex')).toBeNull();
    vi.restoreAllMocks();
  });
});
