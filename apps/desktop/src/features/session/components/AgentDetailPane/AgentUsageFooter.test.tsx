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
  it('shows the model and cost on one line, and tokens, cache and turns in the detail', () => {
    render(
      <AgentUsageFooter
        aggregate={{ inputTokens: 100000, outputTokens: 1400, estimatedCostUsd: 0.12, turns: 3 }}
        contextUsage={contextUsage}
        turns={3}
      />,
    );

    screen.getByText('Opus 5 · $0.12');
    expect(screen.queryByText(/in ·/)).toBeNull();
    expect(screen.queryByText(/cached/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Usage detail' }));
    screen.getByText('Turns');
    screen.getByText('from cache');
  });

  it('drops the turn count from the detail when it is unknown or zero', () => {
    for (const turns of [null, 0]) {
      render(
        <AgentUsageFooter
          aggregate={{
            inputTokens: 2630000,
            outputTokens: 20800,
            estimatedCostUsd: 1.78,
            turns: 0,
          }}
          contextUsage={contextUsage}
          turns={turns}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Usage detail' }));
      screen.getByText('Input');
      expect(screen.queryByText('Turns')).toBeNull();
      cleanup();
    }
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
    screen.getByText('Input');
    screen.getByText('Output');
  });

  it('says nothing when the agent produced no tokens yet', () => {
    const { container } = render(<AgentUsageFooter aggregate={null} contextUsage={[]} turns={0} />);

    expect(container.firstChild).toBeNull();
  });
});
