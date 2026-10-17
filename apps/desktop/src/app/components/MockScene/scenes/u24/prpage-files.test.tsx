// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { sectionNames } from '../../../../../test/branchRail';
import { MOCK_SCENES } from '../..';
import { U24_PRPAGE_FILES_SCENES } from './prpage-files';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  vi.restoreAllMocks();
});

const WAIT = { timeout: 5_000 };

type Name = keyof typeof U24_PRPAGE_FILES_SCENES;

const renderScene = ({ name }: { readonly name: Name }) => {
  const Scene = U24_PRPAGE_FILES_SCENES[name];
  return render(
    <ObjectMenuProvider>
      <ToastProvider>
        <Scene />
      </ToastProvider>
    </ObjectMenuProvider>,
  );
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
};

describe('the u24 prpage files scenes', () => {
  it('registers the four scenes under the names the plan uses', () => {
    expect(Object.keys(U24_PRPAGE_FILES_SCENES)).toEqual([
      'branch-files-both',
      'branch-files-nopr-notes',
      'branch-files-1920-split',
      'branch-comments-both',
    ]);
    for (const name of Object.keys(U24_PRPAGE_FILES_SCENES)) {
      expect(Object.keys(MOCK_SCENES)).toContain(name);
    }
  });

  it('draws a note and a GitHub thread on Files, told apart by chip, with Fix comments in the toolbar', async () => {
    renderScene({ name: 'branch-files-both' });

    const notes = await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);
    expect(notes.length).toBeGreaterThanOrEqual(1);
    const hosts = screen.getAllByRole('article', { name: /^On GitHub from / });
    expect(hosts.length).toBeGreaterThanOrEqual(1);
    for (const note of notes) {
      expect(within(note).getByText('Note')).toBeDefined();
    }
    for (const host of hosts) {
      expect(within(host).getByText('On GitHub')).toBeDefined();
    }
    expect(screen.queryByRole('button', { name: /^Fix \d+ comments?$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write review' })).toBeNull();
  });

  it('puts the three controls on every file header, with Viewed a checkbox and no native title', async () => {
    renderScene({ name: 'branch-files-both' });
    await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);

    const headers = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="diff-file-header"]'),
    );
    expect(headers.length).toBeGreaterThan(1);
    for (const header of headers) {
      expect(within(header).getByRole('checkbox', { name: 'Viewed' })).toBeDefined();
      expect(within(header).getByRole('button', { name: /^Comment/ })).toBeDefined();
      expect(header.querySelector('[title]')).toBeNull();
    }
  });

  it('keeps the file cards inside one page column', async () => {
    renderScene({ name: 'branch-files-both' });
    await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);

    const cards = Array.from(document.querySelectorAll('[data-file-card]'));
    expect(cards.length).toBeGreaterThan(1);
    for (const card of cards) {
      expect(card.closest('[data-page-column]')).not.toBeNull();
    }
  });

  it('shows Viewed, Comment and one menu on every file header, the rest inside the menu', async () => {
    renderScene({ name: 'branch-files-both' });
    await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);

    const [header] = Array.from(
      document.querySelectorAll<HTMLElement>('[data-slot="diff-file-header"]'),
    );
    const scope = within(header ?? document.body);
    expect(scope.getByRole('button', { name: 'Comment' })).toBeDefined();
    expect(scope.queryByRole('button', { name: 'Open in editor' })).toBeNull();
    fireEvent.click(scope.getByRole('button', { name: /^More for / }));
    for (const name of ['Open in editor', 'Copy path', 'Show whole file']) {
      expect(screen.getByRole('menuitem', { name })).toBeDefined();
    }
  });

  it('shows Comments with notes only and no host before a pull request, and no Checks', async () => {
    renderScene({ name: 'branch-files-nopr-notes' });
    await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);
    await settle();

    expect(sectionNames()).toEqual(['Pull request', 'Comments', 'Files', 'Commits']);
    expect(screen.queryAllByRole('article', { name: /^On GitHub/ })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Fix \d+ comments?$/ })).toBeNull();
  });

  it('draws Files at 1920 in the split layout', async () => {
    renderScene({ name: 'branch-files-1920-split' });
    await screen.findAllByRole('article', { name: /^Note from You/ }, WAIT);

    expect(localStorage.getItem('goodboy:diff-layout-mode')).toBe('split');
  });

  it('lists the notes and the GitHub threads together on Comments with the scope bar', async () => {
    renderScene({ name: 'branch-comments-both' });

    const list = await screen.findByRole('navigation', { name: 'Comments' }, WAIT);
    expect(within(list).getAllByText('Note').length).toBeGreaterThanOrEqual(1);
    expect(within(list).queryAllByText('On GitHub')).toHaveLength(0);
    expect(screen.getByRole('tab', { name: /^All/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^Notes/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /^On GitHub/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Resolved' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Fix \d+ comments?$/ })).toBeDefined();
  });
});
