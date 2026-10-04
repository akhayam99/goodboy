// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { WORKSPACE_ID, seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import {
  SETTINGS_WORKSPACE,
  seedSettingsBase,
} from '../../app/components/MockScene/scenes/audit/settingsSeed';
import { StageBoard } from '../../features/workspace/components/StageBoard';
import { ProvidersMenu } from '../../app/components/AppFooter/ProvidersMenu';
import { LinkedWorkChips } from '../../features/session/components/SessionOverviewPane/LinkedWorkChips';

const STAGE_DEFAULT_REASONS = ['no PR yet', 'awaiting review'];
const LIMIT_FIGURE = /\d+(?:\.\d+)?\s?%/;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const mount = async ({ ui }: { readonly ui: ReactNode }): Promise<void> => {
  render(<ToastProvider>{ui}</ToastProvider>);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mountBoard = async (): Promise<ReadonlyArray<HTMLElement>> => {
  seedBoardScene();
  const { sessions } = useAppStore.getState();
  await mount({ ui: <StageBoard workspaceId={WORKSPACE_ID} sessions={sessions} /> });
  return Array.from(document.querySelectorAll<HTMLElement>('[data-select-id]'));
};

describe('one home per fact', () => {
  it('names the workspace nowhere on the board, the top bar owns it', async () => {
    await mountBoard();
    const name = useAppStore.getState().workspaces[0]?.name;

    expect(name).toBeDefined();
    expect(screen.queryByText(name ?? '')).toBeNull();
  });

  it('shows a task id once per linked-work row', async () => {
    seedBoardScene();
    const linked = Object.entries(useAppStore.getState().sessionExternalTasks).filter(
      ([, tasks]) => tasks.length > 1,
    );
    expect(linked.length).toBeGreaterThan(0);

    for (const [sessionId, tasks] of linked) {
      cleanup();
      await mount({
        ui: <LinkedWorkChips sessionId={sessionId as SessionId} onSelectLens={() => undefined} />,
      });
      const text = document.body.textContent ?? '';

      for (const task of tasks) {
        expect(text.split(task.identifier).length - 1, task.identifier).toBe(1);
      }
    }
  });

  it('never gives the stage default as the reason on a row', async () => {
    const cards = await mountBoard();

    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      for (const reason of STAGE_DEFAULT_REASONS) {
        expect(card.textContent ?? '', reason).not.toContain(reason);
      }
    }
  });

  it('shows no limit figure twice in the providers menu', async () => {
    seedSettingsBase();
    await mount({ ui: <ProvidersMenu workspaceId={SETTINGS_WORKSPACE.id} /> });
    fireEvent.click(screen.getByRole('button', { name: 'Providers' }));
    const menu = await screen.findByRole('dialog', { name: 'Providers' });

    const figures = Array.from(menu.querySelectorAll<HTMLElement>('*'))
      .filter((node) => node.children.length === 0)
      .map((node) => (node.textContent ?? '').trim())
      .filter((text) => LIMIT_FIGURE.test(text));

    expect(figures.length, figures.join(' | ')).toBe(new Set(figures).size);
    expect(within(menu).queryAllByRole('meter')).toHaveLength(0);
  });
});
