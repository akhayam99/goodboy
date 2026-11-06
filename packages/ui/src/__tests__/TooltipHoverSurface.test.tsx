// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip } from '../components/Tooltip';
import { useHoverSurface } from '../useHoverSurface';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type SurfaceProps = { readonly isShown: boolean };

const Surface = ({ isShown }: SurfaceProps) => {
  useHoverSurface({ isActive: isShown });
  if (!isShown) {
    return null;
  }
  return (
    <div data-testid="surface" data-hover-surface="">
      <Tooltip content="inside tip">
        <button type="button">inside</button>
      </Tooltip>
    </div>
  );
};

const Harness = () => {
  const [isShown, setIsShown] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setIsShown(!isShown)}>
        toggle
      </button>
      <Tooltip content="outside tip">
        <button type="button">outside</button>
      </Tooltip>
      <Surface isShown={isShown} />
    </>
  );
};

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('Tooltip beside a hover surface', () => {
  it('closes a tooltip that is already up the moment a surface opens', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.mouseEnter(screen.getByText('outside'));
    await advance(400);
    expect(screen.getByRole('tooltip').textContent).toBe('outside tip');

    fireEvent.click(screen.getByText('toggle'));

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not open a tooltip while a surface is open, even after its delay', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.mouseEnter(screen.getByText('outside'));
    await advance(200);
    fireEvent.click(screen.getByText('toggle'));
    await advance(600);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not bring the tooltip back when the surface closes under a pointer that left', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.mouseEnter(screen.getByText('outside'));
    await advance(400);
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.mouseLeave(screen.getByText('outside'));
    fireEvent.click(screen.getByText('toggle'));
    await advance(600);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows the tooltip again on a fresh hover once the surface is gone', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.mouseEnter(screen.getByText('outside'));
    await advance(400);

    expect(screen.getByRole('tooltip').textContent).toBe('outside tip');
  });

  it('keeps a tooltip that lives inside the open surface', async () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByText('toggle'));
    fireEvent.mouseEnter(screen.getByText('inside'));
    await advance(400);

    expect(screen.getByRole('tooltip').textContent).toBe('inside tip');
  });

  it('keeps isSuppressed working', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="muted" isSuppressed>
        <button type="button">muted</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('muted'));
    await advance(600);

    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip inside another tooltip trigger', () => {
  it('returns the bare child so the outer tooltip is the only one', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="outer tip">
        <button type="button">
          <Tooltip content="inner tip">
            <span>dot</span>
          </Tooltip>
        </button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('dot'));
    fireEvent.mouseEnter(screen.getByRole('button'));
    await advance(400);

    const tips = screen.getAllByRole('tooltip');
    expect(tips).toHaveLength(1);
    expect(tips[0]?.textContent).toBe('outer tip');
  });

  it('lets the inner tooltip work when the outer one is suppressed', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="outer tip" isSuppressed>
        <button type="button">
          <Tooltip content="inner tip">
            <span>dot</span>
          </Tooltip>
        </button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByText('dot'));
    await advance(400);

    expect(screen.getByRole('tooltip').textContent).toBe('inner tip');
  });
});
