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
  it.each(PROVIDERS)('opens the %s studio', (provider, name) => {
    const studioListener = vi.fn();
    window.addEventListener(`goodboy:open-${provider}-studio`, studioListener);

    render(<ConnectIntegrationEmptyState provider={provider} />);
    expect(screen.getByText(`Connect ${name}`)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    expect(studioListener).toHaveBeenCalledOnce();

    window.removeEventListener(`goodboy:open-${provider}-studio`, studioListener);
  });
});
