// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AppShell, COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { shellArrangement } from '../../app/shellArrangement';
import { PLAIN_INSET } from '../../shared/hooks/useTitlebarInset';

const SOURCE_ROOT = join(__dirname, '..', '..');
const SPACING_PX = 4;

const TOP_BAR = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'AppTopBar', 'index.tsx'),
  'utf8',
);
const IDENTITY_ROW = readFileSync(
  join(SOURCE_ROOT, 'features', 'workspace', 'components', 'WorkspaceIdentityRow', 'index.tsx'),
  'utf8',
);
const STYLES = readFileSync(join(SOURCE_ROOT, 'styles.css'), 'utf8');
const COLUMN_RAIL = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'SideColumn', 'ColumnRail.tsx'),
  'utf8',
);
const RAIL_BUTTON = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'SideColumn', 'RailButton.tsx'),
  'utf8',
);
const RAIL_SESSION_LEVEL = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'SessionRail', 'RailSessionLevel.tsx'),
  'utf8',
);
afterEach(cleanup);

const classNameContaining = ({ source, marker }: { source: string; marker: string }): string => {
  const match = new RegExp(`(?:className="|')([^"']*${marker}[^"']*)(?:"|')`).exec(source);
  if (match === null) {
    throw new Error(`No className contains ${marker}`);
  }
  return match[1] ?? '';
};

type SpacingParams = {
  readonly className: string;
  readonly prefix: string;
};

const spacingOf = ({ className, prefix }: SpacingParams): number => {
  const match = new RegExp(`(?:^|\\s)${prefix}-([\\d.]+)(?:\\s|$)`).exec(className);
  if (match === null) {
    throw new Error(`${className} has no ${prefix} utility`);
  }
  return Number(match[1]) * SPACING_PX;
};

describe('workspace tile and collapsed rail axis', () => {
  it('lands the workspace tile center on the rail button axis', () => {
    const bar = classNameContaining({ source: TOP_BAR, marker: 'grid h-9' });
    const row = classNameContaining({ source: IDENTITY_ROW, marker: 'flex w-full' });
    const trigger = classNameContaining({ source: IDENTITY_ROW, marker: 'group flex w-full' });
    const tile = classNameContaining({ source: IDENTITY_ROW, marker: 'flex size-5' });

    const tileCenter =
      spacingOf({ className: bar, prefix: 'px' }) +
      Number.parseFloat(PLAIN_INSET) +
      spacingOf({ className: trigger, prefix: 'px' }) +
      spacingOf({ className: tile, prefix: 'size' }) / 2;

    expect(tileCenter).toBe(22);
    expect(tileCenter).toBe(COLLAPSED_RAIL_WIDTH / 2);
    expect(row).toContain('ml-(--titlebar-inset)');
    expect(STYLES).toContain(`--titlebar-inset: ${PLAIN_INSET};`);
  });

  it('sizes the rail of doors from the same constant and keeps every icon at its open row x', () => {
    expect(COLUMN_RAIL).toContain('style={{ width: COLLAPSED_RAIL_WIDTH }}');
    expect(COLUMN_RAIL).toContain(
      'className="flex h-full min-w-0 shrink-0 flex-col gap-1 pb-2 pt-1"',
    );
    expect(COLUMN_RAIL).toContain('className="flex w-11 shrink-0 items-center justify-center"');
    expect(COLUMN_RAIL).toContain("cn('flex shrink-0 flex-col px-2', PANE_RHYTHM.navRail.doorGap)");
  });

  it('draws a rail button as its open row without the word, so a fold moves no icon', () => {
    expect(RAIL_BUTTON).toContain("cn('h-7 w-full justify-start px-2', RAIL_BUTTON_BASE)");
    expect(RAIL_SESSION_LEVEL).toContain('className="flex flex-col gap-1 px-2"');
    expect(RAIL_SESSION_LEVEL).toContain('iconSize={ICON_SIZE.row}');
    expect(RAIL_SESSION_LEVEL.indexOf('<RailIdentityNode')).toBeLessThan(
      RAIL_SESSION_LEVEL.indexOf('<RailButton'),
    );
  });
});

describe('the column keeps its pinned width while Settings holds it', () => {
  const columnWidthOf = ({ isSettingsOpen }: { readonly isSettingsOpen: boolean }): string => {
    const arrangement = shellArrangement({
      hasWorkspace: true,
      isSidebarCollapsed: true,
      isSettingsOpen,
    });
    const { container } = render(
      <AppShell
        leftSidebar={<div>column</div>}
        leftSidebarCollapsed={arrangement.isLeftRail}
        studioCoversLeft={arrangement.studioCoversLeft}
        main={<div>content</div>}
      />,
    );
    const grid = container.querySelector('main')?.parentElement as HTMLElement;
    return grid.style.gridTemplateColumns.split(' ')[0] ?? '';
  };

  it('draws the 44px rail on a folded sidebar while Settings is closed', () => {
    expect(columnWidthOf({ isSettingsOpen: false })).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
  });

  it('draws the column at its saved width on the same folded sidebar while Settings is open', () => {
    expect(columnWidthOf({ isSettingsOpen: true })).toBe('var(--goodboy-left-sidebar-width)');
  });
});
