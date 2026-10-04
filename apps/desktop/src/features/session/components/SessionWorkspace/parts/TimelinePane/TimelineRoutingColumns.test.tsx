// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { DONE_ROW_STATE } from '../../../../../workTreeModel/rowState';
import { TimelineAgentMeta } from './TimelineAgentMeta';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRouting, type TimelineRoutingFacts } from './timelineRouting';

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

const single: TimelineRoutingFacts = { isMultiProvider: false, modelShownAgentIds: new Set() };
const mixed: TimelineRoutingFacts = {
  isMultiProvider: true,
  modelShownAgentIds: new Set(['odd']),
};

const nameOf = (container: HTMLElement): Element | null =>
  container.querySelector('[data-routing-part="name"]');

describe('TimelineProviderGlyph', () => {
  it('shows the glyph with no facts, like every list outside the activity', () => {
    const { container } = render(<TimelineProviderGlyph provider="anthropic" />);

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });

  it('hides the glyph while the session uses one provider', () => {
    const { container } = render(
      <TimelineRouting.Provider value={single}>
        <TimelineProviderGlyph provider="anthropic" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('[data-provider]')).toBeNull();
  });

  it('shows the glyph once the session uses two providers', () => {
    const { container } = render(
      <TimelineRouting.Provider value={mixed}>
        <TimelineProviderGlyph provider="anthropic" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });
});

describe('TimelineAgentMeta routing column', () => {
  it('shows glyph and name with no facts', () => {
    const { container } = render(<TimelineAgentMeta work={work} costUsd={0} agentId="same" />);

    expect(container.querySelector('svg')).not.toBeNull();
    expect(nameOf(container)?.classList.contains('sr-only')).toBe(false);
  });

  it('drops the glyph and the name of a row that matches its group', () => {
    const { container } = render(
      <TimelineRouting.Provider value={single}>
        <TimelineAgentMeta work={work} costUsd={0} agentId="same" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('svg')).toBeNull();
    expect(nameOf(container)?.classList.contains('sr-only')).toBe(true);
  });

  it('keeps the name of the row that differs from its group', () => {
    const { container } = render(
      <TimelineRouting.Provider value={mixed}>
        <TimelineAgentMeta work={work} costUsd={0} agentId="odd" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(nameOf(container)?.classList.contains('sr-only')).toBe(false);
  });
});

describe('TimelineRowStateLine', () => {
  it('takes no space on a row without a state word', () => {
    const { container } = render(<TimelineRowStateLine state={DONE_ROW_STATE} />);

    expect(container.querySelector('[data-testid="timeline-row-state"]')).toBeNull();
    expect(container.children).toHaveLength(0);
  });
});
