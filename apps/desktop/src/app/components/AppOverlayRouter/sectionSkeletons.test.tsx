// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { lazy } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LazyPaletteOverlay } from './LazyPaletteOverlay';
import { StudioSkeleton } from './StudioSkeleton';
import { PaletteSkeleton } from './PaletteSkeleton';
import { ArtifactSkeleton } from '../ArtifactReadingDrawer/ArtifactSkeleton';
import { AppScopeOverlays } from './AppScopeOverlays';

afterEach(() => {
  cleanup();
});

const NEVER = lazy(() => new Promise<never>(() => undefined));

describe('the overlays show a skeleton labelled Loading until their chunk lands', () => {
  it('draws the palette shape and no zero', () => {
    render(<PaletteSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading' })).toBe(
      screen.getByTestId('palette-skeleton'),
    );
    expect(screen.queryByText('0')).toBeNull();
  });

  it('draws the studio shape and the artifact shape', () => {
    render(
      <>
        <StudioSkeleton />
        <ArtifactSkeleton />
      </>,
    );

    expect(screen.getByTestId('studio-skeleton').getAttribute('aria-label')).toBe('Loading');
    expect(screen.getByTestId('artifact-skeleton').getAttribute('aria-label')).toBe('Loading');
  });

  it('shows the studio skeleton while a lazy studio suspends', () => {
    render(<AppScopeOverlays studio={<NEVER />} palette={null} closePalette={vi.fn()} />);

    expect(screen.getByTestId('studio-skeleton').getAttribute('aria-label')).toBe('Loading');
  });

  it('shows the palette skeleton while the palette chunk loads', () => {
    render(<LazyPaletteOverlay mode="commands" initialQuery="" onClose={vi.fn()} />);

    expect(screen.getByTestId('palette-skeleton').getAttribute('aria-label')).toBe('Loading');
  });
});
