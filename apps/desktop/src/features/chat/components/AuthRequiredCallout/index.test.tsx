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

  it('opens the provider login step inline when Connect is clicked', () => {
    const handler = vi.fn();
    window.addEventListener('goodboy:open-provider-studio', handler);
    render(<AuthRequiredCallout providerId="codex" onRefresh={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /connect now/i }));
    window.removeEventListener('goodboy:open-provider-studio', handler);
    expect(screen.getByText(/Connect codex/i)).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls onRefresh when the Refresh status button is clicked', () => {
    const refresh = vi.fn();
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
