// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { FIXTURE_SESSION, aView } from '../../../../auto/testing/autoViewFixtures';
import { useFlowWord } from '../../../../../shared/hooks/useFlowWord';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { WorkSwitchField } from '.';

let useAppStore: StoryStore;

const WordProbe = () => <span data-testid="word">{useFlowWord()}</span>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('WorkSwitchField', () => {
  it('starts off and says Auto', () => {
    render(
      <>
        <WorkSwitchField />
        <WordProbe />
      </>,
    );
    expect(
      screen.getByRole('switch', { name: 'Work (experimental)' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByTestId('word').textContent).toBe('Auto');
  });

  it('flips to Lead and back, keeping a running Lead and a pending ask untouched', async () => {
    const running = { [FIXTURE_SESSION]: [aView({ rootAsk: 'Which project?' })] };
    useAppStore.setState({ autoTreeViews: running });
    render(
      <>
        <WorkSwitchField />
        <WordProbe />
      </>,
    );

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByTestId('word').textContent).toBe('Lead'));
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_WORK_ENABLED,
      'true',
    );
    expect(useAppStore.getState().autoTreeViews).toBe(running);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(screen.getByTestId('word').textContent).toBe('Auto'));
    expect(useAppStore.getState().autoTreeViews).toBe(running);
  });

  it('keeps the old flow and shows the error on the row when the write fails', async () => {
    storySpies.setSetting.mockRejectedValueOnce(new Error('disk is full'));
    render(
      <>
        <WorkSwitchField />
        <WordProbe />
      </>,
    );

    fireEvent.click(screen.getByRole('switch'));
    expect((await screen.findByRole('alert')).textContent).toBe('disk is full');
    expect(screen.getByTestId('word').textContent).toBe('Auto');
    expect(useAppStore.getState().settings[SETTING_WORK_ENABLED]).not.toBe('true');
  });
});
