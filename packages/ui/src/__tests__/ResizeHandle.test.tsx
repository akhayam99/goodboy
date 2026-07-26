// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResizeHandle } from '../components/ResizeHandle';

afterEach(cleanup);

describe('ResizeHandle', () => {
  it('resizes with arrow keys and the larger shift step', () => {
    const onChange = vi.fn();
    render(
      <ResizeHandle
        value={240}
        min={200}
        max={400}
        onChange={onChange}
        ariaLabel="resize column"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize column' });

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });

    expect(onChange).toHaveBeenNthCalledWith(1, 248);
    expect(onChange).toHaveBeenNthCalledWith(2, 208);
  });

  it('clamps drag updates and resets on double click', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <ResizeHandle
        value={240}
        min={200}
        max={400}
        onChange={onChange}
        onReset={onReset}
        ariaLabel="resize column"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize column' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 300 });
    fireEvent.mouseUp(window);
    fireEvent.doubleClick(handle);

    expect(onChange).toHaveBeenCalledWith(400);
    expect(onReset).toHaveBeenCalledOnce();
  });
});
