// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const { resolveMock, featuresState } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  featuresState: { SESSION_FEATURES: { budget: true } },
}));

vi.mock('../../../../features/providers/routing', () => ({
  resolveProviderForTurn: resolveMock,
}));
vi.mock('../../../../shared/lib/features', () => featuresState);

import { RoutingIndicator } from './index';

beforeEach(() => {
  resolveMock.mockReset();
  featuresState.SESSION_FEATURES.budget = true;
});
afterEach(cleanup);

describe('RoutingIndicator', () => {
  it('renders nothing while the routing decision is still pending', () => {
    resolveMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(
      <RoutingIndicator
        sessionPreference={null as never}
        turnOverride={undefined}
        connectedProviders={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the all-exceeded fallback when the decision says so', async () => {
    resolveMock.mockResolvedValue({ reason: 'all-exceeded' });
    render(
      <RoutingIndicator
        sessionPreference={null as never}
        turnOverride={undefined}
        connectedProviders={[]}
      />,
    );
    await waitFor(() => screen.getByText(/all provider budgets exceeded/i));
  });

  it('renders the fallback-budget warning with the selected provider', async () => {
    resolveMock.mockResolvedValue({
      reason: 'fallback-budget',
      fallbackFrom: 'anthropic',
      selectedProvider: 'cursor',
      selectedModel: 'cursor-pro',
    });
    render(
      <RoutingIndicator
        sessionPreference={null as never}
        turnOverride={undefined}
        connectedProviders={[]}
      />,
    );
    await waitFor(() => screen.getByTitle('model: cursor-pro'));
    expect(screen.getByText(/budget exceeded for claude/i)).toBeTruthy();
  });
});
