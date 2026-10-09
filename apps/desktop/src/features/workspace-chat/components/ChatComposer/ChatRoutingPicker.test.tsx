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
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MODEL_CATALOGS, PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ChatRouting } from '../../chatRouting';
import { ChatRoutingPicker } from './ChatRoutingPicker';

const WORKSPACE = aWorkspace();

let useAppStore: StoryStore;

const connected = (id: ProviderId): AppStore['providers'][number] => ({
  id,
  binary: id,
  capabilities: PROVIDER_CAPABILITIES[id],
  connection: 'connected',
  version: null,
  identity: null,
  label: id,
  error: null,
  docsUrl: '',
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [WORKSPACE],
    providers: [connected('anthropic'), connected('codex')],
  });
});

afterEach(cleanup);

const open = (routing: ChatRouting) => {
  const onChange = vi.fn<(next: ChatRouting) => void>();
  render(<ChatRoutingPicker workspaceId={WORKSPACE.id} routing={routing} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: /^Model for this chat:/ }));
  return { onChange, dialog: within(screen.getByRole('dialog', { name: 'Model for this chat' })) };
};

describe('ChatRoutingPicker', () => {
  it('hands a provider switch over as one routing, with a model the provider owns', () => {
    const { onChange, dialog } = open({ provider: 'anthropic', model: 'sonnet-5', effort: null });

    fireEvent.click(dialog.getByRole('button', { name: 'Codex' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const [next] = onChange.mock.calls[0] ?? [];
    expect(next?.provider).toBe('codex');
    expect(next?.effort).toBeNull();
    expect(MODEL_CATALOGS.codex.map((model) => model.key)).toContain(next?.model);
  });

  it('keeps the saved effort when only the model changes', () => {
    const { onChange, dialog } = open({ provider: 'anthropic', model: 'sonnet-5', effort: 'low' });

    fireEvent.click(dialog.getByRole('button', { name: 'Opus' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      provider: 'anthropic',
      model: expect.stringContaining('opus'),
      effort: 'low',
    });
  });
});
