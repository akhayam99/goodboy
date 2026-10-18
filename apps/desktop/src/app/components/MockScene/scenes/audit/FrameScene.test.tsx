// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.resetModules();
  window.history.replaceState({}, '', '/');
});

type ViewParams = {
  readonly view: string;
};

const renderView = async ({ view }: ViewParams) => {
  window.history.replaceState({}, '', `/?scene=frame&view=${view}`);
  vi.resetModules();
  const { FrameScene } = await import('./FrameScene');
  render(<FrameScene />);
};

describe('FrameScene boot views', () => {
  it.each([
    ['boot-start', '0'],
    ['boot', '50'],
    ['boot-end', '83'],
  ])('shows the splash for %s at %s percent', async (view, value) => {
    await renderView({ view });

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(value);
    expect(document.querySelector('[data-brand-tile]')).not.toBeNull();
  });
});
