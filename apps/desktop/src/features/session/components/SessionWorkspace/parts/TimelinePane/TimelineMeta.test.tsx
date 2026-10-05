// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { DONE_ROW_STATE } from '../../../../../workTreeModel/rowState';
import { TimelineAgentMeta } from './TimelineAgentMeta';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowStateLine } from './TimelineRowStateLine';

afterEach(cleanup);

const work: AgentRowWork = {
  routing: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: 'high',
    isEffortObserved: true,
    planned: null,
    isPlanned: false,
  },
  time: undefined,
};

describe('TimelineProviderGlyph', () => {
  it('shows the glyph of a known provider', () => {
    const { container } = render(<TimelineProviderGlyph provider="anthropic" />);

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });
});

describe('TimelineAgentMeta', () => {
  it('carries cost and no model column', () => {
    const { container } = render(
      <TimelineAgentMeta work={work} costUsd={1.5} isRoutingShown={false} />,
    );

    expect(container.querySelector('[data-meta-column="cost"]')?.textContent).toBe('$1.50');
    expect(container.querySelector('[data-meta-column="routing"]')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('keeps the model column where a tree asks for it', () => {
    const { container } = render(<TimelineAgentMeta work={work} costUsd={0} />);

    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('TimelineRowStateLine', () => {
  it('takes no space on a row without a state word', () => {
    const { container } = render(<TimelineRowStateLine state={DONE_ROW_STATE} />);

    expect(container.querySelector('[data-testid="timeline-row-state"]')).toBeNull();
    expect(container.children).toHaveLength(0);
  });
});
