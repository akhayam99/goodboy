// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BootSplash } from './index';

afterEach(cleanup);

describe('BootSplash recovery controls', () => {
  it('names the error and lets the person retry', () => {
    const retries: number[] = [];
    render(
      <BootSplash phase="error" error="db migration failed" onRetry={() => retries.push(1)} />,
    );

    expect(screen.getByRole('alert').textContent).toContain('db migration failed');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retries).toEqual([1]);
  });

  it('offers no skip affordance while detecting agents', () => {
    render(<BootSplash phase="detecting-cli" error="cli not found" />);

    expect(screen.queryByRole('button', { name: /skip provider detection/i })).toBeNull();
  });

  it('shows no recovery controls without an error', () => {
    render(<BootSplash phase="loading-settings" error={null} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report this' })).toBeNull();
  });
});
