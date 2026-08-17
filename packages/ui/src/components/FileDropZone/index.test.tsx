import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileDropZone } from './index';

describe('FileDropZone', () => {
  it('fills its surface with one centred compact action', () => {
    const markup = renderToStaticMarkup(
      <FileDropZone actionLabel="Add files or drag" onSelect={vi.fn()} data-testid="drop-zone" />,
    );

    expect(markup).toContain('data-testid="drop-zone"');
    expect(markup).toContain('h-8 w-full items-center justify-center');
    expect(markup).toContain('Add files or drag');
  });
});
