// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MetaGrid } from '../components/MetaGrid';

afterEach(cleanup);

describe('MetaGrid', () => {
  it('renders every attribute as a label and value pair', () => {
    render(
      <MetaGrid
        items={[
          { label: 'State', value: 'open' },
          { label: 'Author', value: 'ada' },
        ]}
      />,
    );

    expect(screen.getByText('State')).toBeDefined();
    expect(screen.getByText('open')).toBeDefined();
    expect(screen.getByText('Author')).toBeDefined();
    expect(screen.getByText('ada')).toBeDefined();
  });

  it('drops the attributes a heterogeneous schema does not carry', () => {
    render(
      <MetaGrid
        items={[
          { label: 'State', value: 'open' },
          { label: 'Milestone', value: null },
          { label: 'Assignee', value: '' },
        ]}
      />,
    );

    expect(screen.getByText('State')).toBeDefined();
    expect(screen.queryByText('Milestone')).toBeNull();
    expect(screen.queryByText('Assignee')).toBeNull();
  });

  it('falls back to the empty label when nothing is present', () => {
    render(<MetaGrid items={[{ label: 'State', value: null }]} emptyLabel="Nothing to show" />);

    expect(screen.getByText('Nothing to show')).toBeDefined();
  });
});
