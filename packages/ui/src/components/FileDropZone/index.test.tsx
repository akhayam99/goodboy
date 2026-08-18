// @vitest-environment happy-dom

import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileDropZone } from './index';

describe('FileDropZone', () => {
  afterEach(cleanup);

  it('fills its surface with one centred compact action', () => {
    const markup = renderToStaticMarkup(
      <FileDropZone actionLabel="Add files or drag" onSelect={vi.fn()} data-testid="drop-zone" />,
    );

    expect(markup).toContain('data-testid="drop-zone"');
    expect(markup).toContain('h-8 w-full items-center justify-center');
    expect(markup).toContain('Add files or drag');
  });

  it('hands its outer element to the caller ref so drop hit-testing can reach it', () => {
    const ref = createRef<HTMLDivElement>();

    render(<FileDropZone ref={ref} actionLabel="Add files or drag" onSelect={vi.fn()} />);

    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('DIV');
    expect(ref.current?.textContent).toContain('Add files or drag');
  });
});
