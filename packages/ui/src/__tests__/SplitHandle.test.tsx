// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SplitHandle } from '../components/SplitHandle';
import { SPLIT_DRAG_ATTRIBUTE } from '../splitDragAttribute';

afterEach(cleanup);

describe('SplitHandle', () => {
  it('resizes with arrow keys and the larger shift step', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <SplitHandle
        value={240}
        min={200}
        max={400}
        onChange={onChange}
        onCommit={onCommit}
        ariaLabel="resize column"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize column' });

    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    fireEvent.keyDown(handle, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 248);
    expect(onChange).toHaveBeenNthCalledWith(2, 208);
    expect(onCommit).toHaveBeenNthCalledWith(1, 248);
  });

  it('moves a row handle with the up and down arrows only', () => {
    const onChange = vi.fn();
    render(
      <SplitHandle
        value={300}
        min={160}
        max={600}
        onChange={onChange}
        side="bottom"
        ariaLabel="resize row"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize row' });

    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    fireEvent.keyDown(handle, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 308);
    expect(onChange).toHaveBeenNthCalledWith(2, 268);
  });

  it('clamps drag updates and resets on double click', () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    render(
      <SplitHandle
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

  it('marks the body with the drag axis until the release, and clears it on unmount', () => {
    const view = render(
      <SplitHandle
        value={300}
        min={160}
        max={600}
        onChange={vi.fn()}
        side="bottom"
        ariaLabel="resize row"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize row' });

    fireEvent.mouseDown(handle, { button: 0, clientY: 300 });
    expect(document.body.getAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe('y');
    fireEvent.mouseUp(window);
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);

    fireEvent.mouseDown(handle, { button: 0, clientY: 300 });
    view.unmount();
    expect(document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)).toBe(false);
  });

  it('drags a row handle on the vertical axis and ignores the horizontal one', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <SplitHandle
        value={300}
        min={160}
        max={600}
        onChange={onChange}
        onCommit={onCommit}
        side="top"
        ariaLabel="resize row"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize row' });

    fireEvent.mouseDown(handle, { button: 0, clientX: 500, clientY: 400 });
    fireEvent.mouseMove(window, { clientX: 900, clientY: 400 });
    fireEvent.mouseMove(window, { clientX: 900, clientY: 460 });
    fireEvent.mouseUp(window);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(360);
    expect(onCommit).toHaveBeenCalledWith(360);
    expect(document.body.style.cursor).toBe('');
  });

  it('grows a lower row when its handle is dragged up', () => {
    const onChange = vi.fn();
    render(
      <SplitHandle
        value={300}
        min={160}
        max={600}
        onChange={onChange}
        side="bottom"
        ariaLabel="resize row"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'resize row' });

    fireEvent.mouseDown(handle, { button: 0, clientY: 400 });

    expect(document.body.style.cursor).toBe('row-resize');

    fireEvent.mouseMove(window, { clientY: 340 });
    fireEvent.mouseUp(window);

    expect(onChange).toHaveBeenCalledWith(360);
  });

  it('names its role, orientation and values for a screen reader', () => {
    const { rerender } = render(
      <SplitHandle
        value={400}
        min={384}
        max={560}
        onChange={vi.fn()}
        ariaLabel="Resize Terminal"
      />,
    );
    const column = screen.getByRole('separator', { name: 'Resize Terminal' });

    expect(column.getAttribute('aria-orientation')).toBe('vertical');
    expect(column.getAttribute('aria-valuemin')).toBe('384');
    expect(column.getAttribute('aria-valuemax')).toBe('560');
    expect(column.getAttribute('aria-valuenow')).toBe('400');
    expect(column.tabIndex).toBe(0);

    fireEvent.mouseDown(column, { button: 0, clientX: 1000 });
    fireEvent.mouseMove(window, { clientX: 1080 });

    expect(column.getAttribute('aria-valuenow')).toBe('480');

    fireEvent.mouseUp(window);
    rerender(
      <SplitHandle
        value={320}
        min={160}
        max={600}
        onChange={vi.fn()}
        side="top"
        ariaLabel="Resize Browser"
      />,
    );
    const row = screen.getByRole('separator', { name: 'Resize Browser' });

    expect(row.getAttribute('aria-orientation')).toBe('horizontal');
    expect(row.getAttribute('aria-valuenow')).toBe('320');
  });

  it('keeps the far edge in place, so the rail beside a right panel never moves', () => {
    const railLeft = 1384;
    const startWidth = 400;
    const onChange = vi.fn();
    render(
      <SplitHandle
        value={startWidth}
        min={384}
        max={720}
        onChange={onChange}
        side="right"
        ariaLabel="Resize Terminal"
      />,
    );
    const handle = screen.getByRole('separator', { name: 'Resize Terminal' });
    const pointerPath = [railLeft - startWidth - 40, railLeft - startWidth - 120, railLeft - 500];

    fireEvent.mouseDown(handle, { button: 0, clientX: railLeft - startWidth });
    pointerPath.forEach((clientX) => fireEvent.mouseMove(window, { clientX }));
    fireEvent.mouseUp(window);

    const farEdges = onChange.mock.calls.map(([width], index) => {
      const handleX = pointerPath[index] ?? 0;
      return handleX + Number(width);
    });

    expect(onChange).toHaveBeenCalledTimes(pointerPath.length);
    expect(farEdges).toEqual(pointerPath.map(() => railLeft));
  });

  it('ignores a right click and a key that is not an arrow', () => {
    const onChange = vi.fn();
    render(<SplitHandle value={240} min={200} max={400} onChange={onChange} ariaLabel="resize" />);
    const handle = screen.getByRole('separator', { name: 'resize' });

    fireEvent.mouseDown(handle, { button: 2, clientX: 100 });
    fireEvent.mouseMove(window, { clientX: 300 });
    fireEvent.keyDown(handle, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
