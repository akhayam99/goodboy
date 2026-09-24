// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { InlineMarkdown } from '../components/Markdown/InlineMarkdown';
import { inlineMarkdownText } from '../components/Markdown/inlineMarkdownText';
import { ctxTagLabel } from '../components/Markdown/ctxTagStyle';

afterEach(cleanup);

describe('InlineMarkdown', () => {
  it('renders backticked text as a code element without the backticks', () => {
    render(<InlineMarkdown text="run `/explore` now" />);

    const code = screen.getByText('/explore');
    expect(code.tagName).toBe('CODE');
    expect(screen.getByText(/run/).textContent).not.toContain('`');
  });

  it('renders bold, italic and strikethrough as strong, em and del', () => {
    const { container } = render(<InlineMarkdown text="**ship** _it_ ~~now~~" />);

    expect(container.querySelector('strong')?.textContent).toBe('ship');
    expect(container.querySelector('em')?.textContent).toBe('it');
    expect(container.querySelector('del')?.textContent).toBe('now');
  });

  it('renders a link as its text and never as an anchor', () => {
    const { container } = render(<InlineMarkdown text="see [the docs](https://acme.test)" />);

    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('see the docs');
  });

  it('renders an image as its alt text and never as an img', () => {
    const { container } = render(<InlineMarkdown text="![diagram](https://acme.test/d.png)" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('diagram');
  });

  it('renders a context chip as its label', () => {
    const { container } = render(<InlineMarkdown text="blocked <<fail>>" />);

    expect(container.textContent).toBe(`blocked ${ctxTagLabel({ tag: 'fail' })}`);
  });

  it('renders a labelled chip with its own label', () => {
    const { container } = render(<InlineMarkdown text="<<fail: 2 regions down>>" />);

    expect(container.textContent).toBe('2 regions down');
  });

  it('applies the className to the wrapper', () => {
    const { container } = render(<InlineMarkdown text="title" className="truncate" />);

    expect(container.firstElementChild?.className).toBe('truncate');
  });
});

describe('inlineMarkdownText', () => {
  it('drops the markers and keeps the content', () => {
    expect(inlineMarkdownText({ text: 'run `/explore` on **auth** _now_' })).toBe(
      'run /explore on auth now',
    );
  });

  it('passes plain text through unchanged', () => {
    expect(inlineMarkdownText({ text: 'plain title' })).toBe('plain title');
  });
});
