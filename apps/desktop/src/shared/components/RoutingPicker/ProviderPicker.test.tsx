// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { ProviderPicker } from './ProviderPicker';

const connectedProviders = ['anthropic', 'cursor'] as ReadonlyArray<ProviderId>;

afterEach(cleanup);

describe('ProviderPicker', () => {
  it('shows only the provider dimension', () => {
    render(
      <ProviderPicker
        connectedProviders={connectedProviders}
        provider="anthropic"
        disabled={false}
        onProvider={vi.fn()}
        ariaLabel="Default provider"
      />,
    );

    expect(screen.getByRole('button', { name: 'Default provider: Claude' }).textContent).toContain(
      'Claude',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Default provider: Claude' }));
    expect(screen.getByText('Provider')).toBeDefined();
    expect(screen.queryByText('Models')).toBeNull();
    expect(screen.queryByText('Tuning')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add provider' })).toBeNull();
  });

  it('selects a connected provider and closes the picker', () => {
    const onProvider = vi.fn();
    render(
      <ProviderPicker
        connectedProviders={connectedProviders}
        provider="anthropic"
        disabled={false}
        onProvider={onProvider}
        ariaLabel="Default provider"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Default provider: Claude' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cursor' }));
    expect(onProvider).toHaveBeenCalledWith('cursor');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps disconnected providers visible and unavailable', () => {
    render(
      <ProviderPicker
        connectedProviders={connectedProviders}
        provider="anthropic"
        disabled={false}
        onProvider={vi.fn()}
        ariaLabel="Default provider"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Default provider: Claude' }));
    const codex = screen.getByRole('button', { name: 'Codex' });
    expect(codex.hasAttribute('disabled')).toBe(true);
    expect(codex.getAttribute('title')).toBe('Codex is not connected');
  });
});
