import { expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { pressShortcut } from '../../helpers/pressKey';
import { RAIL_FILE_PATHS } from './files-rail.runner';
import { type Ctx, type Row, WAIT, branchTab, click, clickFirstButton, settle } from './harness';

const FILE_COUNT = RAIL_FILE_PATHS.length;
const THIRD_FILE = /^seenEvents\.ts/;
const FILES_BUTTON = `Files, 0 of ${FILE_COUNT} viewed`;

const STRIP_PANE = 1196;
const BUTTON_PANE = 1100;
const DOCKED_PANE = 1920;

type Frame = {
  readonly title: HTMLElement;
  readonly tabs: HTMLElement;
};

let frame: Frame | null = null;

const stubPane = ({ width }: { readonly width: number }): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.hasAttribute('data-diff-rail-scope')
      ? new DOMRect(0, 0, width, 800)
      : new DOMRect(0, 0, 0, 0);
  });
};

const press = async (id: ShortcutId): Promise<void> => {
  pressShortcut({ id });
  await settle();
};

const escape = async (): Promise<void> => {
  await userEvent.setup().keyboard('{Escape}');
  await settle();
};

const rail = (): HTMLElement | null => screen.queryByRole('complementary', { name: 'Files' });

const thirdRow = (): HTMLElement =>
  within(screen.getByRole('navigation', { name: 'Changed files' })).getByRole('button', {
    name: THIRD_FILE,
  });

const toolbarButton = (): HTMLElement =>
  within(document.querySelector('[data-slot="diff-toolbar"]') as HTMLElement).getByRole('button', {
    name: FILES_BUTTON,
  });

const visit = async ({ ctx, tab }: { readonly ctx: Ctx; readonly tab: 'comments' | 'files' }) => {
  await click(screen.getByRole('tab', { name: tab === 'files' ? /^Files/ : /^Comments/ }));
  await branchTab(tab)(ctx);
};

const folderRow = ({
  label,
  isOpen,
}: {
  readonly label: RegExp;
  readonly isOpen: boolean;
}): HTMLElement =>
  within(screen.getByRole('navigation', { name: 'Changed files' })).getByRole('button', {
    name: label,
    expanded: isOpen,
  });

const headerPart = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`[data-slot="pane-header"] ${selector}`);
  if (element === null) {
    throw new Error(`the Branch header has no ${selector}`);
  }
  return element;
};

