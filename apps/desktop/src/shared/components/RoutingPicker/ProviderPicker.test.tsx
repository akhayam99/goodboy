// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import { ProviderPicker } from './ProviderPicker';

const connectedProviders = ['anthropic', 'cursor'] as ReadonlyArray<ProviderId>;

afterEach(cleanup);

const renderPicker = ({ onProvider = vi.fn() }: { onProvider?: (id: ProviderId) => void }) =>
  render(
    <ProviderPicker
      connectedProviders={connectedProviders}
      provider="anthropic"
      disabled={false}
      onProvider={onProvider}
      ariaLabel="Default provider"
    />,
  );

const trigger = () => screen.getByRole('combobox', { name: 'Default provider' });

describe('ProviderPicker', () => {
  it('shows the current provider and only the provider dimension', () => {
    renderPicker({});

    expect(trigger().textContent).toContain('Claude');
    fireEvent.click(trigger());
    expect(screen.getByRole('listbox', { name: 'Default provider' })).toBeDefined();
    expect(screen.queryByText('Models')).toBeNull();
    expect(screen.queryByText('Tuning')).toBeNull();
  });

  it('selects a connected provider and closes the picker', () => {
    const onProvider = vi.fn();
    renderPicker({ onProvider });

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Cursor' }));
    expect(onProvider).toHaveBeenCalledWith('cursor');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps disconnected providers visible and says why they are blocked', () => {
    const onProvider = vi.fn();
    renderPicker({ onProvider });

    fireEvent.click(trigger());
    const codex = screen.getByRole('option', { name: /^Codex/ });
    expect(codex.getAttribute('aria-disabled')).toBe('true');
    expect(codex.textContent).toContain('Codex is not connected');
    fireEvent.click(codex);
    expect(onProvider).not.toHaveBeenCalled();
  });
});
