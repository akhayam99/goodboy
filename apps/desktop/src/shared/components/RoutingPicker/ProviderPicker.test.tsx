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

  it('hides disconnected providers that are not selected', () => {
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
    expect(screen.queryByRole('button', { name: 'Codex' })).toBeNull();
  });

  it('keeps a disconnected current provider visible and marked', () => {
    render(
      <ProviderPicker
        connectedProviders={['cursor']}
        provider="anthropic"
        disabled={false}
        onProvider={vi.fn()}
        ariaLabel="Default provider"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Default provider: Claude' }));
    const claude = screen.getByRole('button', { name: 'Claude, disconnected' });
    expect(claude.hasAttribute('disabled')).toBe(true);
    expect(claude.getAttribute('title')).toBe('Claude is not connected');
  });
});
