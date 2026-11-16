// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { installSceneJourney } from './sceneJourney';

const journey = installSceneJourney();

const field = (): HTMLElement => screen.getByRole('textbox', { name: 'Start a run' });

describe('journey: the New menu starts a run inside the session', () => {
  it('New menu opens the field in Runs', async () => {
    await journey.mount({ name: 'u27-breadcrumbs-after-run-light' });
    await journey.clickButton({ name: 'Back to Runs' });
    await journey.clickTab({ name: /^Overview/ });
    const sessionId = journey.store().getState().currentSessionId;

    await journey.clickButton({ name: /^New/ });
    const item = screen.getByRole('menuitem', { name: 'Start a run' });
    await act(async () => {
      item.click();
      await vi.advanceTimersByTimeAsync(400);
    });
    await journey.settle();

    expect(journey.store().getState().currentSessionId).toBe(sessionId);
    expect(journey.view().lens).toBe('workflows');
    expect(journey.store().getState().appStudio).toBeNull();
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole('combobox', { name: 'Session' })).toBeNull();
  });
});
