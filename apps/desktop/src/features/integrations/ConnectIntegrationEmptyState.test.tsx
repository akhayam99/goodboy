import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

type Store = {
  readonly workspaces: ReadonlyArray<{ id: string; name: string }>;
  readonly workspaceIntegrations: Readonly<Record<string, ReadonlyArray<unknown>>>;
  readonly declinedIntegrationReuse: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly connectLinear: ReturnType<typeof vi.fn>;
  readonly disconnectLinear: ReturnType<typeof vi.fn>;
  readonly connectSentry: ReturnType<typeof vi.fn>;
  readonly disconnectSentry: ReturnType<typeof vi.fn>;
  readonly connectGitlab: ReturnType<typeof vi.fn>;
  readonly disconnectGitlab: ReturnType<typeof vi.fn>;
  readonly reuseIntegration: ReturnType<typeof vi.fn>;
  readonly declineIntegrationReuse: ReturnType<typeof vi.fn>;
};

const store: Store = {
  workspaces: [],
  workspaceIntegrations: {},
  declinedIntegrationReuse: {},
  connectLinear: vi.fn(),
  disconnectLinear: vi.fn(),
  connectSentry: vi.fn(),
  disconnectSentry: vi.fn(),
  connectGitlab: vi.fn(),
  disconnectGitlab: vi.fn(),
  reuseIntegration: vi.fn(),
  declineIntegrationReuse: vi.fn(),
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
  ['linear', 'Linear', 'Personal API key'],
  ['sentry', 'Sentry', 'Personal API key'],
  ['gitlab', 'GitLab', 'Personal API key'],
  ['jira', 'Jira', 'Personal API key'],
  ['bitbucket', 'Bitbucket', 'Personal API key'],
  ['slack', 'Slack', 'Bot token'],
] as const;

afterEach(cleanup);

describe('ConnectIntegrationEmptyState', () => {
  it.each(PROVIDERS)('renders the %s connection form inline', (provider, name, fieldLabel) => {
    const studioListener = vi.fn();
    window.addEventListener(`goodboy:open-${provider}-studio`, studioListener);

    render(<ConnectIntegrationEmptyState provider={provider} workspaceId={WORKSPACE_ID} />);

    expect(screen.getByText(name)).toBeDefined();
    const field = screen.getByLabelText(fieldLabel);
    expect(field).toBeDefined();
    expect(field).not.toBe(document.activeElement);
    expect(screen.getByRole('heading', { name, level: 2 })).toBeDefined();
    expect(studioListener).not.toHaveBeenCalled();

    window.removeEventListener(`goodboy:open-${provider}-studio`, studioListener);
  });

  const PERSONAL_KEY_PROVIDERS = PROVIDERS.filter(([provider]) => provider !== 'slack');

  it.each(PERSONAL_KEY_PROVIDERS)(
    'labels the %s credential field a personal API key, never a token',
    (provider) => {
      render(<ConnectIntegrationEmptyState provider={provider} workspaceId={WORKSPACE_ID} />);

      expect(screen.getByLabelText('Personal API key')).toBeDefined();
      expect(screen.queryByLabelText(/access token|auth token|api token/i)).toBeNull();
    },
  );

  it('keeps the Slack credential a bot token, because it belongs to an app and not a person', () => {
    render(<ConnectIntegrationEmptyState provider="slack" workspaceId={WORKSPACE_ID} />);

    expect(screen.getByLabelText('Bot token')).toBeDefined();
    expect(screen.queryByLabelText('Personal API key')).toBeNull();
  });
});
