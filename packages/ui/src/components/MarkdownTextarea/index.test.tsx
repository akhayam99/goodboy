// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { decorate } from './decorate';
import { MarkdownTextarea } from './index';

afterEach(cleanup);

function textOf(input: string): string {
  const { container } = render(<div>{decorate(input)}</div>);
  return container.textContent ?? '';
}

describe('decorate', () => {
  it('preserves every marker character in the output', () => {
    const samples = [
      '*ciao*',
      '**bold**',
      '__bold__',
      '`code`',
      '~~strike~~',
      '# heading',
      '> quote',
      '- item',
      '1. first',
      'plain text with _under_score_ and no close',
    ];
    for (const s of samples) {
      expect(textOf(s)).toBe(s);
    }
  });

  it('preserves text across multiple lines including blanks', () => {
    const multi = '# title\n\n- a\n- b\nplain';
    expect(textOf(multi)).toBe(multi);
  });

  it('styles bold content as semibold while keeping the asterisks', () => {
    const { container } = render(<div>{decorate('**hi**')}</div>);
    const semibold = container.querySelector('.font-semibold');
    expect(semibold?.textContent).toBe('hi');
    expect(container.textContent).toBe('**hi**');
  });

  it('styles inline code as monospace while keeping the backticks', () => {
    const { container } = render(<div>{decorate('`x`')}</div>);
    const mono = container.querySelector('.font-mono');
    expect(mono?.textContent).toBe('x');
    expect(container.textContent).toBe('`x`');
  });
});

describe('MarkdownTextarea', () => {
  it('renders a plain textarea when live is off', () => {
    const { container } = render(<MarkdownTextarea value="*x*" live={false} readOnly />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(container.querySelector('textarea')?.value).toBe('*x*');
  });

  it('renders the decorated backdrop when live is on', () => {
    const { container } = render(<MarkdownTextarea value="**x**" live readOnly />);
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.textContent).toContain('**x**');
    expect(container.querySelector('textarea')?.value).toBe('**x**');
  });
});
