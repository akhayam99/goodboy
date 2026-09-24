// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import { RoutingBadge } from './index';

afterEach(cleanup);

describe('RoutingBadge', () => {
  it('shows the authored label instead of the raw catalog id', () => {
    render(<RoutingBadge provider="anthropic" model="claude-sonnet-4-5" />);

    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.queryByText('claude-sonnet-4-5')).toBeNull();
  });

  it('puts the provider glyph after the model when the cluster is right aligned', () => {
    const { container } = render(
      <RoutingBadge provider="anthropic" model="claude-sonnet-4-5" glyphPlacement="trailing" />,
    );
    const badge = container.firstElementChild!;
    const model = screen.getByText('Sonnet 4.5');

    expect(badge.lastElementChild).not.toBe(model);
    expect(badge.firstElementChild).toBe(model);
  });

  it('leads with the glyph by default', () => {
    const { container } = render(<RoutingBadge provider="anthropic" model="claude-sonnet-4-5" />);
    const badge = container.firstElementChild!;

    expect(badge.firstElementChild).not.toBe(screen.getByText('Sonnet 4.5'));
  });

  it('keeps the raw id reachable as the title for support', () => {
    render(<RoutingBadge provider="anthropic" model="claude-sonnet-4-5" />);

    expect(screen.getByTitle('Model: claude-sonnet-4-5')).toBeDefined();
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

  it('says the model is not chosen yet when nothing is routed', () => {
    render(<RoutingBadge />);

    expect(screen.getByText('Model not chosen yet')).toBeDefined();
  });

  it('infers the provider from the model when it is not given', () => {
    render(<RoutingBadge variant="full" model="claude-sonnet-4-5" />);

    expect(screen.getByText('Claude')).toBeDefined();
  });

  it('pins the canonical order in the full variant: provider, then model, then effort', () => {
    const { container } = render(
      <RoutingBadge variant="full" provider="anthropic" model="claude-opus-4-5" effort="high" />,
    );

    const text = container.textContent ?? '';
    const providerIndex = text.indexOf('Claude');
    const modelIndex = text.indexOf('Opus 4.5');
    const effortIndex = text.indexOf('High');

    expect(providerIndex).toBeGreaterThanOrEqual(0);
    expect(providerIndex).toBeLessThan(modelIndex);
    expect(modelIndex).toBeLessThan(effortIndex);
  });

  it('stays silent when the executed routing matches the plan', () => {
    render(
      <RoutingBadge
        provider="anthropic"
        model="claude-sonnet-4-5"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-4-5' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('names the plan the executed routing replaced', () => {
    render(
      <RoutingBadge
        provider="codex"
        model="gpt-5.1-codex"
        planned={{ provider: 'anthropic', model: 'claude-haiku-4-5' }}
      />,
    );

    const note = screen.getByTestId('routing-divergence');
    expect(note.textContent).toBe('Haiku 4.5');
    expect(note.className).toContain('line-through');
    expect(tooltipTextOf({ element: note })).toBe(
      'Planned Haiku 4.5, routing picked GPT Codex 5.1 instead',
    );
  });

  it('flags a provider move even when only the provider diverged', () => {
    render(
      <RoutingBadge
        provider="cursor"
        model="claude-4.6-sonnet-medium-thinking"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );

    const note = screen.getByTestId('routing-divergence');
    expect(note.textContent).toBe('Claude');
    expect(tooltipTextOf({ element: note })).toBe(
      'Planned on Claude, routing picked Cursor instead',
    );
  });

  it('keeps the plan out of the badge while the step has not run', () => {
    render(
      <RoutingBadge
        provider="anthropic"
        model="claude-haiku-4-5"
        planned={{ provider: 'anthropic', model: 'claude-haiku-4-5' }}
      />,
    );

    expect(screen.getByText('Haiku 4.5')).toBeDefined();
    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('renders the divergence as its own chip in the full variant', () => {
    render(
      <RoutingBadge
        variant="full"
        provider="codex"
        model="gpt-5.1-codex"
        planned={{ provider: 'anthropic', model: 'claude-haiku-4-5' }}
      />,
    );

    expect(screen.getByTestId('routing-divergence').textContent).toBe('Haiku 4.5');
  });

  it('leads the compact variant with the provider mark, like the routing trigger does', () => {
    const { container } = render(
      <RoutingBadge provider="anthropic" model="claude-opus-4-5" effort="high" />,
    );

    const modelSpan = screen.getByTitle('Model: claude-opus-4-5');
    const glyph = container.querySelector('svg');
    const effortSpan = screen.getByTitle('Effort');

    expect(glyph).not.toBeNull();
    expect(
      (glyph as Element).compareDocumentPosition(modelSpan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      modelSpan.compareDocumentPosition(effortSpan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('reads a catalog key and the cli id it executes as the same model', () => {
    render(
      <RoutingBadge
        provider="anthropic"
        model="claude-sonnet-5"
        planned={{ provider: 'anthropic', model: 'sonnet-5' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('reads a cursor combo slug and the catalog key as the same model', () => {
    render(
      <RoutingBadge
        provider="cursor"
        model="claude-sonnet-5-xhigh"
        planned={{ provider: 'cursor', model: 'sonnet-5' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('keeps two cursor efforts of the same model out of the divergence note', () => {
    render(
      <RoutingBadge
        provider="cursor"
        model="claude-sonnet-5-high"
        planned={{ provider: 'cursor', model: 'claude-sonnet-5-xhigh' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  describe('bare variant', () => {
    it('lays the model and the effort out as meta columns with no chip fill', () => {
      const { container } = render(
        <RoutingBadge variant="bare" provider="anthropic" model="claude-opus-4-5" effort="high" />,
      );

      const model = container.querySelector('[data-meta-column="model"]');
      const effort = container.querySelector('[data-meta-column="effort"]');
      expect(model?.textContent).toBe('Opus 4.5');
      expect(effort?.textContent).toBe('High');
      expect(container.innerHTML).not.toContain('bg-muted');
    });

    it('keeps the whole route in the tooltip so a narrow pane loses nothing', () => {
      render(
        <RoutingBadge variant="bare" provider="anthropic" model="claude-opus-4-5" effort="high" />,
      );

      const model = screen.getByText('Opus 4.5').parentElement!;
      expect(tooltipTextOf({ element: model })).toBe('Opus 4.5 High on Claude');
    });

    it('names a divergence in the tooltip instead of striking the plan through', () => {
      render(
        <RoutingBadge
          variant="bare"
          provider="anthropic"
          model="claude-opus-4-5"
          planned={{ provider: 'anthropic', model: 'claude-sonnet-4-5' }}
        />,
      );

      const label = screen.getByTestId('routing-divergence');
      expect(label.className).toContain('decoration-dotted');
      expect(tooltipTextOf({ element: label.parentElement! })).toBe(
        'Opus 4.5 on Claude. Planned Sonnet 4.5, routing picked Opus 4.5 instead',
      );
    });

    it('holds both columns empty when nothing is routed yet', () => {
      const { container } = render(<RoutingBadge variant="bare" />);

      expect(container.textContent).toBe('');
      expect(container.children).toHaveLength(2);
    });
  });
});
