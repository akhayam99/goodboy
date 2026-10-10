// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WORK_META_COLUMN } from '@goodboy/ui';
import { carriesSpec } from '../../../test/classTokens';
import { RoutingModelBlock } from './index';

afterEach(cleanup);

const partOf = (container: HTMLElement, part: 'name' | 'detail'): string | null =>
  container.querySelector(`[data-routing-part="${part}"]`)?.textContent ?? null;

describe('RoutingModelBlock', () => {
  it('puts the model on the first line and its effort on the second', () => {
    const { container } = render(
      <RoutingModelBlock provider="anthropic" model="claude-sonnet-5" effort="high" />,
    );

    const column = container.querySelector('[data-meta-column="model"]');
    expect(container.querySelectorAll('[data-meta-column]')).toHaveLength(1);
    expect(carriesSpec({ element: column, spec: WORK_META_COLUMN.model })).toBe(true);
    expect(partOf(container, 'name')).toBe('Sonnet 5');
    expect(partOf(container, 'detail')).toBe('High');
  });

  it('shows only the first detail and leaves the rest to the tooltip', () => {
    const { container } = render(
      <RoutingModelBlock
        provider="cursor"
        model="claude-4.6-sonnet-medium-thinking"
        effort="medium"
      />,
    );

    expect(container.querySelectorAll('[data-routing-part="detail"]')).toHaveLength(1);
    expect(partOf(container, 'detail')).toBe('Thinking');
  });

  it('holds the column empty when nothing is routed yet', () => {
    const { container } = render(<RoutingModelBlock />);

    expect(container.textContent).toBe('');
    expect(container.querySelectorAll('[data-meta-column="model"]')).toHaveLength(1);
  });

  it('keeps the provider glyph before the lines', () => {
    const { container } = render(
      <RoutingModelBlock provider="anthropic" model="claude-sonnet-5" effort="high" />,
    );

    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('underlines a diverged row and keeps the plan in the tooltip', () => {
    const { getByTestId } = render(
      <RoutingModelBlock
        provider="anthropic"
        model="claude-sonnet-5"
        planned={{ provider: 'anthropic', model: 'claude-opus-5' }}
      />,
    );

    expect(getByTestId('routing-divergence').getAttribute('data-meta-column')).toBe('model');
  });
});
