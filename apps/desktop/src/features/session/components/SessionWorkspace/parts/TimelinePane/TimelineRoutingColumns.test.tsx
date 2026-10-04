// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { DONE_ROW_STATE } from '../../../../../workTreeModel/rowState';
import { TimelineAgentMeta } from './TimelineAgentMeta';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { TimelineRowStateLine } from './TimelineRowStateLine';
import { TimelineRouting, type TimelineRoutingFacts } from './timelineRouting';

vi.mock('../../../../../../shared/components/RoutingLabel', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../../../../shared/components/RoutingLabel')>();
  return {
    RoutingLabel: (props: Parameters<typeof actual.RoutingLabel>[0]) => (
      <span data-testid="routing" data-hide-name={String(props.hideName)}>
        {actual.RoutingLabel(props)}
      </span>
    ),
  };
});

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

const matching: TimelineRoutingFacts = { modelShownAgentIds: new Set() };
const odd: TimelineRoutingFacts = { modelShownAgentIds: new Set(['odd']) };

const nameHiddenOf = (container: HTMLElement) =>
  container.querySelector('[data-testid="routing"]')?.getAttribute('data-hide-name');

describe('TimelineProviderGlyph', () => {
  it('shows the glyph with no facts', () => {
    const { container } = render(<TimelineProviderGlyph provider="anthropic" />);

    expect(container.querySelector('[data-provider="anthropic"]')).not.toBeNull();
  });

  it('shows the glyph while the session uses one provider', () => {
    const { container } = render(
      <TimelineRouting.Provider value={matching}>
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
    expect(nameHiddenOf(container)).toBe('false');
  });

  it('keeps the glyph and drops the name of a row that matches its group', () => {
    const { container } = render(
      <TimelineRouting.Provider value={matching}>
        <TimelineAgentMeta work={work} costUsd={0} agentId="same" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(nameHiddenOf(container)).toBe('true');
  });

  it('keeps glyph and name on the row that differs from its group', () => {
    const { container } = render(
      <TimelineRouting.Provider value={odd}>
        <TimelineAgentMeta work={work} costUsd={0} agentId="odd" />
      </TimelineRouting.Provider>,
    );

    expect(container.querySelector('svg')).not.toBeNull();
    expect(nameHiddenOf(container)).toBe('false');
  });
});

describe('TimelineRowStateLine', () => {
  it('takes no space on a row without a state word', () => {
    const { container } = render(<TimelineRowStateLine state={DONE_ROW_STATE} />);

    expect(container.querySelector('[data-testid="timeline-row-state"]')).toBeNull();
    expect(container.children).toHaveLength(0);
  });
});
