// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { flowWordOf } from '../../shared/lib/flowWordOf';
import { SETTING_WORK_ENABLED } from '../../shared/lib/workSetting';
import { installSceneJourney } from './sceneJourney';

const journey = installSceneJourney();

type Position = 'off' | 'on';

const CYCLE: ReadonlyArray<Position> = ['off', 'on', 'off'];

type FlipParams = {
  readonly position: Position;
};

const flip = async ({ position }: FlipParams): Promise<string> => {
  act(() => {
    const store = journey.store();
    store.setState({
      settings: {
        ...store.getState().settings,
        [SETTING_WORK_ENABLED]: position === 'on' ? 'true' : 'false',
      },
    });
  });
  await journey.settle();
  return flowWordOf({ isWork: position === 'on' });
};

const hasButton = (name: string | RegExp): boolean =>
  screen.queryAllByRole('button', { name }).length > 0;

const limitLabel = (): string =>
  screen.getByRole('button', { name: /^Limit: / }).getAttribute('aria-label') ?? '';

describe('journey: a Lead page with a pending ask, switch off, on, off', () => {
  it('keeps the push ask and names the flow in every label', async () => {
    await journey.mount({ name: 'work-lead-push' });

    for (const position of CYCLE) {
      const word = await flip({ position });

      expect(hasButton('Push')).toBe(true);
      expect(hasButton("Don't push")).toBe(true);
      expect(hasButton(`Stop ${word}`)).toBe(true);
      screen.getByText(`Push a branch: Ask · This ${word}`);
      expect(limitLabel()).toBe(`Limit: $10.00, this ${word}`);
    }
  });

  it('keeps the dependency ask with its package through the cycle', async () => {
    await journey.mount({ name: 'work-lead-dependency' });

    for (const position of CYCLE) {
      const word = await flip({ position });

      expect(hasButton('Allow nock@14.0.1')).toBe(true);
      expect(hasButton('Do it without')).toBe(true);
      screen.getByText(`Add or upgrade dependencies: Ask · This ${word}`);
    }
  });

  it('holds a message while agents work only with the switch off', async () => {
    await journey.mount({ name: 'work-lead-working' });

    for (const position of CYCLE) {
      const word = await flip({ position });

      expect(hasButton(`Stop ${word} and 2 agents`)).toBe(true);
      expect(hasButton('Send now')).toBe(position === 'off');
      expect(screen.queryAllByText('Not read yet').length > 0).toBe(position === 'on');
    }
  });
});

describe('journey: the Work list, switch off, on, off', () => {
  it('shows the Work item in the sidebar only with the switch on', async () => {
    await journey.mount({ name: 'work-list' });

    for (const position of CYCLE) {
      await flip({ position });

      expect(hasButton(/^Work$/)).toBe(position === 'on');
      expect(hasButton('Start work')).toBe(true);
    }
  });
});
