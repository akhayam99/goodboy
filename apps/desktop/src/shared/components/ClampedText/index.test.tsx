// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import { ClampedText } from '.';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ClampedText', () => {
  it('leaves short text open without a disclosure', () => {
    render(<ClampedText text="Short note">Short note</ClampedText>);

    screen.getByText('Short note');
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });

  it('marks long text as clamped until the reader opens it', () => {
    const text = Array.from({ length: 9 }, (_, index) => `Line ${index + 1}`).join('\n');
    const { container } = render(<ClampedText text={text}>{text}</ClampedText>);

    expect(container.querySelector('[data-clamped="true"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(container.querySelector('[data-clamped="true"]')).toBeNull();
    screen.getByRole('button', { name: 'Show less' });
  });

  it('offers the disclosure for a short paragraph that wraps past the clamp', () => {
    const resize = installFakeResizeObserver();
    let renderedHeight = 220;
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(() => renderedHeight);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160);
    const { container } = render(<ClampedText text="One wrapped paragraph">body</ClampedText>);

    expect(container.querySelector('[data-clamped="true"]')).not.toBeNull();
    screen.getByRole('button', { name: 'Show all' });

    renderedHeight = 160;
    act(() => resize.resizeAll());

    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
    expect(container.querySelector('[data-clamped="true"]')).toBeNull();
  });

  it('keeps a short paragraph open when it fits inside the clamp', () => {
    installFakeResizeObserver();
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120);
    render(<ClampedText text="Fits">Fits</ClampedText>);

    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull();
  });

  it('stops observing the body when it unmounts', () => {
    const resize = installFakeResizeObserver();
    const { unmount } = render(<ClampedText text="Short">Short</ClampedText>);

    expect(resize.observedCount()).toBe(1);
    unmount();
    expect(resize.observedCount()).toBe(0);
  });
});
