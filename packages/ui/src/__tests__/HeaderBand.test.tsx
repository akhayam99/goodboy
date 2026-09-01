// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HeaderBand } from '../components/HeaderBand';

afterEach(cleanup);

describe('HeaderBand', () => {
  it('renders the title and actions above the meta and subtitle', () => {
    render(
      <HeaderBand
        title="Improve detail layout"
        meta={<span>GB-42</span>}
        subtitle={<span>api/items</span>}
        actions={<a href="https://example.com">Open</a>}
      />,
    );

    const title = screen.getByRole('heading', { level: 2, name: 'Improve detail layout' });
    const meta = screen.getByText('GB-42');
    const subtitle = screen.getByText('api/items');
    const action = screen.getByRole('link', { name: 'Open' });

    expect(title.className).toContain('text-xl');
    expect(title.className).toContain('font-semibold');
    expect(title.className).toContain('leading-snug');
    expect(title.parentElement?.contains(action)).toBe(true);
    expect(title.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(meta.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
