// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { RailFlyout } from './RailFlyout';

type Box = {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
};

type ViewportParams = {
  readonly width: number;
  readonly height: number;
};

const boxOf = ({ top, left, width, height }: Box): DOMRect =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) satisfies DOMRect;

const setViewport = ({ width, height }: ViewportParams) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
};

const anchorAt = (initial: Box) => {
  const element = document.createElement('button');
  document.body.appendChild(element);
  let box = initial;
  element.getBoundingClientRect = () => boxOf(box);
  return {
    element,
    moveTo: (next: Box) => {
      box = next;
    },
  };
};

const mount = (anchor: HTMLElement) =>
  render(
    <RailFlyout
      target={{ key: 'session', anchor }}
      label="Harborline sessions"
      onKeep={vi.fn()}
      onLeave={vi.fn()}
      onClose={vi.fn()}
      onDismiss={vi.fn()}
    >
      <button type="button">Fix webhook retries</button>
    </RailFlyout>,
  );

const flyout = () => screen.getByRole('dialog', { name: 'Harborline sessions' });

beforeEach(() => {
  setViewport({ width: 1200, height: 800 });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('the rail flyout placement', () => {
  it('opens beside its rail button, a gap to the right and a gap above', () => {
    const anchor = anchorAt({ top: 200, left: 8, width: 40, height: 32 });
    mount(anchor.element);
    expect(flyout().style.left).toBe('56px');
    expect(flyout().style.top).toBe('192px');
    expect(flyout().style.visibility).toBe('visible');
  });

  it('follows its rail button when an ancestor scrolls', () => {
    const anchor = anchorAt({ top: 200, left: 8, width: 40, height: 32 });
    mount(anchor.element);
    anchor.moveTo({ top: 120, left: 8, width: 40, height: 32 });
    act(() => {
      document.body.dispatchEvent(new Event('scroll'));
    });
    expect(flyout().style.top).toBe('112px');
  });

  it('stays inside the window after a resize', () => {
    const anchor = anchorAt({ top: 600, left: 8, width: 40, height: 32 });
    mount(anchor.element);
    expect(flyout().style.top).toBe('592px');
    setViewport({ width: 1200, height: 400 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(Number.parseFloat(flyout().style.top)).toBeLessThanOrEqual(392);
    expect(flyout().style.maxHeight).toBe('384px');
  });
});
