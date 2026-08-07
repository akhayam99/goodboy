// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('@tauri-apps/plugin-shell', () => ({ Command: { create: vi.fn() } }));
vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../shared/lib/editor', () => ({
  openInEditor: vi.fn(),
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { BootSplash } from '../../app/components/BootSplash';

afterEach(cleanup);

describe('BootSplash error recovery', () => {
  it('renders error message and retry button', () => {
    const onRetry = vi.fn();
    render(<BootSplash phase="error" error="db migration failed" onRetry={onRetry} />);
    expect(screen.getByText(/db migration failed/i)).toBeDefined();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeDefined();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers no skip affordance while detecting agents', () => {
    render(<BootSplash phase="detecting-cli" error="cli not found" />);
    expect(screen.queryByRole('button', { name: /skip provider detection/i })).toBeNull();
  });

  it('renders the report issue button', () => {
    render(<BootSplash phase="error" error="oops" />);
    expect(screen.getByRole('button', { name: /report on github/i })).toBeDefined();
  });

  it('error container has role=alert', () => {
    const { container } = render(<BootSplash phase="error" error="crash" />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
  });

  it('no error = no recovery UI', () => {
    render(<BootSplash phase="loading-settings" error={null} />);
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });
});
