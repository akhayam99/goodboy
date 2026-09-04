import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineMarkdown } from './index';
import { parseInlineMarkdown } from './parseInlineMarkdown';
import { stripInlineMarkdown } from './stripInlineMarkdown';

describe('parseInlineMarkdown', () => {
  it('reads inline code between backticks', () => {
    expect(parseInlineMarkdown({ text: 'run `/explore` now' })).toEqual([
      { kind: 'text', value: 'run ' },
      { kind: 'code', value: '/explore' },
      { kind: 'text', value: ' now' },
    ]);
  });

  it('reads bold with either delimiter', () => {
    expect(parseInlineMarkdown({ text: '**ship** __it__' })).toEqual([
      { kind: 'strong', children: [{ kind: 'text', value: 'ship' }] },
      { kind: 'text', value: ' ' },
      { kind: 'strong', children: [{ kind: 'text', value: 'it' }] },
    ]);
  });

  it('reads italic with either delimiter', () => {
    expect(parseInlineMarkdown({ text: '*soon* _later_' })).toEqual([
      { kind: 'em', children: [{ kind: 'text', value: 'soon' }] },
      { kind: 'text', value: ' ' },
      { kind: 'em', children: [{ kind: 'text', value: 'later' }] },
    ]);
  });

  it('keeps plain text nested inside emphasis', () => {
    expect(parseInlineMarkdown({ text: '**fix `auth` bug**' })).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', value: 'fix ' },
          { kind: 'code', value: 'auth' },
          { kind: 'text', value: ' bug' },
        ],
      },
    ]);
  });

  it('leaves unbalanced markers literal', () => {
    expect(parseInlineMarkdown({ text: 'a `b and **c and *d' })).toEqual([
      { kind: 'text', value: 'a `b and **c and *d' },
    ]);
  });

  it('leaves underscores inside a word literal', () => {
    expect(parseInlineMarkdown({ text: 'rename foo_bar_baz' })).toEqual([
      { kind: 'text', value: 'rename foo_bar_baz' },
    ]);
  });

  it('returns nothing for an empty string', () => {
    expect(parseInlineMarkdown({ text: '' })).toEqual([]);
  });
});

describe('stripInlineMarkdown', () => {
  it('drops the markers and keeps the content', () => {
    expect(stripInlineMarkdown({ text: 'run `/explore` on **auth** _now_' })).toBe(
      'run /explore on auth now',
    );
  });

  it('keeps unbalanced markers', () => {
    expect(stripInlineMarkdown({ text: 'a `b **c' })).toBe('a `b **c');
  });

  it('passes plain text through unchanged', () => {
    expect(stripInlineMarkdown({ text: 'plain title' })).toBe('plain title');
  });
});

describe('InlineMarkdown', () => {
  it('renders backticked text as a code element without the backticks', () => {
    render(<InlineMarkdown text="run `/explore` now" />);

    const code = screen.getByText('/explore');
    expect(code.tagName).toBe('CODE');
    expect(screen.getByText(/run/).textContent).not.toContain('`');
  });

  it('renders bold and italic as strong and em', () => {
    const { container } = render(<InlineMarkdown text="**ship** _it_" />);

    expect(container.querySelector('strong')?.textContent).toBe('ship');
    expect(container.querySelector('em')?.textContent).toBe('it');
  });

  it('applies the className to the wrapper', () => {
    const { container } = render(<InlineMarkdown text="title" className="truncate" />);

    expect(container.firstElementChild?.className).toBe('truncate');
  });
});
