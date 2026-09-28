// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AgentUsageFooter } from './AgentUsageFooter';

afterEach(cleanup);

const contextUsage = [
  {
    provider: 'anthropic' as const,
    model: 'claude-opus-5',
    inputTokens: 100000,
    outputTokens: 1400,
    cachedInputTokens: 90000,
    cacheCreationInputTokens: 2000,
  },
];

describe('AgentUsageFooter', () => {
  it('shows the model, tokens, cached share and cost for the agent', () => {
    render(
      <AgentUsageFooter
        aggregate={{ inputTokens: 100000, outputTokens: 1400, estimatedCostUsd: 0.12, turns: 3 }}
        contextUsage={contextUsage}
        turns={3}
      />,
    );

    expect(screen.getByText('Opus 5')).toBeTruthy();
    expect(screen.getByText(/in ·/)).toBeTruthy();
    expect(screen.getByText('47% cached')).toBeTruthy();
    expect(screen.getByText('~$0.12')).toBeTruthy();
    expect(screen.getByText('3 turns')).toBeTruthy();
  });

  it('never shows $0.00: hides the cost entry when it is unknown', () => {
    render(
      <AgentUsageFooter
        aggregate={{ inputTokens: 100000, outputTokens: 1400, estimatedCostUsd: 0, turns: 1 }}
        contextUsage={contextUsage}
        turns={1}
      />,
    );

    expect(screen.queryByText('~$0.00')).toBeNull();
  });

  it('opens the detail popover on click', () => {
    render(
      <AgentUsageFooter
        aggregate={{ inputTokens: 100000, outputTokens: 1400, estimatedCostUsd: 0.12, turns: 3 }}
        contextUsage={contextUsage}
        turns={3}
      />,
    );

    expect(screen.queryByText('Input')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usage detail' }));
    expect(screen.getByText('Input')).toBeTruthy();
    expect(screen.getByText('Output')).toBeTruthy();
  });

  it('says nothing when the agent produced no tokens yet', () => {
    const { container } = render(<AgentUsageFooter aggregate={null} contextUsage={[]} turns={0} />);

    expect(container.firstChild).toBeNull();
  });
});
