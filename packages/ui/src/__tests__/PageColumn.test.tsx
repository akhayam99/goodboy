// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PageColumn, type PageColumnWidth } from '../components/PageColumn';

afterEach(cleanup);

const classesOf = (text: string) =>
  (screen.getByText(text).parentElement as HTMLElement).className.split(' ');

describe('PageColumn', () => {
  it('centres the content column with its gutter and narrows the gutter on a small pane', () => {
    render(
      <PageColumn className="flex flex-col">
        <p>Body copy</p>
      </PageColumn>,
    );
    const column = screen.getByText('Body copy').parentElement as HTMLElement;
    const classes = classesOf('Body copy');

    expect(classes).toEqual(
      expect.arrayContaining([
        'mx-auto',
        'w-full',
        'max-w-[var(--column-frame)]',
        'px-6',
        '@max-[720px]:px-4',
        'flex',
        'flex-col',
      ]),
    );
    expect(column.hasAttribute('data-page-column')).toBe(true);
  });

  it('caps a reading page at the measure and centres it', () => {
    render(
      <PageColumn width="measure">
        <p>Plan prose</p>
      </PageColumn>,
    );
    const classes = classesOf('Plan prose');

    expect(classes).toEqual(
      expect.arrayContaining(['mx-auto', 'w-full', 'max-w-[var(--measure-frame)]', 'px-6']),
    );
  });

  it('keeps the gutter but drops the cap and the centring when it is full width', () => {
    render(
      <PageColumn width="full">
        <p>Wide copy</p>
      </PageColumn>,
    );
    const classes = classesOf('Wide copy');

    expect(classes).toEqual(expect.arrayContaining(['w-full', 'px-6', '@max-[720px]:px-4']));
    expect(classes).not.toContain('mx-auto');
    expect(classes).not.toContain('max-w-[var(--column-frame)]');
  });

  it('centres column and measure, leaves full on the pane edges, one gutter everywhere', () => {
    const widths: ReadonlyArray<PageColumnWidth> = ['column', 'measure', 'full'];
    render(
      <>
        {widths.map((width) => (
          <PageColumn key={width} width={width}>
            <p>{`edge ${width}`}</p>
          </PageColumn>
        ))}
      </>,
    );
    const gutters = widths.map((width) =>
      classesOf(`edge ${width}`)
        .filter((name) => /^(px|pl|ml|@max-\[720px\]:px)-/.test(name))
        .sort()
        .join(' '),
    );

    expect(new Set(gutters)).toEqual(new Set(['@max-[720px]:px-4 px-6']));
    expect(classesOf('edge column')).toContain('mx-auto');
    expect(classesOf('edge measure')).toContain('mx-auto');
    expect(classesOf('edge full')).not.toContain('mx-auto');
  });
});
