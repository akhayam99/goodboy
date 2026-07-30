// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RoutingBadge } from './index';

afterEach(cleanup);

describe('RoutingBadge', () => {
  it('shows the authored label instead of the raw catalog id', () => {
    render(<RoutingBadge provider="anthropic" model="claude-sonnet-4-5" />);

    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.queryByText('claude-sonnet-4-5')).toBeNull();
  });

  it('keeps the raw id reachable as the title for support', () => {
    render(<RoutingBadge provider="anthropic" model="claude-sonnet-4-5" />);

    expect(screen.getByTitle('model: claude-sonnet-4-5')).toBeDefined();
  });

  it('renders provider, model and effort as separate chips in the full variant', () => {
    render(
      <RoutingBadge variant="full" provider="anthropic" model="claude-opus-4-5" effort="high" />,
    );

    expect(screen.getByText('Claude')).toBeDefined();
    expect(screen.getByText('Opus 4.5')).toBeDefined();
    expect(screen.getByText('High')).toBeDefined();
  });

  it('clamps an effort the model does not support', () => {
    render(
      <RoutingBadge variant="full" provider="anthropic" model="claude-sonnet-4-5" effort="max" />,
    );

    expect(screen.queryByText('Max')).toBeNull();
    expect(screen.getByText('High')).toBeDefined();
  });

  it('falls back to the missing label when no model is routed yet', () => {
    render(<RoutingBadge missingLabel="no model yet" />);

    expect(screen.getByText('no model yet')).toBeDefined();
  });

  it('infers the provider from the model when it is not given', () => {
    render(<RoutingBadge variant="full" model="claude-sonnet-4-5" />);

    expect(screen.getByText('Claude')).toBeDefined();
  });
});
