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

  it('pins the canonical order in the full variant: model, then provider, then effort', () => {
    const { container } = render(
      <RoutingBadge variant="full" provider="anthropic" model="claude-opus-4-5" effort="high" />,
    );

    const text = container.textContent ?? '';
    const modelIndex = text.indexOf('Opus 4.5');
    const providerIndex = text.indexOf('Claude');
    const effortIndex = text.indexOf('High');

    expect(modelIndex).toBeGreaterThanOrEqual(0);
    expect(modelIndex).toBeLessThan(providerIndex);
    expect(providerIndex).toBeLessThan(effortIndex);
  });

  it('pins the canonical order in the compact variant: model, then provider, then effort', () => {
    const { container } = render(
      <RoutingBadge provider="anthropic" model="claude-opus-4-5" effort="high" />,
    );

    const modelSpan = screen.getByTitle('model: claude-opus-4-5');
    const glyph = container.querySelector('svg');
    const effortSpan = screen.getByTitle('effort');

    expect(glyph).not.toBeNull();
    expect(
      modelSpan.compareDocumentPosition(glyph as Element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      (glyph as Element).compareDocumentPosition(effortSpan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
