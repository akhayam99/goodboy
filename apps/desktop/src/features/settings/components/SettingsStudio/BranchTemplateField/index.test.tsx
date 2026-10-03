// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { OverrideSettings, SessionId, Workspace } from '@goodboy/types';
import { aSession, aWorkspace, EMPTY_OVERRIDES } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { BranchTemplateField } from './index';

let useAppStore: StoryStore;

const HARBORLINE: Workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });

const savedTemplates = (): ReadonlyArray<string | null> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => name === 'set_workspace_overrides')
    .map(
      ([, args]) =>
        (args as { readonly overrides: OverrideSettings }).overrides.defaultBranchTemplate,
    );

const seed = (overrides: Partial<OverrideSettings> = {}) => {
  stubStoryInvoke({ set_workspace_overrides: null });
  const session = aSession({
    id: 's-retry' as SessionId,
    workspaceId: HARBORLINE.id,
    goal: 'Retry failed payments',
  });
  useAppStore.setState({
    workspaces: [HARBORLINE],
    currentWorkspaceId: HARBORLINE.id,
    sessions: [session],
    sessionExternalTasks: {
      [session.id]: [
        {
          sessionId: session.id,
          provider: 'linear',
          externalId: 'lin-212',
          identifier: 'HAR-212',
          url: 'https://linear.app/harborline/issue/HAR-212',
          title: 'Retry failed payments',
          createdAt: session.createdAt,
        },
      ],
    },
    workspaceOverrides: {
      [HARBORLINE.id]: { ...EMPTY_OVERRIDES, defaultBranchPrefix: 'hl', ...overrides },
    },
  });
};

const field = () => render(<BranchTemplateField workspaceId={HARBORLINE.id} />);

const preview = () => within(screen.getByLabelText('Branch name preview'));

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seed();
});

afterEach(cleanup);

describe('BranchTemplateField', () => {
  it('labels each preset with the name it gives the last session, task id first by default', () => {
    field();

    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(options[0]?.textContent).toContain('hl/retry-failed-payments');
    expect(options[1]?.textContent).toContain('hl/har-212-retry-failed-payments');
    expect(preview().getByText('hl/har-212-retry-failed-payments').tagName).toBe('DD');
    expect(preview().getByText('hl/retry-failed-payments').tagName).toBe('DD');
    expect(
      screen.getByText(/Preview from your last session, “Retry failed payments”/).tagName,
    ).toBe('P');
  });

  it('saves the preset without a task id, and writes nothing for the default', async () => {
    field();

    fireEvent.click(screen.getByRole('radio', { name: /Without a task id/ }));

    await waitFor(() => expect(savedTemplates()).toEqual(['{prefix}/{slug}']));
    expect(useAppStore.getState().workspaceOverrides[HARBORLINE.id]?.defaultBranchTemplate).toBe(
      '{prefix}/{slug}',
    );

    fireEvent.click(screen.getByRole('radio', { name: /Task id first/ }));
    await waitFor(() => expect(savedTemplates()).toEqual(['{prefix}/{slug}', null]));
  });

  it('refuses a custom template git would refuse and says why, without saving', () => {
    field();
    fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
    const input = screen.getByRole('textbox', { name: 'Custom branch template' });

    fireEvent.change(input, { target: { value: '{prefix}/{ticket}-{slug}' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('alert').textContent).toBe(
      '{ticket} is not a placeholder. Use {prefix}, {task-id}, {slug} or {user}.',
    );
    expect(preview().getAllByText('Not valid yet')).toHaveLength(2);

    fireEvent.change(input, { target: { value: '{prefix}/{task-id}' } });
    expect(screen.getByRole('alert').textContent).toBe(
      'Add {slug} so two sessions never get the same name.',
    );
    expect(savedTemplates()).toEqual([]);
  });

  it('builds a custom template from the placeholder chips and saves it', async () => {
    useAppStore.setState({
      githubStatus: { mode: 'gh-cli', available: true, scoped: false, user: 'mara-quint' },
    });
    field();
    fireEvent.click(screen.getByRole('radio', { name: /Custom/ }));
    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Custom branch template',
    });
    fireEvent.change(input, { target: { value: '' } });

    for (const [placeholder, separator] of [
      ['prefix', '/'],
      ['user', '/'],
      ['task-id', '-'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: `Add {${placeholder}}` }));
      fireEvent.change(input, { target: { value: `${input.value}${separator}` } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add {slug}' }));

    expect(input.value).toBe('{prefix}/{user}/{task-id}-{slug}');
    expect(preview().getByText('hl/mara-quint/har-212-retry-failed-payments').tagName).toBe('DD');
    expect(preview().getByText('hl/mara-quint/retry-failed-payments').tagName).toBe('DD');

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(savedTemplates()).toEqual(['{prefix}/{user}/{task-id}-{slug}']));
  });

  it('opens on Custom when the workspace keeps its own template, with a nested prefix', () => {
    seed({ defaultBranchPrefix: 'team/hl', defaultBranchTemplate: '{task-id}/{slug}' });
    field();

    expect(screen.getByRole('radio', { name: /Custom/ }).getAttribute('aria-checked')).toBe('true');
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Custom branch template' }).value,
    ).toBe('{task-id}/{slug}');
    expect(screen.getByRole('radio', { name: /Without a task id/ }).textContent).toContain(
      'team/hl/retry-failed-payments',
    );
    expect(preview().getByText('har-212/retry-failed-payments').tagName).toBe('DD');
  });
});
