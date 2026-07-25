// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Agent } from '@goodboy/types';
import { AgentMetricsBlock, type AgentAggregate } from '.';

afterEach(cleanup);

const run = {
  id: 'a1',
  startedAt: '2026-05-28T00:00:00Z',
} as unknown as Agent;

const neverStarted = { id: 'a2' } as unknown as Agent;

const aggregate: AgentAggregate = {
  inputTokens: 12000,
  outputTokens: 3000,
  estimatedCostUsd: 0.42,
  turns: 4,
};

describe('AgentMetricsBlock', () => {
  it('renders the cumulative input and output token split', () => {
    render(<AgentMetricsBlock run={run} aggregate={aggregate} />);
    expect(screen.getByTitle('in: 12,000 tokens (cumulative)').textContent).toContain('12');
    expect(screen.getByTitle('out: 3,000 tokens (cumulative)').textContent).toContain('3');
  });

  it('renders a live duration for a started run', () => {
    render(<AgentMetricsBlock run={run} aggregate={aggregate} />);
    expect(screen.getByTitle(/^started 2026-05-28/)).toBeDefined();
  });

  it('never reprints cost or turn count, those live on the inline strip', () => {
    render(<AgentMetricsBlock run={run} aggregate={aggregate} />);
    const block = screen.getByTestId('agent-metrics-block');
    expect(block.textContent).not.toContain('$');
    expect(block.textContent).not.toContain('4t');
  });

  it('renders zeroed tokens for a started run with no telemetry yet', () => {
    render(<AgentMetricsBlock run={run} aggregate={null} />);
    expect(screen.getByTitle('in: 0 tokens (cumulative)')).toBeDefined();
  });

  it('collapses to nothing for a run that never started and burned nothing', () => {
    render(<AgentMetricsBlock run={neverStarted} aggregate={null} />);
    expect(screen.queryByTestId('agent-metrics-block')).toBeNull();
  });
});
