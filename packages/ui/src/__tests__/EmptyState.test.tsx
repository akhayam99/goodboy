// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Inbox } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('uses distinct small and large scales', () => {
    render(
      <div>
        <EmptyState icon={Inbox} title="Small state" size="sm" />
        <EmptyState icon={Inbox} title="Large state" size="lg" />
      </div>,
    );

    const smallState = screen.getByText('Small state').parentElement?.parentElement;
    const largeState = screen.getByText('Large state').parentElement?.parentElement;

    expect(smallState?.className).toContain('gap-3 px-6 py-10');
    expect(largeState?.className).toContain('gap-6');
  });

  it('renders a requested heading while keeping the default title unheaded', () => {
    render(
      <div>
        <EmptyState icon={Inbox} title="Semantic title" headingLevel={2} />
        <EmptyState icon={Inbox} title="Default title" />
      </div>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Semantic title' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Default title' })).toBeNull();
  });
});
