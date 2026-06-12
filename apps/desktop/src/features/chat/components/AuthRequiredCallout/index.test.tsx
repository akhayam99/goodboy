// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { AuthRequiredCallout } from './index';

afterEach(() => {
  cleanup();
});

describe('AuthRequiredCallout', () => {
  it('renders the provider label not signed in', () => {
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={() => undefined} />);
    expect(screen.getByText(/claude is not signed in\./i)).toBeDefined();
  });

  it('shows last known identity when provided', () => {
    render(
      <AuthRequiredCallout providerId="cursor" identity="amin@x.io" onRefresh={() => undefined} />,
    );
    expect(screen.getByText(/last known identity: amin@x\.io/i)).toBeDefined();
  });

  it('dispatches the provider studio event in login mode when Connect is clicked', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-provider-studio', handler);
    render(<AuthRequiredCallout providerId="codex" onRefresh={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /connect now/i }));
    window.removeEventListener('goodboy:open-provider-studio', handler);
    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({ providerId: 'codex', action: 'login' });
  });

  it('calls onRefresh when the Refresh status button is clicked', () => {
    const refresh = vi.fn();
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
