// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PageColumn } from '../components/PageColumn';

afterEach(cleanup);

describe('PageColumn', () => {
  it('centres the content column with its gutter and narrows the gutter on a small pane', () => {
    render(
      <PageColumn className="flex flex-col">
        <p>Body copy</p>
      </PageColumn>,
    );
    const column = screen.getByText('Body copy').parentElement as HTMLElement;
    const classes = column.className.split(' ');

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
});
