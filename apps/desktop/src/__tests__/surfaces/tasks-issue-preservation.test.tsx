// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: string;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = MOCK_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const pane = (): HTMLElement => screen.getByRole('complementary', { name: 'Task' });

const group = (name: string): HTMLElement =>
  within(within(pane()).getByRole('group', { name: 'Properties' })).getByRole('region', { name });

describe('SPEC3 9.7 issues and Tasks rows reachable from the new issue pane', () => {
  it('keeps the Tasks detail beside the list, in the pane, with Open full to the depth view', async () => {
    await mount({ name: 'c12-issue-pane' });

    expect(screen.getByRole('list', { name: 'Task items' })).toBeDefined();
    expect(within(pane()).getByRole('button', { name: 'Open full' })).toBeDefined();
  });

  it('keeps Linear labels and Team › Project in the Planning group', async () => {
    await mount({ name: 'c12-issue-pane' });

    const planning = group('Planning');
    expect(within(planning).getByText('bug')).toBeDefined();
    expect(within(planning).getByText('webhooks')).toBeDefined();
    expect(within(planning).getByText('HBL › Ledger')).toBeDefined();
  });

  it('keeps linked PR chips with their state word in the Links group', async () => {
    await mount({ name: 'c12-issue-pane' });

    const links = group('Links');
    expect(within(links).getByText('PRs')).toBeDefined();
    expect(within(links).getAllByText(/#41[89]|#421/).length).toBe(2);
    expect(within(links).getAllByText(/merged/).length).toBe(2);
  });

  it('keeps status, priority and assignee with the provider marks in the State group', async () => {
    await mount({ name: 'c12-issue-pane' });

    const status = group('State');
    expect(within(status).getByText('In progress')).toBeDefined();
    expect(within(status).getByText('High')).toBeDefined();
    expect(within(status).getByText('Mara Lindqvist')).toBeDefined();
  });

  it('keeps the star, the open session of a linked issue and the close control on the header', async () => {
    await mount({ name: 'c12-issue-pane' });

    expect(within(pane()).getByRole('button', { name: 'Star HBL-412' })).toBeDefined();
    expect(within(pane()).getByRole('button', { name: 'Close the item' })).toBeDefined();
    expect(within(pane()).queryByText('Linked to')).toBeNull();
  });

  it('keeps comment threads with Reply on a comment', async () => {
    await mount({ name: 'c12-issue-pane' });

    expect(within(pane()).getAllByRole('button', { name: /^Reply/ }).length).toBeGreaterThan(0);
  });

  it('keeps the description editable in place', async () => {
    await mount({ name: 'c12-issue-edit' });

    expect(screen.getByRole('textbox', { name: 'Edit description' })).toBeDefined();
  });

  it('keeps Start session on an issue nobody linked', async () => {
    await mount({ name: 'c12-issue-github' });

    expect(within(pane()).getByRole('button', { name: 'Start session' })).toBeDefined();
  });

  it('hosts a Sentry error unchanged in the same pane frame', async () => {
    await mount({ name: 'c12-issue-sentry' });

    expect(within(pane()).getAllByText(/PAYMENTS-API-7000/).length).toBeGreaterThan(0);
    expect(within(pane()).getByRole('button', { name: 'Open full' })).toBeDefined();
  });

  it('goes back from the full page to Tasks', async () => {
    await mount({ name: 'c12-issue-full' });

    expect(screen.getByRole('button', { name: 'Back to Tasks' })).toBeDefined();
  });

  it('keeps the move of an in-session issue in its Links group', async () => {
    await mount({ name: 'taskmove-issuepage' });

    expect(screen.getByText('Placed on')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Move NW-142 from api · feat/create-orders-endpoint' }),
    ).toBeDefined();
  });
});
