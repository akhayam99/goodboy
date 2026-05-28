// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { loginProviderMock } = vi.hoisted(() => ({
  loginProviderMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { loginProvider: typeof loginProviderMock }) => T) =>
    selector({ loginProvider: loginProviderMock }),
}));

import { AuthRequiredCallout } from './index';

afterEach(() => {
  cleanup();
  loginProviderMock.mockClear();
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

  it('invokes loginProvider when Connect is clicked', () => {
    render(<AuthRequiredCallout providerId="codex" onRefresh={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: /connect now/i }));
    expect(loginProviderMock).toHaveBeenCalledWith('codex');
  });

  it('calls onRefresh when the Refresh status button is clicked', () => {
    const refresh = vi.fn();
    render(<AuthRequiredCallout providerId="anthropic" onRefresh={refresh} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
