// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SourceView } from '.';

afterEach(cleanup);

const wellOf = (container: HTMLElement): HTMLElement => {
  const well = container.querySelector<HTMLElement>('[data-source-view]');
  if (well === null) {
    throw new Error('missing source well');
  }
  return well;
};

describe('SourceView', () => {
  it('keeps the line numbers out of the copied text', () => {
    const { container } = render(
      <SourceView text={'const a = 1;\nconst b = 2;'} path="allocate.ts" isWrapped={false} />,
    );

    const well = wellOf(container);

    expect(well.textContent).toBe('const a = 1;const b = 2;');
    expect(well.textContent).not.toMatch(/\d\s*const|^\d/);
  });

  it('colours a known language once the worker answers', async () => {
    const { container } = render(
      <SourceView text={'export const total = 3;'} path="ledger.mts" isWrapped={false} />,
    );

    await waitFor(
      () => expect(wellOf(container).querySelectorAll('span span').length).toBeGreaterThan(0),
      { timeout: 15_000 },
    );
    expect(wellOf(container).textContent).toBe('export const total = 3;');
  });

  it('stays plain and says so above 5,000 lines', () => {
    const text = Array.from({ length: 6000 }, (_, index) => `line ${index}`).join('\n');
    const { container } = render(<SourceView text={text} path="big.ts" isWrapped={false} />);

    expect(screen.getByText('Shown without colours: over 5,000 lines.')).toBeDefined();
    expect(wellOf(container).querySelectorAll('span span').length).toBe(0);
    expect(wellOf(container).children.length).toBe(6000);
  });

  it('stays plain and says so for a line over 1,000 characters', () => {
    render(<SourceView text={`x${'y'.repeat(1200)}`} path="min.js" isWrapped={false} />);

    expect(
      screen.getByText('Shown without colours: a line is over 1,000 characters.'),
    ).toBeDefined();
  });

  it('shows no sentence for a file without a known language', () => {
    render(<SourceView text={'plain\nnotes'} path="NOTES" isWrapped />);

    expect(screen.queryByText(/Shown without colours/)).toBeNull();
  });

  it('renders an empty file as one empty line and drops one trailing newline', () => {
    const { container, rerender } = render(<SourceView text="" path="a.txt" isWrapped />);
    expect(wellOf(container).children.length).toBe(1);

    rerender(<SourceView text={'a\nb\n'} path="a.txt" isWrapped />);
    expect(wellOf(container).children.length).toBe(2);
  });

  it('normalises CRLF line endings', () => {
    const { container } = render(<SourceView text={'a\r\nb'} path="a.txt" isWrapped />);

    expect(wellOf(container).textContent).toBe('ab');
  });
});
