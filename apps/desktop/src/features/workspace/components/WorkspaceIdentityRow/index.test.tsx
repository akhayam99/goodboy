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
import { ShellRail } from '@goodboy/ui';
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

type RectParams = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

const renderMark = () =>
  render(
    <ShellRail label="Places" form="wide">
      <WorkspaceIdentityRow />
    </ShellRail>,
  );

describe('WorkspaceIdentityRow', () => {
  it('names the workspace and keeps the repo out of the strip', () => {
    renderMark();

    expect(screen.getByText('Acme').textContent).toBe('Acme');
    expect(screen.queryByText('monorepo')).toBeNull();
  });

  it('carries the folder count and the switcher shortcut in the title', () => {
    renderMark();

    const trigger = screen.getByLabelText('Switch workspace: Acme');
    expect(trigger.getAttribute('title')).toBeNull();
    expect(tooltipTextOf({ element: trigger })).toBe(
      `Acme, 1 project${shortcutGlyphs('workspace.switcher')}`,
    );
  });

  it('opens the selector as a popover, not a full-screen layer', () => {
    renderMark();
    const trigger = screen.getByLabelText('Switch workspace: Acme');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'New workspace' })).toHaveLength(1);
  });

  it('answers the global switcher shortcut', () => {
    renderMark();

    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
    });

    expect(screen.getAllByRole('button', { name: 'New workspace' })).toHaveLength(1);
  });

  it('sits first in the rail as a tile with the workspace word under it', () => {
    const { container } = renderMark();

    const item = container.querySelector('[data-shell-rail-item="workspace"]');
    expect(item?.querySelector('[data-workspace-tile]')?.textContent).toBe('A');
    expect(item?.closest('[data-slot="shell-rail-item"]')?.textContent).toContain('Acme');
  });

  it('opens to the right of the rail, 12px inside the window, never over the rail', () => {
    const rectOf = ({ left, top, width, height }: RectParams): DOMRect =>
      new DOMRect(left, top, width, height);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return this.getAttribute('role') === 'dialog'
        ? rectOf({ left: 0, top: 0, width: 384, height: 480 })
        : rectOf({ left: 0, top: 40, width: 64, height: 48 });
    });
    vi.stubGlobal('innerWidth', 1440);
    vi.stubGlobal('innerHeight', 900);
    renderMark();

    fireEvent.click(screen.getByLabelText('Switch workspace: Acme'));

    const dialog = screen.getByRole('dialog', { name: 'Switch or open a workspace' });
    expect(Number.parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(64);
    expect(Number.parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(12);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps workspace settings inside the switcher, with no second control on the row', () => {
    renderMark();

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByLabelText('Workspace settings')).toBeNull();
  });

  it('renders nothing without a workspace', () => {
    act(() => {
      useAppStore.setState({ workspaces: [], currentWorkspaceId: null });
    });
    const { container } = renderMark();

    expect(container.querySelector('[data-workspace-mark]')).toBeNull();
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
      const { container } = renderMark();

      const mark = container.querySelector('[data-count-badge]');
      expect(mark?.textContent).toBe('2');
      expect(mark?.getAttribute('data-count-badge')).toBe('warning');
      expect(
        screen
          .getByLabelText('Switch workspace: Acme, 2 sessions need you in other workspaces')
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
      const { container } = renderMark();

      const mark = container.querySelector('[data-count-badge]');
      expect(mark?.textContent).toBe('3');
      expect(mark?.getAttribute('data-count-badge')).toBe('danger');
    });

    it('leaves out the count of the workspace this window shows', () => {
      act(() => {
        useAppStore.setState({
          attentionFromWindows: { [WORKSPACE_ID]: entryOf({ count: 4, tone: 'warning' }) },
        });
      });
      const { container } = renderMark();

      expect(container.querySelector('[data-count-badge]')).toBeNull();
    });

    it('prefers the report of the window that shows the workspace over the database', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: { 'win-northwind': NORTHWIND },
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 5, tone: 'warning' }) },
        });
      });
      const { container } = renderMark();

      expect(container.querySelector('[data-count-badge]')?.textContent).toBe('5');
    });

    it('goes back to the database once no window shows the workspace', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: {},
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 5, tone: 'warning' }) },
        });
      });
      const { container } = renderMark();

      expect(container.querySelector('[data-count-badge]')?.textContent).toBe('2');
    });

    it('shows nothing for a window report of zero over a stale database count', () => {
      act(() => {
        useAppStore.setState({
          windowPresence: { 'win-northwind': NORTHWIND },
          attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2, tone: 'warning' }) },
          attentionFromWindows: { [NORTHWIND]: entryOf({ count: 0, tone: 'warning' }) },
        });
      });
      const { container } = renderMark();

      expect(container.querySelector('[data-count-badge]')).toBeNull();
    });
  });

  describe('while switching workspace', () => {
    const NORTHWIND = brandId<WorkspaceId>({ value: 'ws-northwind' });

    beforeEach(() => {
      act(() => {
        useAppStore.setState({
          workspaces: [
            buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Acme', slug: 'acme' }),
            buildStoryWorkspace({ id: NORTHWIND, name: 'Northwind', slug: 'northwind' }),
          ],
        });
      });
    });

    it('names the target on the chip and marks it busy', () => {
      act(() => {
        useAppStore.setState({ switchingToWorkspaceId: NORTHWIND });
      });
      renderMark();

      const trigger = screen.getByLabelText('Switch workspace: Acme');
      expect(trigger.getAttribute('aria-busy')).toBe('true');
      screen.getByText('Northwind');
      expect(screen.queryByText('Acme')).toBeNull();
    });

    it('keeps the old name and says the switch failed, then retries the same target', () => {
      const setCurrentWorkspace = vi.fn(async () => undefined);
      act(() => {
        useAppStore.setState({
          workspaceSwitchError: { workspaceId: NORTHWIND, message: 'boom' },
          setCurrentWorkspace,
        });
      });
      renderMark();

      screen.getByText('Acme');
      expect(screen.getByRole('alert').textContent).toContain("Couldn't open Northwind.");
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(setCurrentWorkspace).toHaveBeenCalledWith({ id: NORTHWIND });
    });

    it('shows the failed switch outside a clipping 320px bar, so the bar cannot cut it', () => {
      act(() => {
        useAppStore.setState({
          workspaceSwitchError: { workspaceId: NORTHWIND, message: 'boom' },
        });
      });
      render(
        <div data-testid="clip" style={{ width: 320, overflow: 'hidden' }}>
          <ShellRail label="Places" form="wide">
            <WorkspaceIdentityRow />
          </ShellRail>
        </div>,
      );

      const alert = screen.getByRole('alert');
      expect(screen.getByTestId('clip').contains(alert)).toBe(false);
      expect(alert.closest('[data-anchored-layer]')?.parentElement).toBe(document.body);
    });
  });
});
