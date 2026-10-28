// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Markdown } from '../components/Markdown';
import { parseMarkdown } from '../components/Markdown/parseMarkdown';

afterEach(cleanup);

const PARSE_BUDGET_MS = 250;

type NestedParams = {
  readonly depth: number;
};

const nestedNotes = ({ depth }: NestedParams): string =>
  [
    ...Array.from({ length: depth }, () => '<<note>>'),
    'Harborline deep text',
    ...Array.from({ length: depth }, () => '<</note>>'),
  ].join('\n');

const elapsedMs = (run: () => void): number => {
  const startedAt = performance.now();
  run();
  return performance.now() - startedAt;
};

describe('Markdown callout depth', () => {
  it('keeps depth 6 as six callouts', () => {
    const { container } = render(<Markdown text={nestedNotes({ depth: 6 })} />);
    expect(container.querySelectorAll('[data-block="callout"]').length).toBe(6);
  });

  it('keeps depth 7 as six callouts and the seventh opener as text', () => {
    const { container } = render(<Markdown text={nestedNotes({ depth: 7 })} />);
    expect(container.querySelectorAll('[data-block="callout"]').length).toBe(6);
    expect(container.textContent).toContain('Harborline deep text');
    const innermost = container.querySelectorAll('[data-block="callout"]')[5];
    expect(innermost?.querySelector('[data-block="callout"]')).toBeNull();
    expect(innermost?.textContent).toContain('Harborline deep text');
  });

  it('parses a repeated opener on one line under budget', () => {
    const text = '<<note>>'.repeat(2500);
    expect(elapsedMs(() => parseMarkdown({ text }))).toBeLessThan(PARSE_BUDGET_MS);
  });

  it('renders a repeated opener on one line as six callouts', () => {
    const { container } = render(<Markdown text={'<<note>>'.repeat(50)} />);
    expect(container.querySelectorAll('[data-block="callout"]').length).toBe(6);
  });

  it('parses four thousand nested lines under budget', () => {
    const text = nestedNotes({ depth: 4000 });
    expect(elapsedMs(() => parseMarkdown({ text }))).toBeLessThan(PARSE_BUDGET_MS);
  });

  it('parses a table divider line padded with spaces under budget', () => {
    const text = `| Acme |\n--${' '.repeat(40000)}x`;
    expect(elapsedMs(() => parseMarkdown({ text }))).toBeLessThan(PARSE_BUDGET_MS);
  });

  it('parses a divider line with many empty cells under budget', () => {
    const text = `| Acme |\n${'-- | '.repeat(10000)}x`;
    expect(elapsedMs(() => parseMarkdown({ text }))).toBeLessThan(PARSE_BUDGET_MS);
  });

  it('still reads a padded table divider as a table', () => {
    const { container } = render(
      <Markdown text={['| Name | Qty |', ' | :-- | --: | ', '| Northwind | 2 |'].join('\n')} />,
    );
    expect(container.querySelectorAll('table').length).toBe(1);
  });
});
