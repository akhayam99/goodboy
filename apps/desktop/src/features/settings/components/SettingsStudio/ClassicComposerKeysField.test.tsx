// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { PromptField } from '../../../../shared/components/PromptField';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../settings';
import { ClassicComposerKeysField } from './ClassicComposerKeysField';

let useAppStore: StoryStore;
let starts: string[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  starts = [];
});

afterEach(cleanup);

const KickoffBox = () => {
  const [value, setValue] = useState('');
  return (
    <PromptField
      kind="message"
      label="Agent instructions"
      value={value}
      onChange={setValue}
      onSubmit={() => starts.push(value)}
      hasChangedKeys
    />
  );
};

const typeAndPress = (init: { readonly metaKey?: boolean }) => {
  const field = screen.getByRole('textbox', { name: 'Agent instructions' });
  fireEvent.change(field, { target: { value: 'Map the ledger' } });
  fireEvent.keyDown(field, { key: 'Enter', code: 'Enter', ...init });
};

describe('ClassicComposerKeysField', () => {
  it('starts on Enter until the switch is on, then on Cmd+Enter only, and saves the choice', async () => {
    render(
      <>
        <ClassicComposerKeysField />
        <KickoffBox />
      </>,
    );
    typeAndPress({});
    expect(starts).toEqual(['Map the ledger']);

    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() =>
      expect(useAppStore.getState().settings[SETTING_COMPOSER_CLASSIC_KEYS]).toBe('true'),
    );
    expect(storySpies.setSetting).toHaveBeenCalledWith(
      expect.anything(),
      SETTING_COMPOSER_CLASSIC_KEYS,
      'true',
    );

    typeAndPress({});
    expect(starts).toEqual(['Map the ledger']);
    typeAndPress({ metaKey: true });
    expect(starts).toEqual(['Map the ledger', 'Map the ledger']);
  });
});
