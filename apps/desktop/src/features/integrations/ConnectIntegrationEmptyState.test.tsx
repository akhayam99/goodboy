import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectIntegrationEmptyState } from './ConnectIntegrationEmptyState';

const PROVIDERS = [
  ['linear', 'Linear'],
  ['sentry', 'Sentry'],
  ['gitlab', 'GitLab'],
] as const;

afterEach(cleanup);

describe('ConnectIntegrationEmptyState', () => {
  it.each(PROVIDERS)('opens workspace integration settings for %s', (provider, name) => {
    const workspaceSettingsListener = vi.fn();
    const appSettingsListener = vi.fn();
    window.addEventListener('goodboy:open-workspace-settings', workspaceSettingsListener);
    window.addEventListener('goodboy:open-settings', appSettingsListener);

    render(<ConnectIntegrationEmptyState provider={provider} />);
    expect(screen.getByText(`Connect ${name}`)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(workspaceSettingsListener).toHaveBeenCalledOnce();
    expect((workspaceSettingsListener.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      section: 'integrations',
    });
    expect(appSettingsListener).not.toHaveBeenCalled();

    window.removeEventListener('goodboy:open-workspace-settings', workspaceSettingsListener);
    window.removeEventListener('goodboy:open-settings', appSettingsListener);
  });
});
