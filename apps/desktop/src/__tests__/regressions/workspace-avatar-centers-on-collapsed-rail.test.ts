import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';

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
const COLLAPSED_RAIL = readFileSync(
  join(
    SOURCE_ROOT,
    'features',
    'session',
    'components',
    'SessionNavSidebar',
    'parts',
    'CollapsedRail.tsx',
  ),
  'utf8',
);

const classNameContaining = ({ source, marker }: { source: string; marker: string }): string => {
  const match = new RegExp(`className="([^"]*${marker}[^"]*)"`).exec(source);
  if (match === null) {
    throw new Error(`No className contains ${marker}`);
  }
  return match[1] ?? '';
};

const spacingOf = ({ className, prefix }: { className: string; prefix: string }): number => {
  const match = new RegExp(`(?:^|\\s)${prefix}-([\\d.]+)(?:\\s|$)`).exec(className);
  if (match === null) {
    throw new Error(`${className} has no ${prefix} utility`);
  }
  return Number(match[1]) * SPACING_PX;
};

describe('workspace avatar centers on the collapsed rail', () => {
  it('lands the avatar center on the same vertical axis as the rail buttons', () => {
    const bar = classNameContaining({ source: TOP_BAR, marker: 'grid h-9' });
    const trigger = classNameContaining({ source: IDENTITY_ROW, marker: 'group flex w-full' });
    const avatar = classNameContaining({ source: IDENTITY_ROW, marker: 'text-3xs font-bold' });

    const avatarCenter =
      spacingOf({ className: bar, prefix: 'pl' }) +
      spacingOf({ className: trigger, prefix: 'px' }) +
      spacingOf({ className: avatar, prefix: 'size' }) / 2;

    expect(avatarCenter).toBe(COLLAPSED_RAIL_WIDTH / 2);
  });

  it('sizes the rail from the shell constant and centers its buttons', () => {
    expect(COLLAPSED_RAIL_WIDTH).toBe(44);
    expect(COLLAPSED_RAIL).toContain('style={{ width: COLLAPSED_RAIL_WIDTH }}');
    expect(COLLAPSED_RAIL).not.toMatch(/\bw-11\b/);
    expect(
      classNameContaining({ source: COLLAPSED_RAIL, marker: 'flex-col items-center' }),
    ).not.toMatch(/\bp[xl]-/);
  });
});
