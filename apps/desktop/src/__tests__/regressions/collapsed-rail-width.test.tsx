// @vitest-environment happy-dom
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { PLAIN_INSET } from '../../shared/hooks/useTitlebarInset';
import { CollapsedRail } from '../../features/session/components/SessionNavSidebar/parts/CollapsedRail';

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
afterEach(cleanup);

const classNameContaining = ({ source, marker }: { source: string; marker: string }): string => {
  const match = new RegExp(`className="([^"]*${marker}[^"]*)"`).exec(source);
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

  it('sizes the rail from the shell constant and centers its buttons', () => {
    const { container } = render(<CollapsedRail />);
    const rail = container.firstElementChild as HTMLElement;

    expect(COLLAPSED_RAIL_WIDTH).toBe(44);
    expect(rail.style.width).toBe(`${COLLAPSED_RAIL_WIDTH}px`);
    expect(rail.className).not.toMatch(/\bw-11\b/);
    expect(rail.className).not.toMatch(/\bp[xl]-/);
  });
});
