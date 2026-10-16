import { expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShortcutId } from '../../../shared/keyboard/registry';
import { pressShortcut } from '../../helpers/pressKey';
import {
  type Ctx,
  type Row,
  WAIT,
  branchTab,
  click,
  clickFirstButton,
  findSection,
  lens,
  settle,
  useAppStore,
} from './harness';

const THIRD_FILE = /^seenEvents\.ts/;

const OVERLAY_PANE = 700;
const DOCKED_PANE = 1920;

type Frame = {
  readonly title: HTMLElement;
  readonly rail: HTMLElement;
};

let frame: Frame | null = null;

const stubPane = ({ width }: { readonly width: number }): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.hasAttribute('data-branch-pane')
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

const railNav = (): HTMLElement | null => screen.queryByRole('navigation', { name: 'Worktree' });

const treeNav = (): HTMLElement =>
  within(screen.getByRole('navigation', { name: 'Worktree' })).getByRole('navigation', {
    name: 'Changed files',
  });

const treeOf = (): HTMLElement => within(treeNav()).getByRole('tree', { name: 'Changed files' });

const thirdRow = (): HTMLElement =>
  within(treeNav()).getByRole('treeitem', {
    name: THIRD_FILE,
  });

const expectCursorOnThirdRow = (): void => {
  expect(document.activeElement).toBe(treeOf());
  expect(treeOf().getAttribute('aria-activedescendant')).toBe(thirdRow().id);
};

const sectionsButton = (): HTMLElement => screen.getByRole('button', { name: 'Sections' });

const visit = async ({ ctx, tab }: { readonly ctx: Ctx; readonly tab: 'comments' | 'files' }) => {
  await click(await findSection(tab === 'files' ? /^Files/ : /^Comments/));
  await branchTab(tab)(ctx);
};

const folderRow = ({
  label,
  isOpen,
}: {
  readonly label: RegExp;
  readonly isOpen: boolean;
}): HTMLElement =>
  within(
    within(treeNav()).getByRole('treeitem', {
      name: label,
      expanded: isOpen,
    }),
  ).getByRole('button');

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
  await click(await findSection(/^Comments/));
  await branchTab('comments')(ctx);
};

const rememberFrame = (): void => {
  frame = { title: headerPart('h1'), rail: railNav() as HTMLElement };
};

const expectSameFrame = (): void => {
  expect(frame).not.toBeNull();
  expect(headerPart('h1')).toBe(frame?.title);
  expect(railNav()).toBe(frame?.rail);
};

const downToThirdFile = async (): Promise<void> => {
  for (let step = 0; step < 3; step += 1) {
    await press('diff.fileDown');
  }
};

const leaveAndComeBack = async (ctx: Ctx): Promise<void> => {
  await visit({ ctx, tab: 'comments' });
  expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
  expectSameFrame();
  await visit({ ctx, tab: 'files' });
  expectSameFrame();
};

export const FILES_RAIL_ROWS: ReadonlyArray<Row> = [
  {
    name: 'files rail: docked, J to the third file, F puts focus in the tree, Esc leaves it in place',
    covers: ['navigate', 'files-rail:docked'],
    open: async (ctx) => {
      stubPane({ width: DOCKED_PANE });
      await openBranchOnComments(ctx);
      rememberFrame();
      await visit({ ctx, tab: 'files' });
      await screen.findByRole('navigation', { name: 'Changed files' }, WAIT);
      expect(screen.queryByRole('button', { name: 'Sections' })).toBeNull();

      await downToThirdFile();
      expect(thirdRow().getAttribute('aria-current')).toBe('true');
      await press('diff.focusTree');
      expectCursorOnThirdRow();
      await escape();
      expect(treeNav()).toBeDefined();

      await leaveAndComeBack(ctx);
    },
    lands: async (ctx) => {
      await branchTab('files')(ctx);
      expect(await screen.findByRole('navigation', { name: 'Changed files' }, WAIT)).toBeDefined();
      expectSameFrame();
    },
  },
  {
    name: 'files rail: folders closed in the tree stay closed after a visit to Comments',
    covers: ['navigate', 'files-rail:docked'],
    open: async (ctx) => {
      stubPane({ width: DOCKED_PANE });
      await openBranchOnComments(ctx);
      rememberFrame();
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
