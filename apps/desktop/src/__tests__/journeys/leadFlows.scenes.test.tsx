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

const OLD_SWITCH_ROWS: ReadonlyArray<string> = ['false', 'true'];

type OldSwitchParams = {
  readonly value: string;
};

const oldSwitchSaid = async ({ value }: OldSwitchParams): Promise<void> => {
  act(() => {
    const store = journey.store();
    store.setState({ settings: { ...store.getState().settings, 'work.enabled': value } });
  });
  await journey.settle();
};

const hasButton = (name: string | RegExp): boolean =>
  screen.queryAllByRole('button', { name }).length > 0;

const limitLabel = (): string =>
  screen.getByRole('button', { name: /^Limit: / }).getAttribute('aria-label') ?? '';

describe('journey: a Lead page with a pending ask, whatever the old Work switch row says', () => {
  it('keeps the push ask and names the Lead in every label', async () => {
    await journey.mount({ name: 'work-lead-push' });

    for (const value of OLD_SWITCH_ROWS) {
      await oldSwitchSaid({ value });

      expect(hasButton('Push')).toBe(true);
      expect(hasButton("Don't push")).toBe(true);
      expect(hasButton('Stop run')).toBe(true);
      screen.getByText('Push a branch: Ask first · This Lead');
      expect(limitLabel()).toBe('Limit: $10.00, this Lead');
    }
  });

  it('keeps the dependency ask with its package', async () => {
    await journey.mount({ name: 'work-lead-dependency' });

    for (const value of OLD_SWITCH_ROWS) {
      await oldSwitchSaid({ value });

      expect(hasButton('Allow nock@14.0.1')).toBe(true);
      expect(hasButton('Do it without')).toBe(true);
      screen.getByText('Add or upgrade dependencies: Ask first · This Lead');
    }
  });

  it('never holds a message while agents work: it reads Not read yet, no Send now', async () => {
    await journey.mount({ name: 'work-lead-working' });

    for (const value of OLD_SWITCH_ROWS) {
      await oldSwitchSaid({ value });

      expect(hasButton('Stop run')).toBe(true);
      expect(hasButton('Send now')).toBe(false);
      expect(screen.queryAllByText('Not read yet').length > 0).toBe(true);
    }
  });
});