const openBranchOnComments = async (ctx: Ctx): Promise<void> => {
  await clickFirstButton(/^Open PR #\d+ of /);
  await branchTab('pr')(ctx);
  await click(await screen.findByRole('tab', { name: /^Comments/ }));
  await branchTab('comments')(ctx);
  frame = { title: headerPart('h1'), tabs: headerPart('[role="tablist"]') };
};

const expectSameFrame = (): void => {
  expect(frame).not.toBeNull();
  expect(headerPart('h1')).toBe(frame?.title);
  expect(headerPart('[role="tablist"]')).toBe(frame?.tabs);
};

const downToThirdFile = async (): Promise<void> => {
  for (let step = 0; step < 3; step += 1) {
    await press('diff.fileDown');
  }
};

const leaveAndComeBack = async (ctx: Ctx): Promise<void> => {
  await visit({ ctx, tab: 'comments' });
  expect(rail()).toBeNull();
  expect(document.querySelector('[data-slot="diff-rail-host"]')).toBeNull();
  expectSameFrame();
  await visit({ ctx, tab: 'files' });
  expectSameFrame();
};

export const FILES_RAIL_ROWS: ReadonlyArray<Row> = [
  {
    name: 'files rail: strip, J to the third file, the toggle key, F opens the overlay, Esc closes it',
    covers: ['navigate', 'files-rail:strip'],
    open: async (ctx) => {
      stubPane({ width: STRIP_PANE });
      await openBranchOnComments(ctx);
      await visit({ ctx, tab: 'files' });
      const strip = await screen.findByRole('button', { name: FILES_BUTTON }, WAIT);
      expect(rail()).toBeNull();

      await downToThirdFile();
      await press('diff.toggleTree');
      expect(rail()?.getAttribute('data-rail')).toBe('overlay');
      expect(thirdRow().getAttribute('aria-current')).toBe('true');
      await press('diff.toggleTree');
      expect(rail()).toBeNull();

      await press('diff.focusTree');
      expect(rail()?.getAttribute('data-rail')).toBe('overlay');
      expect(document.activeElement).toBe(thirdRow());
      await escape();
      expect(rail()).toBeNull();
      expect(document.activeElement).toBe(strip);

      await leaveAndComeBack(ctx);
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('button', { name: FILES_BUTTON }, WAIT)).toBeDefined();
      expectSameFrame();
    },
  },
  {
    name: 'files rail: docked, the toggle key folds it to the strip and F docks it again',
    covers: ['navigate', 'files-rail:docked'],
    open: async (ctx) => {
      stubPane({ width: DOCKED_PANE });
      await openBranchOnComments(ctx);
      await visit({ ctx, tab: 'files' });
      await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);
      expect(rail()?.getAttribute('data-rail')).toBe('docked');

      await downToThirdFile();
      await press('diff.toggleTree');
      expect(rail()).toBeNull();
      expect(screen.getByRole('button', { name: FILES_BUTTON })).toBeDefined();

      await press('diff.focusTree');
      expect(rail()?.getAttribute('data-rail')).toBe('docked');
      expect(document.activeElement).toBe(thirdRow());
      await escape();
      expect(rail()?.getAttribute('data-rail')).toBe('docked');

      await leaveAndComeBack(ctx);
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('navigation', { name: 'Changed files' }, WAIT)).toBeDefined();
      expectSameFrame();
    },
  },
  {
    name: 'files rail: button, the toolbar control opens the overlay and Esc hands focus back to it',
    covers: ['navigate', 'files-rail:button'],
    open: async (ctx) => {
      stubPane({ width: BUTTON_PANE });
      await openBranchOnComments(ctx);
      await visit({ ctx, tab: 'files' });
      await screen.findByRole('button', { name: FILES_BUTTON }, WAIT);
      expect(rail()).toBeNull();
      const button = toolbarButton();
      expect(
        within(document.querySelector('[data-slot="diff-toolbar"]') as HTMLElement).getAllByRole(
          'button',
        )[0],
      ).toBe(button);

      await downToThirdFile();
      await click(button);
      expect(rail()?.getAttribute('data-rail')).toBe('overlay');
      expect(thirdRow().getAttribute('aria-current')).toBe('true');
      await escape();
      expect(rail()).toBeNull();
      expect(document.activeElement).toBe(toolbarButton());

      await leaveAndComeBack(ctx);
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('button', { name: FILES_BUTTON }, WAIT)).toBeDefined();
      expectSameFrame();
    },
  },
  {
    name: 'files rail: folders closed in the tree stay closed after a visit to Comments',
    covers: ['navigate', 'files-rail:docked'],
    open: async (ctx) => {
      stubPane({ width: DOCKED_PANE });
      await openBranchOnComments(ctx);
      await visit({ ctx, tab: 'files' });
      await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);

      await click(folderRow({ label: /\bwebhooks\b/, isOpen: true }));
      await click(folderRow({ label: /\btest\b/, isOpen: true }));
      expect(folderRow({ label: /\bwebhooks\b/, isOpen: false })).toBeDefined();
      expect(folderRow({ label: /\btest\b/, isOpen: false })).toBeDefined();

      await leaveAndComeBack(ctx);

      await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);
      expect(folderRow({ label: /\bwebhooks\b/, isOpen: false })).toBeDefined();
      expect(folderRow({ label: /\btest\b/, isOpen: false })).toBeDefined();
      expect(folderRow({ label: /\bledger\b/, isOpen: true })).toBeDefined();
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('navigation', { name: 'Changed files' }, WAIT)).toBeDefined();
    },
  },
];
