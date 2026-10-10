// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AutoContext } from '@goodboy/core';
import type { RoleModelPreference } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { RoleRow } from './index';

const OPUS_PIN: RoleModelPreference = {
  providerId: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
};

const CODEX_ONLY: AutoContext = {
  defaultProvider: 'codex',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'off' },
  ],
};

const CLAUDE_ON: AutoContext = {
  defaultProvider: 'anthropic',
  connected: ['anthropic', 'codex'],
  policy: [
    { id: 'anthropic', state: 'on' },
    { id: 'codex', state: 'on' },
  ],
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type RowParams = {
  readonly preference: RoleModelPreference | null;
  readonly autoContext: AutoContext;
};

const row = ({ preference, autoContext }: RowParams) => {
  render(
    <RoleRow
      role="planner"
      label="Planner"
      help="Writes the plan."
      preference={preference}
      autoContext={autoContext}
      isParallelOn={false}
      connectedProviderIds={['anthropic', 'codex']}
      disabled={false}
      onChange={vi.fn()}
    />,
  );
  return screen.getByRole('button', { name: (name) => name.startsWith('Planner') });
};

describe('RoleRow', () => {
  it('shows the model that runs, the Pinned chip and why the pin is skipped when its provider is Off', () => {
    const trigger = row({ preference: OPUS_PIN, autoContext: CODEX_ONLY });

    const summary = trigger.querySelector<HTMLElement>('[data-role-summary]');
    expect(summary?.textContent).toContain('Astra');
    expect(summary?.textContent).not.toContain('Opus');
    expect(trigger.textContent).toContain('Pinned');
    expect(
      screen.getByText('Pinned Opus 5.5 is skipped: Claude is Off. Using Astra.'),
    ).toBeDefined();
  });

  it('shows the pinned model and no line while its provider is On', () => {
    const trigger = row({ preference: OPUS_PIN, autoContext: CLAUDE_ON });

    const summary = trigger.querySelector<HTMLElement>('[data-role-summary]');
    expect(summary?.textContent).toBe('Opus 5.5·High');
    expect(trigger.textContent).toContain('Pinned');
    expect(screen.queryByText(/is skipped/)).toBeNull();
    expect(screen.getByText('Writes the plan.')).toBeDefined();
  });

  it('calls a row with no pin Auto', () => {
    const trigger = row({ preference: null, autoContext: CODEX_ONLY });

    expect(trigger.textContent).toContain('Auto');
    expect(trigger.textContent).not.toContain('Pinned');
    expect(screen.queryByText(/is skipped/)).toBeNull();
  });
});
