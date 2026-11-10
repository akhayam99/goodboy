// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AppShell, COLLAPSED_RAIL_WIDTH, TOP_BAR_CONTROL } from '@goodboy/ui';
import { ColumnToggleButton } from '../../app/components/SideColumn/ColumnToggleButton';
import { shellArrangement } from '../../app/shellArrangement';

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
const TILE = readFileSync(
  join(
    SOURCE_ROOT,
    'features',
    'workspace',
    'components',
    'WorkspaceSwitcher',
    'WorkspaceTile.tsx',
  ),
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
const SESSION_PAGE_ROW = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'SessionRail', 'SessionPageRow.tsx'),
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
  it('lands the sidebar toggle center on the rail button axis, with the identity after it', () => {
    const bar = classNameContaining({ source: TOP_BAR, marker: 'grid h-9' });
    const leftZone = classNameContaining({ source: TOP_BAR, marker: 'col-start-1' });
    const row = classNameContaining({ source: IDENTITY_ROW, marker: 'flex w-full' });
    const { container } = render(
      <ColumnToggleButton isCollapsed={false} onToggle={() => undefined} />,
    );
    const toggle = container.querySelector('[data-sidebar-toggle]')?.getAttribute('class') ?? '';

    const toggleCenter =
      spacingOf({ className: bar, prefix: 'px' }) +
      Number.parseFloat('0px') +
      spacingOf({ className: toggle, prefix: 'size' }) / 2;

    expect(toggleCenter).toBe(22);
    expect(toggleCenter).toBe(COLLAPSED_RAIL_WIDTH / 2);
    expect(toggle.split(/\s+/)).toContain(TOP_BAR_CONTROL.square);
    expect(TOP_BAR.indexOf('<ColumnToggleButton')).toBeLessThan(
      TOP_BAR.indexOf('<WorkspaceIdentityRow'),
    );
    expect(leftZone).toContain('pl-(--titlebar-inset)');
    expect(row).not.toContain('--titlebar-inset');
    expect(TILE).toContain('flex size-5');
    expect(STYLES).toContain(`--titlebar-inset: 0px;`);
  });

  it('sizes the rail of doors from the same constant and keeps every icon at its open row x', () => {
    expect(COLUMN_RAIL).toContain('style={{ width: COLLAPSED_RAIL_WIDTH }}');
    expect(COLUMN_RAIL).toContain(
      'className="flex h-full min-w-0 shrink-0 flex-col gap-1 pb-2 pt-1"',
    );
    expect(COLUMN_RAIL).not.toContain('<ColumnToggleButton');
    expect(COLUMN_RAIL).toContain("cn('flex shrink-0 flex-col px-2', PANE_RHYTHM.navRail.doorGap)");
  });

  it('draws a rail button as its open row without the word, so a fold moves no icon', () => {
    expect(RAIL_BUTTON).toContain("cn('h-7 w-full justify-start px-2', RAIL_BUTTON_BASE)");
    expect(RAIL_SESSION_LEVEL).toContain('className="flex flex-col gap-1 px-2"');
    expect(SESSION_PAGE_ROW).toContain('iconSize={ICON_SIZE.row}');
    expect(RAIL_SESSION_LEVEL).not.toContain('<RailIdentityNode');
  });
});

describe('the column draws what its saved fold says, on every page', () => {
  const columnWidthOf = ({
    isSidebarCollapsed,
  }: {
    readonly isSidebarCollapsed: boolean;
  }): string => {
    const arrangement = shellArrangement({ hasWorkspace: true, isSidebarCollapsed });
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

  it('draws the 44px rail on a folded sidebar', () => {
    expect(columnWidthOf({ isSidebarCollapsed: true })).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
  });

  it('draws the column at its saved width on an open sidebar', () => {
    expect(columnWidthOf({ isSidebarCollapsed: false })).toBe('var(--goodboy-left-sidebar-width)');
  });
});

describe('the top bar left zone stays above the column it folds', () => {
  it('caps the left zone at the column width while the column is open', () => {
    expect(TOP_BAR).toContain("isColumnOpen && 'max-w-(--goodboy-left-sidebar-width)'");
    expect(TOP_BAR).toContain('const isColumnOpen = sidebar?.isCollapsed === false;');
  });

  it('sets the column width on the shell root, so the top bar reads the same value', () => {
    const { container } = render(
      <AppShell
        topBar={<div>bar</div>}
        leftSidebar={<div>column</div>}
        main={<div>content</div>}
      />,
    );
    const root = container.querySelector<HTMLElement>('[data-app-backdrop]');

    expect(root?.style.getPropertyValue('--goodboy-left-sidebar-width')).not.toBe('');
  });
});
