// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { RUN_MODEL_COPY } from '../../../../../features/session/startRun/runModelCopy';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { U52_LAUNCHER_SCENES } from './launcher';

const WAIT = { timeout: 15_000 };

const RETIRED_WORDS = ['Balanced', 'In order', 'most room', 'Send new steps to'];

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: { rowsAffected: 0 },
    gh_run: { stdout: 'harborline/harbor-portal\n', stderr: '', exitCode: 0 },
  });
});

afterEach(cleanup);

type SceneParams = {
  readonly name: string;
};

const mount = ({ name }: SceneParams): void => {
  const Scene = U52_LAUNCHER_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const partsOf = (): ReadonlyArray<string> => [
  ...within(screen.getByRole('tablist', { name: 'Plan' }))
    .getAllByRole('tab')
    .map((tab) => `tab:${tab.textContent}`),
  `pill:${(screen.getByRole('combobox', { name: 'Workflow' }).textContent ?? '').replace(/ · likely.*$/, '')}`,
  ...(screen.queryByRole('group', { name: 'Run settings' }) === null ? [] : ['settings']),
  ...(screen.queryByRole('group', { name: 'Where it runs' }) === null ? [] : ['where-it-runs']),
  `start:${screen.getByRole('button', { name: /^(Start|Retry)$/ }).textContent}`,
];

describe('the u52 launcher scenes', () => {
  it('registers every scene', () => {
    for (const [id, Scene] of Object.entries(U52_LAUNCHER_SCENES)) {
      expect(MOCK_SCENES[id]).toBe(Scene);
    }
    expect(Object.keys(U52_LAUNCHER_SCENES)).toHaveLength(6);
  });

  it('draws the same parts on New session and on Start run', async () => {
    mount({ name: 'u52-launcher-new-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    const fromNew = partsOf();
    cleanup();

    mount({ name: 'u52-launcher-run-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    const fromRun = partsOf();

    expect(fromNew).toEqual(fromRun);
    expect(fromRun).toEqual(
      expect.arrayContaining([
        'tab:The Lead plans it',
        'tab:One agent',
        'settings',
        'where-it-runs',
        'start:Start',
      ]),
    );
  });

  it('puts the model on the Where it runs line and nowhere else', async () => {
    mount({ name: 'u52-launcher-run-light' });

    const where = await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    expect(where.textContent).toMatch(/^Lead on Claude · .+ · the Lead picks helpers, by order/);
    expect(
      screen.getAllByRole('button', { name: /^Change the .* model for this run/ }),
    ).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Model:/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /provider/i })).toBeNull();
  });

  it.each([
    ['load', true, 'the Lead picks helpers, by load'],
    ['order', false, 'the Lead picks helpers, by order'],
  ])('follows Provider priority %s on the helpers part', async (_name, isByLoad, words) => {
    useAppStore.setState({
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          ...EMPTY_OVERRIDES,
          workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: isByLoad },
        },
      },
    });
    mount({ name: 'u52-launcher-new-dark' });

    const where = await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    expect(where.textContent).toContain(words);
    expect(words).toBe(RUN_MODEL_COPY.helpers[isByLoad ? 'load' : 'order']);

    act(() =>
      useAppStore.setState({
        workspaceOverrides: {
          [WORKSPACE_ID]: {
            ...EMPTY_OVERRIDES,
            workflowRules: { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: !isByLoad },
          },
        },
      }),
    );
    expect(where.textContent).toContain(RUN_MODEL_COPY.helpers[isByLoad ? 'order' : 'load']);
  });

  it('shows why Start is off on both screens', async () => {
    mount({ name: 'u52-launcher-run-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    fireEvent.change(screen.getByRole('textbox', { name: 'Start a run' }), {
      target: { value: '' },
    });
    screen.getByText('Write the goal first.');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start' }).disabled).toBe(true);
    cleanup();

    mount({ name: 'u52-launcher-new-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    fireEvent.change(screen.getByRole('textbox', { name: 'Goal' }), { target: { value: '' } });
    screen.getByText('Write the goal first.');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Start' }).disabled).toBe(true);
  });

  it('opens Every run from the one door and from the Replies chip', async () => {
    const opened: Array<unknown> = [];
    const onOpen = (event: Event): void => {
      opened.push(event instanceof CustomEvent ? event.detail : null);
    };
    window.addEventListener('goodboy:open-settings', onOpen);
    mount({ name: 'u52-launcher-run-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Defaults live in Workflows, Every run' }));
    fireEvent.click(screen.getByRole('button', { name: /^Replies: / }));
    window.removeEventListener('goodboy:open-settings', onOpen);

    expect(opened).toHaveLength(2);
    expect(opened[0]).toMatchObject({ scope: 'workspace', section: 'general' });
    expect(opened[1]).toMatchObject({ scope: 'workspace', section: 'general' });
  });

  it('says Stops on both screens and keeps the retired routing words off both', async () => {
    mount({ name: 'u52-launcher-new-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    screen.getByRole('button', { name: /^Stops/ });
    for (const word of RETIRED_WORDS) {
      expect(document.body.textContent).not.toContain(word);
    }
    cleanup();

    mount({ name: 'u52-launcher-run-dark' });
    await screen.findByRole('group', { name: 'Where it runs' }, WAIT);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    screen.getByRole('button', { name: /^Stops/ });
    for (const word of RETIRED_WORDS) {
      expect(document.body.textContent).not.toContain(word);
    }
  });
});
