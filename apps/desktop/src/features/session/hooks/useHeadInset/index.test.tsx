// @vitest-environment happy-dom

import { useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { HEAD_INSET_VAR, UnderHeadContext } from '@goodboy/ui';
import { SessionHeadFrame } from '../../components/SessionHeadFrame';

const observers: Array<() => void> = [];

class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    observers.push(callback);
  }
  observe() {}
  disconnect() {
    observers.splice(observers.indexOf(this.callback), 1);
  }
}

afterEach(() => {
  cleanup();
  observers.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type ProbeProps = {
  readonly label: string;
};

const Probe = ({ label }: ProbeProps) => {
  const isUnderHead = useContext(UnderHeadContext);
  return <span data-testid={label}>{isUnderHead ? 'under' : 'free'}</span>;
};

type HeightParams = {
  readonly px: number;
};

const sizeHead = ({ px }: HeightParams) => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function heightOf(
    this: HTMLElement,
  ) {
    return this.hasAttribute('data-session-head-band') ? px : 0;
  });
};

const renderFrame = () =>
  render(
    <SessionHeadFrame head={<Probe label="head" />}>
      <Probe label="page" />
    </SessionHeadFrame>,
  );

describe('useHeadInset', () => {
  it('writes the head height as the inset its page reaches under, and follows it when it grows', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    sizeHead({ px: 92 });
    const { container } = renderFrame();
    const column = container.querySelector('[data-session-head-band]')?.parentElement ?? null;

    expect(column?.style.getPropertyValue(HEAD_INSET_VAR)).toBe('92px');

    sizeHead({ px: 128 });
    act(() => observers.forEach((callback) => callback()));

    expect(column?.style.getPropertyValue(HEAD_INSET_VAR)).toBe('128px');
  });

  it('puts the page under the head, never the head under itself', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    renderFrame();

    expect(screen.getByTestId('page').textContent).toBe('under');
    expect(screen.getByTestId('head').textContent).toBe('free');
  });
});
