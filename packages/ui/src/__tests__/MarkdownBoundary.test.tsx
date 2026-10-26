// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

vi.mock('../components/Markdown/parseStableMarkdown', async () => {
  const actual = await vi.importActual<typeof import('../components/Markdown/parseStableMarkdown')>(
    '../components/Markdown/parseStableMarkdown',
  );
  return {
    ...actual,
    parseStableMarkdown: (params: Parameters<typeof actual.parseStableMarkdown>[0]) => {
      if (params.text.includes('poison-pill')) {
        throw new RangeError('parse failed');
      }
      return actual.parseStableMarkdown(params);
    },
  };
});

import { Markdown } from '../components/Markdown';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Markdown fallback', () => {
  it('falls back to raw text when the parse throws and keeps siblings mounted', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <div>
        <p>Harborline sibling</p>
        <Markdown text="## poison-pill" />
      </div>,
    );
    expect(container.querySelector('pre')?.textContent).toBe('## poison-pill');
    expect(container.querySelector('h2')).toBeNull();
    expect(container.textContent).toContain('Harborline sibling');
  });

  it('renders formatted again when the text changes to a good one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(<Markdown text="poison-pill" />);
    expect(container.querySelector('pre')).not.toBeNull();
    rerender(<Markdown text="## Northwind" />);
    expect(container.querySelector('pre')).toBeNull();
    expect(container.querySelector('h2')?.textContent).toBe('Northwind');
  });

  it('logs the failure once per bad text', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<Markdown text="poison-pill" />);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
