// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconTile } from '../components/IconTile';

afterEach(cleanup);

describe('IconTile', () => {
  it.each([
    ['xs', 'size-5 rounded-md'],
    ['sm', 'size-7 rounded-md'],
    ['md', 'size-9 rounded-lg'],
    ['lg', 'size-11 rounded-lg'],
  ] as const)('renders the %s size', (size, classes) => {
    render(
      <IconTile size={size}>
        <span role="img" aria-label="mark" />
      </IconTile>,
    );

    expect(screen.getByRole('img', { name: 'mark' }).parentElement?.className).toContain(classes);
  });

  it('renders the tone background, ring, and icon color', () => {
    render(
      <IconTile tone="success">
        <span role="img" aria-label="mark" />
      </IconTile>,
    );

    const className = screen.getByRole('img', { name: 'mark' }).parentElement?.className ?? '';
    expect(['bg-success/10', 'ring-1', 'ring-success/20', 'text-success']).toSatisfy(
      (classes: ReadonlyArray<string>) => classes.every((value) => className.includes(value)),
    );
  });

  it('renders a custom color without a ring by default', () => {
    const markup = renderToStaticMarkup(
      <IconTile color="#ff00aa">
        <span role="img" aria-label="mark" />
      </IconTile>,
    );

    expect(markup).toContain(
      'style="background-color:color-mix(in oklab, #ff00aa 15%, transparent);color:#ff00aa"',
    );
    expect(markup).not.toContain('ring-1');
  });
});
