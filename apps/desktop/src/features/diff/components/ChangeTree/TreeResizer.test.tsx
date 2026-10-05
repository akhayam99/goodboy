// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TreeResizer } from './TreeResizer';

const asideOf = (width: number) => {
  const aside = document.createElement('aside');
  vi.spyOn(aside, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
  return { current: aside };
};

describe('TreeResizer', () => {
  afterEach(cleanup);

  it('steps the keyboard from the rendered width, not the saved one', () => {
    const onResize = vi.fn();
    render(
      <TreeResizer
        asideRef={asideOf(300)}
        width={560}
        paneWidth={() => 1000}
        onResize={onResize}
      />,
    );

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });

    expect(onResize).toHaveBeenCalledWith(284);
  });

  it('steps wider with ArrowRight from the rendered width', () => {
    const onResize = vi.fn();
    render(
      <TreeResizer
        asideRef={asideOf(300)}
        width={560}
        paneWidth={() => 1000}
        onResize={onResize}
      />,
    );

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });

    expect(onResize).toHaveBeenCalledWith(316);
  });
});
