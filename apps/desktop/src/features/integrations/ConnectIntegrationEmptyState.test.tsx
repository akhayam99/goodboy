import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

type Store = {
  readonly workspaceIntegrations: Readonly<Record<string, ReadonlyArray<unknown>>>;
  readonly connectLinear: ReturnType<typeof vi.fn>;
  readonly disconnectLinear: ReturnType<typeof vi.fn>;
  readonly connectSentry: ReturnType<typeof vi.fn>;
  readonly disconnectSentry: ReturnType<typeof vi.fn>;
  readonly connectGitlab: ReturnType<typeof vi.fn>;
  readonly disconnectGitlab: ReturnType<typeof vi.fn>;
};

const store: Store = {
  workspaceIntegrations: {},
  connectLinear: vi.fn(),
  disconnectLinear: vi.fn(),
  connectSentry: vi.fn(),
  disconnectSentry: vi.fn(),
  connectGitlab: vi.fn(),
  disconnectGitlab: vi.fn(),
};

vi.mock('../../store', () => ({
  useAppStore: <T,>(selector: (state: Store) => T) => selector(store),
}));

vi.mock('../github/github', () => ({
  ghStatus: vi.fn(async () => ({ scoped: false })),
  ghClearToken: vi.fn(async () => undefined),
}));

import { ConnectIntegrationEmptyState } from './ConnectIntegrationEmptyState';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const PROVIDERS = [
  ['linear', 'Linear', 'Personal access token'],
  ['sentry', 'Sentry', 'Auth token'],
  ['gitlab', 'GitLab', 'Personal access token'],
] as const;

afterEach(cleanup);

describe('ConnectIntegrationEmptyState', () => {
  it.each(PROVIDERS)('renders the %s connection form inline', (provider, name, fieldLabel) => {
    const studioListener = vi.fn();
    window.addEventListener(`goodboy:open-${provider}-studio`, studioListener);

    render(<ConnectIntegrationEmptyState provider={provider} workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText(name)).toBeDefined();
    expect(screen.getByLabelText(fieldLabel)).toBeDefined();
    expect(studioListener).not.toHaveBeenCalled();

    window.removeEventListener(`goodboy:open-${provider}-studio`, studioListener);
  });
});
