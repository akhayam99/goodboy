// @vitest-environment node
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { FLOATING_SURFACE } from '@goodboy/ui';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');

const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');

const read = (path: string): string => readFileSync(path, 'utf8');

const HAND_PAINTED_FILL_BASELINE: ReadonlyArray<string> = [
  'apps/desktop/src/app/components/MockScene/scenes/DesignScaleScene.tsx',
  'apps/desktop/src/app/components/MockScene/scenes/ListboxScenePanel.tsx',
  'apps/desktop/src/app/components/MockScene/scenes/audit/FormsAuditScene.tsx',
  'apps/desktop/src/app/components/MockScene/scenes/u23/topbar/WorkspaceSwitcherSingleScene.tsx',
  'apps/desktop/src/app/components/MockScene/scenes/u24/settings-projects/PickerStarredScene.tsx',
  'apps/desktop/src/features/workspace-chat/components/ChatList/ChatRenameInput.tsx',
  'apps/desktop/src/features/workspace/components/SidebarPeekOverlay/index.tsx',
  'packages/ui/src/components/Dialog.tsx',
];

type SourceParams = {
  readonly root: string;
};

const sourceFiles = ({ root }: SourceParams): ReadonlyArray<string> =>
  readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter(
      (path) => path.endsWith('.tsx') && !path.includes('.test.') && !path.includes('__tests__'),
    )
    .map((path) => join(root, path));

describe('the floating fill', () => {
  it('is painted by a tsx file only through the constant, but for a fixed baseline that only falls', () => {
    const painters = [DESKTOP_SRC, UI_SRC]
      .flatMap((root) => sourceFiles({ root }))
      .filter((path) => /bg-floating/.test(read(path)) && !/FLOATING_SURFACE/.test(read(path)))
      .map((path) => path.slice(REPO_ROOT.length + 1))
      .sort();

    expect(painters).toEqual(HAND_PAINTED_FILL_BASELINE);
  });
});

describe('the floating surface', () => {
  it('is one border, one fill and one shadow', () => {
    expect(FLOATING_SURFACE).toBe('rounded-lg border border-border bg-floating shadow-lg');
  });

  it.each([
    ['Popover', join(UI_SRC, 'components', 'Popover.tsx')],
    ['ContextMenu', join(UI_SRC, 'components', 'ContextMenu', 'ContextMenu.tsx')],
    ['MenuChoicePanel', join(UI_SRC, 'components', 'ContextMenu', 'MenuChoicePanel.tsx')],
    ['FactCard', join(UI_SRC, 'components', 'FactCard', 'index.tsx')],
    [
      'SessionHoverCard',
      join(DESKTOP_SRC, 'features', 'workspace', 'components', 'SessionHoverCard', 'index.tsx'),
    ],
    [
      'SessionSwitcher',
      join(
        DESKTOP_SRC,
        'features',
        'workspace',
        'components',
        'SessionSwitcher',
        'SwitcherPanel.tsx',
      ),
    ],
  ])('paints %s from the constant, with no surface of its own', (_name, path) => {
    const source = read(path);

    expect(source).toContain('FLOATING_SURFACE');
    expect(source).not.toMatch(/bg-floating/);
    expect(source).not.toMatch(/shadow-(?:md|lg|xl)/);
  });

  it('paints the label Tooltip from the constant, with no fill of its own', () => {
    const source = read(join(UI_SRC, 'components', 'Tooltip.tsx'));

    expect(source).toContain('FLOATING_SURFACE');
    expect(source).not.toMatch(/bg-floating/);
  });

  it('keeps the FactCard parts free of a surface of their own', () => {
    const parts = readdirSync(join(UI_SRC, 'components', 'FactCard')).filter(
      (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx') && file !== 'index.tsx',
    );

    expect(parts.length).toBeGreaterThan(0);
    parts.forEach((file) => {
      expect(read(join(UI_SRC, 'components', 'FactCard', file))).not.toMatch(
        /bg-floating|bg-elevated|shadow-(?:md|lg|xl)/,
      );
    });
  });

  it.each([
    ['CrumbMenuTrigger', join(UI_SRC, 'components', 'Trail', 'CrumbMenuTrigger.tsx')],
    [
      'HistoryArrow',
      join(DESKTOP_SRC, 'app', 'components', 'AppTopBar', 'NavCluster', 'HistoryArrow.tsx'),
    ],
  ])('lets %s take the Popover surface without overriding it', (_name, path) => {
    const source = read(path);

    expect(source).toContain('<AnchoredPopover');
    expect(source).not.toMatch(/bg-floating|border-border-soft|shadow-(?:md|lg|xl)/);
  });

  it('lets UpdateArrivalCard take the Popover surface without overriding it', () => {
    const source = read(
      join(DESKTOP_SRC, 'features', 'updater', 'components', 'UpdateArrivalCard.tsx'),
    );

    expect(source).toContain('<Popover');
    expect(source).not.toMatch(/bg-floating|border-border-soft|shadow-(?:md|lg|xl)/);
  });
});
