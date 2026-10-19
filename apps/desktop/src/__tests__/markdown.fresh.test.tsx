// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Markdown, type FreshTail } from '@goodboy/ui';

afterEach(cleanup);

const tail = (...lengths: ReadonlyArray<number>): FreshTail => ({
  fadeMs: 220,
  rowStaggerMs: 40,
  maxStaggerRows: 3,
  pieces: lengths.map((length, index) => ({ key: index * 100, length })),
});

const freshTexts = (container: HTMLElement): ReadonlyArray<string> =>
  [...container.querySelectorAll('[data-fresh]')].map((span) => span.textContent ?? '');

describe('Markdown fresh tail', () => {
  it('wraps the last characters of the last paragraph, one span per piece', () => {
    const { container } = render(
      <Markdown
        text={'First block stays plain.\n\nHarborline writes this line'}
        fresh={tail(5, 4)}
      />,
    );

    expect(freshTexts(container)).toEqual(['this ', 'line']);
    expect(container.textContent).toBe('First block stays plain.Harborline writes this line');
  });

  it('keeps the rendered text identical with and without the tail', () => {
    const text = '- first item\n- second **bold item** here';
    const plain = render(<Markdown text={text} />);
    const plainText = plain.container.textContent;
    cleanup();
    const faded = render(<Markdown text={text} fresh={tail(3, 6)} />);

    const joined = freshTexts(faded.container).join('');
    expect(faded.container.textContent).toBe(plainText);
    expect(joined).toHaveLength(9);
    expect(plainText?.endsWith(joined)).toBe(true);
  });

  it('reaches into inline elements at the end of the text', () => {
    const { container } = render(<Markdown text={'Ship it with **care today**'} fresh={tail(5)} />);

    expect(freshTexts(container)).toEqual(['today']);
    expect(container.querySelector('strong')?.textContent).toBe('care today');
  });

  it('clamps a tail longer than the last paragraph to what is there', () => {
    const { container } = render(<Markdown text={'Short end'} fresh={tail(40)} />);

    expect(freshTexts(container).join('')).toBe('Short end');
  });

  it('sets the fade duration from the tail, nothing else', () => {
    const { container } = render(<Markdown text={'Fade me'} fresh={tail(2)} />);
    const span = container.querySelector<HTMLElement>('[data-fresh]');

    expect(span?.style.animationDuration).toBe('220ms');
    expect(span?.style.opacity).toBe('');
  });

  it('leaves a code block untouched and wraps nothing without a tail', () => {
    const text = 'Run this:\n\n```sql\nSELECT 1;\n```';
    const { container } = render(<Markdown text={text} fresh={tail(6)} />);
    expect(container.querySelector('pre [data-fresh]')).toBeNull();
    cleanup();
    const bare = render(<Markdown text={'Run this now'} fresh={undefined} />);

    expect(bare.container.querySelector('[data-fresh]')).toBeNull();
  });

  it('staggers the rows of a table by their index, capped, and leaves the layout alone', () => {
    const text =
      '| Step | Time |\n|---|---|\n| Add | 40 ms |\n| Fill | 6 min |\n| Swap | 1 min |\n| Drop | 2 min |';
    const plain = render(<Markdown text={text} />);
    const plainHtml = plain.container
      .querySelector('table')
      ?.outerHTML.replace(/ style="[^"]*"/g, '');
    cleanup();
    const { container } = render(<Markdown text={text} fresh={tail(text.length)} />);
    const rows = [...container.querySelectorAll<HTMLElement>('tbody tr')];

    expect(rows.map((row) => row.style.getPropertyValue('--reveal-delay'))).toEqual([
      '40ms',
      '80ms',
      '120ms',
      '120ms',
    ]);
    expect(
      container.querySelector<HTMLElement>('thead tr')?.style.getPropertyValue('--reveal-delay'),
    ).toBe('');
    expect(container.querySelectorAll('thead [data-fresh]')).toHaveLength(2);
    expect(
      container
        .querySelector('table')
        ?.outerHTML.replace(/<span data-fresh=""[^>]*>|<\/span>|\s*style="[^"]*"/g, ''),
    ).toBe(plainHtml?.replace(/<\/span>/g, ''));
  });

  it('does not repeat a key inside one paragraph when a tail crosses inline elements', () => {
    const { container } = render(
      <Markdown text={'plain `code` and more words'} fresh={tail(12, 4)} />,
    );

    expect(freshTexts(container).join('')).toBe('e and more words');
    expect(container.querySelector('code [data-fresh]')?.textContent).toBe('e');
  });
});
