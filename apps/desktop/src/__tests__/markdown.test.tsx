import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from '@goodboy/ui';

describe('Markdown', () => {
  it('renders headings', () => {
    const { container } = render(<Markdown text={'# title\n\nbody'} />);
    expect(container.querySelector('h1')?.textContent).toBe('title');
    expect(container.querySelector('p')?.textContent).toBe('body');
  });

  it('renders fenced code blocks verbatim', () => {
    const { container } = render(<Markdown text={'```ts\nconst x = 1;\n```'} />);
    const pre = container.querySelector('pre');
    expect(pre?.textContent).toBe('const x = 1;');
  });

  it('renders inline code, bold, italic', () => {
    const { container } = render(<Markdown text={'use **bold** and *italic* and `code`.'} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('code')?.textContent).toBe('code');
  });

  it('renders ordered and unordered lists', () => {
    const ul = render(<Markdown text={'- a\n- b'} />);
    expect(ul.container.querySelectorAll('ul li').length).toBe(2);
    const ol = render(<Markdown text={'1. a\n2. b'} />);
    expect(ol.container.querySelectorAll('ol li').length).toBe(2);
  });

  it('renders safe links and rejects javascript: schemes', () => {
    const ok = render(<Markdown text={'see [docs](https://example.com)'} />);
    const a = ok.container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('rel')).toContain('noopener');

    const bad = render(<Markdown text={'click [me](javascript:alert(1))'} />);
    expect(bad.container.querySelector('a')).toBeNull();
    expect(bad.container.textContent).toContain('me');
  });

  it('renders blockquote and hr', () => {
    const { container } = render(<Markdown text={'> quoted\n\n---\n\nafter'} />);
    expect(container.querySelector('blockquote')?.textContent).toBe('quoted');
    expect(container.querySelector('[role="separator"]')).not.toBeNull();
  });

  it('does not interpret unmatched delimiters', () => {
    const { container } = render(<Markdown text={'this is *unmatched and ok'} />);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('this is *unmatched and ok');
  });

  it('reflows a soft line break inside a paragraph into a space', () => {
    const { container } = render(<Markdown text={'line1\nline2'} />);
    expect(container.querySelector('p')?.textContent).toBe('line1 line2');
  });

  it('renders two trailing spaces as a hard break element', () => {
    const { container } = render(<Markdown text={'line1  \nline2'} />);
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toBe('line1line2');
    expect(paragraph?.querySelector('br')).not.toBeNull();
  });

  it('preserves newlines in a box-drawing tree paragraph', () => {
    const { container } = render(<Markdown text={'root\n├── child\n└── child'} />);
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toBe('root\n├── child\n└── child');
    expect(paragraph?.className).toContain('whitespace-pre-wrap');
  });

  it('allows a very long unbroken paragraph token to wrap via its class', () => {
    const { container } = render(<Markdown text={'a'.repeat(200)} />);
    expect(container.querySelector('p')?.className).toContain('wrap-anywhere');
  });

  it('renders a pipe table as a real table with header and aligned cells', () => {
    const { container } = render(
      <Markdown text={'| File | Role |\n| --- | ---: |\n| a.ts | edited |'} />,
    );
    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th').length).toBe(2);
    const cells = container.querySelectorAll('td');
    expect(cells[0]?.textContent).toBe('a.ts');
    expect(container.querySelector('th:last-child')?.className).toContain('text-right');
  });
});
