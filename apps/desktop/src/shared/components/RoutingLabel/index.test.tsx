// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WORK_META_COLUMN } from '@goodboy/ui';
import { tooltipTextOf } from '../../../__tests__/helpers/tooltip';
import { RoutingLabel } from './index';

afterEach(cleanup);

const partOf = (container: HTMLElement, part: 'name' | 'detail'): string | null =>
  container.querySelector(`[data-routing-part="${part}"]`)?.textContent ?? null;

describe('RoutingLabel', () => {
  it('shows the authored label instead of the raw catalog id', () => {
    render(<RoutingLabel provider="anthropic" model="claude-sonnet-4-5" />);

    expect(screen.getByText('Sonnet 4.5')).toBeDefined();
    expect(screen.queryByText('claude-sonnet-4-5')).toBeNull();
  });

  it('reads the model and its effort as one token, glyph first', () => {
    const { container } = render(
      <RoutingLabel provider="anthropic" model="claude-sonnet-5" effort="high" />,
    );

    const glyph = container.querySelector('svg');
    const name = screen.getByText('Sonnet 5');
    expect(glyph).not.toBeNull();
    expect(
      (glyph as Element).compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(partOf(container, 'detail')).toBe('High');
  });

  it('names the codex variant as part of the model, like the picker trigger', () => {
    const { container } = render(
      <RoutingLabel provider="codex" model="gpt-5.6-sol" effort="high" />,
    );

    expect(partOf(container, 'name')).toBe('GPT 5.6 Sol');
    expect(partOf(container, 'detail')).toBe('High');
  });

  it('puts the provider glyph after the model when the cluster is right aligned', () => {
    const { container } = render(
      <RoutingLabel provider="anthropic" model="claude-sonnet-4-5" glyphPlacement="trailing" />,
    );

    expect(container.querySelector('span')?.lastElementChild?.tagName.toLowerCase()).toBe('svg');
  });

  it('clamps an effort the model does not support', () => {
    render(<RoutingLabel provider="anthropic" model="claude-sonnet-4-5" effort="max" />);

    expect(screen.queryByText('Max')).toBeNull();
    expect(screen.getByText('High')).toBeDefined();
  });

  it('says the model is not chosen yet when nothing is routed', () => {
    render(<RoutingLabel />);

    expect(screen.getByText('Model not chosen yet')).toBeDefined();
  });

  it('keeps the whole route in the tooltip', () => {
    render(<RoutingLabel provider="anthropic" model="claude-opus-4-5" effort="high" />);

    expect(tooltipTextOf({ element: screen.getByText('Opus 4.5').parentElement! })).toBe(
      'Claude · Opus 4.5 · High',
    );
  });

  it('stays silent when the executed routing matches the plan', () => {
    render(
      <RoutingLabel
        provider="anthropic"
        model="claude-sonnet-4-5"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-4-5' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('underlines the whole cell and names the plan in one tooltip, with no strike through', () => {
    render(
      <RoutingLabel
        isColumn
        provider="anthropic"
        model="claude-sonnet-5"
        effort="medium"
        planned={{ provider: 'anthropic', model: 'claude-opus-5', effort: 'high' }}
      />,
    );

    const cell = screen.getByTestId('routing-divergence');
    expect(cell.getAttribute('data-meta-column')).toBe('routing');
    expect(cell.className).toContain('decoration-dotted');
    expect(cell.innerHTML).not.toContain('line-through');
    expect(tooltipTextOf({ element: cell })).toBe(
      'Claude · Sonnet 5 · Medium. Planned Opus 5 High, routing picked Sonnet 5 Medium',
    );
  });

  it('flags a provider move even when only the provider diverged', () => {
    render(
      <RoutingLabel
        provider="cursor"
        model="claude-4.6-sonnet-medium-thinking"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-4-6' }}
      />,
    );

    expect(tooltipTextOf({ element: screen.getByTestId('routing-divergence') })).toContain(
      'Planned on Claude, routing picked Cursor',
    );
  });

  it('reads a catalog key and the cli id it executes as the same model', () => {
    render(
      <RoutingLabel
        provider="anthropic"
        model="claude-sonnet-5"
        planned={{ provider: 'anthropic', model: 'sonnet-5' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('keeps two cursor efforts of the same model out of the divergence', () => {
    render(
      <RoutingLabel
        provider="cursor"
        model="claude-sonnet-5-high"
        planned={{ provider: 'cursor', model: 'claude-sonnet-5-xhigh' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  it('names an observed effort that left the plan', () => {
    render(
      <RoutingLabel
        isColumn
        provider="anthropic"
        model="claude-sonnet-5"
        effort="medium"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-5', effort: 'high' }}
        isEffortObserved
      />,
    );

    expect(tooltipTextOf({ element: screen.getByTestId('routing-divergence') })).toBe(
      'Claude · Sonnet 5 · Medium. Planned High, ran Medium',
    );
  });

  it('never names a divergence for an effort nobody observed', () => {
    render(
      <RoutingLabel
        isColumn
        provider="anthropic"
        model="claude-sonnet-5"
        effort="medium"
        planned={{ provider: 'anthropic', model: 'claude-sonnet-5', effort: 'high' }}
      />,
    );

    expect(screen.queryByTestId('routing-divergence')).toBeNull();
  });

  describe('as a row column', () => {
    it('is one routing column holding the model and one detail, with no chip fill', () => {
      const { container } = render(
        <RoutingLabel isColumn provider="anthropic" model="claude-sonnet-5" effort="high" />,
      );

      expect(container.querySelectorAll('[data-meta-column]')).toHaveLength(1);
      expect(partOf(container, 'name')).toBe('Sonnet 5');
      expect(partOf(container, 'detail')).toBe('High');
      expect(container.innerHTML).not.toContain('bg-muted');
    });

    it('shows only the first detail and leaves the rest to the tooltip', () => {
      const { container } = render(
        <RoutingLabel
          isColumn
          provider="cursor"
          model="claude-4.6-sonnet-medium-thinking"
          effort="medium"
        />,
      );

      expect(container.querySelectorAll('[data-routing-part="detail"]')).toHaveLength(1);
      expect(partOf(container, 'detail')).toBe('Thinking');
    });

    it('sheds the detail, then the name, then the whole cell as the row narrows', () => {
      const { container } = render(
        <RoutingLabel isColumn provider="anthropic" model="claude-sonnet-5" effort="high" />,
      );

      const cell = container.querySelector('[data-meta-column="routing"]')!;
      const name = container.querySelector('[data-routing-part="name"]')!;
      const detail = container.querySelector('[data-routing-part="detail"]')!.parentElement!;
      expect(detail.className).toContain('@max-[720px]:sr-only');
      expect(name.className).toContain('@max-[440px]:sr-only');
      expect(cell.className).toContain('@max-[440px]:w-3');
      expect(cell.className).toContain('@max-[360px]:hidden');
      expect(WORK_META_COLUMN.cost).toContain('@max-[560px]:hidden');
      expect(WORK_META_COLUMN.time).toContain('@max-[360px]:hidden');
    });

    it('draws a planned effort in faint and an observed one in the row tone', () => {
      const { container, rerender } = render(
        <RoutingLabel isColumn provider="anthropic" model="claude-sonnet-5" effort="high" />,
      );
      const detailOf = () =>
        container.querySelector('[data-routing-part="detail"]')!.parentElement!;
      expect(detailOf().className).toContain('text-faint-foreground');

      rerender(
        <RoutingLabel
          isColumn
          provider="anthropic"
          model="claude-sonnet-5"
          effort="high"
          isEffortObserved
        />,
      );
      expect(detailOf().className).not.toContain('text-faint-foreground');
    });

    it('holds the column empty when nothing is routed yet', () => {
      const { container } = render(<RoutingLabel isColumn />);

      expect(container.textContent).toBe('');
      expect(container.children).toHaveLength(1);
    });
  });
});
