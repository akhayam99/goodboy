// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { FLOATING_SURFACE } from '@goodboy/ui';

const DESKTOP_SRC = join(__dirname, '..', '..');
const UI_SRC = join(DESKTOP_SRC, '..', '..', '..', 'packages', 'ui', 'src');

const read = (path: string): string => readFileSync(path, 'utf8');

describe('the floating surface', () => {
  it('is one border, one fill and one shadow', () => {
    expect(FLOATING_SURFACE).toBe('rounded-lg border border-border bg-floating shadow-lg');
  });

  it.each([
    ['Popover', join(UI_SRC, 'components', 'Popover.tsx')],
    ['ContextMenu', join(UI_SRC, 'components', 'ContextMenu', 'ContextMenu.tsx')],
    ['MenuChoicePanel', join(UI_SRC, 'components', 'ContextMenu', 'MenuChoicePanel.tsx')],
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
    [
      'UpdateArrivalCard',
      join(DESKTOP_SRC, 'features', 'updater', 'components', 'UpdateArrivalCard.tsx'),
    ],
    ['AppOverlayRouter', join(DESKTOP_SRC, 'app', 'components', 'AppOverlayRouter', 'index.tsx')],
  ])('paints %s from the constant, with no surface of its own', (_name, path) => {
    const source = read(path);

    expect(source).toContain('FLOATING_SURFACE');
    expect(source).not.toMatch(/bg-floating/);
    expect(source).not.toMatch(/shadow-(?:md|lg|xl)/);
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
});
