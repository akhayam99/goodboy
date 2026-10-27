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

import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type ProjectId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { WorkspaceIdentityRow } from './index';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  act(() => {
    useAppStore.setState({
      workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Acme', slug: 'acme' })],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [
        buildStoryProject({
          id: 'proj-1' as ProjectId,
          workspaceId: WORKSPACE_ID,
          kind: 'repo',
          rootPath: '/code/monorepo',
        }),
      ],
    });
  });
});

afterEach(cleanup);

describe('WorkspaceIdentityRow', () => {
  it('names the workspace and keeps the repo out of the strip', () => {
    render(<WorkspaceIdentityRow />);

    expect(screen.getByText('Acme').textContent).toBe('Acme');
    expect(screen.queryByText('monorepo')).toBeNull();
  });

  it('carries the folder count and the switcher shortcut in the title', () => {
    render(<WorkspaceIdentityRow />);

    const trigger = screen.getByLabelText('Switch workspace: Acme');
    expect(trigger.getAttribute('title')).toBeNull();
    expect(tooltipTextOf({ element: trigger })).toBe(
      `Acme, 1 folder${shortcutGlyphs('workspace.switcher')}`,
    );
  });

  it('opens the selector as a popover, not a full-screen layer', () => {
    render(<WorkspaceIdentityRow />);
    const trigger = screen.getByLabelText('Switch workspace: Acme');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'New workspace' })).toHaveLength(1);
  });

  it('answers the global switcher shortcut', () => {
    render(<WorkspaceIdentityRow />);

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.getAllByRole('button', { name: 'New workspace' })).toHaveLength(1);
  });

  it('keeps workspace settings inside the switcher, with no second control on the row', () => {
    render(<WorkspaceIdentityRow />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText('Workspace settings')).toBeNull();
  });

  it('renders nothing without a workspace', () => {
    act(() => {
      useAppStore.setState({ workspaces: [], currentWorkspaceId: null });
    });
    const { container } = render(<WorkspaceIdentityRow />);

    expect(container.firstChild).toBeNull();
  });

  describe('when another workspace needs you', () => {
    const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });
    const CASCADIA = brandId<WorkspaceId>({ value: 'ws-cascadia' });

    const entryOf = ({
      count,
      tone,
    }: {
      readonly count: number;
      readonly tone: 'danger' | 'warning';
    }) => ({
      count,
      tone,
      reasonWords: ['1 question for you'],
    });

    it('shows the number in amber on the row and says it in the label', () => {
      act(() => {
        useAppStore.setState({
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      const mark = container.querySelector('[data-workspace-attention]');
      expect(mark?.textContent).toBe('2');
      expect(mark?.getAttribute('data-workspace-attention')).toBe('warning');
      expect(
        screen
          .getByLabelText('Switch workspace: Acme, 2 need you in other workspaces')
          .getAttribute('aria-expanded'),
      ).toBe('false');
    });

    it('adds the workspaces together and turns red when one of them is broken', () => {
      act(() => {
        useAppStore.setState({
          attentionFromDatabase: {
            [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }),
            [CASCADIA]: entryOf({ count: 1, tone: 'danger' }),
          },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      const mark = container.querySelector('[data-workspace-attention]');
      expect(mark?.textContent).toBe('3');
      expect(mark?.getAttribute('data-workspace-attention')).toBe('danger');
    });

    it('leaves out the count of the workspace this window shows', () => {
      act(() => {
        useAppStore.setState({
          attentionFromWindows: { [WORKSPACE_ID]: entryOf({ count: 4, tone: 'warning' }) },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      expect(container.querySelector('[data-workspace-attention]')).toBeNull();
    });

    it('prefers the report of the window that shows the workspace over the database', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: { 'win-northwind': NORTHWIND },
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 5, tone: 'warning' }) },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      expect(container.querySelector('[data-workspace-attention]')?.textContent).toBe('5');
    });

    it('goes back to the database once no window shows the workspace', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: {},
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 5, tone: 'warning' }) },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      expect(container.querySelector('[data-workspace-attention]')?.textContent).toBe('2');
    });

    it('shows nothing for a window report of zero over a stale database count', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: { 'win-northwind': NORTHWIND },
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 0, tone: 'warning' }) },
        });
      });
      const { container } = render(<WorkspaceIdentityRow />);

      expect(container.querySelector('[data-workspace-attention]')).toBeNull();
    });
  });
});
