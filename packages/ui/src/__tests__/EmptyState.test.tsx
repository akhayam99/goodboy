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
    expect(smallState?.className).not.toContain('border-dashed');
    expect(smallState?.querySelector('.bg-muted')).toBeTruthy();
    expect(largeState?.className).toContain('gap-6 px-8 py-10');
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

  it('renders inline states without an icon pill or implicit heading', () => {
    render(<EmptyState icon={Inbox} title="Inline state" size="inline" />);

    const state = screen.getByText('Inline state').parentElement?.parentElement;

    expect(state?.className).toContain('items-start gap-2.5 px-3 py-2.5 text-left');
    expect(state?.querySelector('svg')).toBeTruthy();
    expect(state?.querySelector('.size-12')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Inline state' })).toBeNull();
  });
});
