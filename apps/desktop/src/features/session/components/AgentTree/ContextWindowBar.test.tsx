// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextWindowBar } from './ContextWindowBar';

afterEach(cleanup);

describe('ContextWindowBar', () => {
  it('hides legacy usage whose context is unknowable', () => {
    const { container } = render(
      <ContextWindowBar
        usage={[
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 100,
            outputTokens: 10,
            cachedInputTokens: 20,
            cacheCreationInputTokens: 30,
          },
        ]}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('hides usage when the model context window is unknown', () => {
    const { container } = render(
      <ContextWindowBar
        usage={[
          {
            provider: 'anthropic',
            model: 'unknown-model',
            inputTokens: 100,
            outputTokens: 10,
            contextTokens: 110,
          },
        ]}
      />,
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows parser-provided context usage', () => {
    render(
      <ContextWindowBar
        usage={[
          {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5',
            inputTokens: 100,
            outputTokens: 10,
            contextTokens: 110,
          },
        ]}
      />,
    );

    expect(screen.getByText('ctx')).toBeTruthy();
  });
});
