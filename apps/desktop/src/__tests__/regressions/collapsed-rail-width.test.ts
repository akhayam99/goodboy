import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';

const SOURCE_ROOT = join(__dirname, '..', '..');

const TOP_BAR = readFileSync(
  join(SOURCE_ROOT, 'app', 'components', 'AppTopBar', 'index.tsx'),
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

describe('collapsed rail and title bar inset', () => {
  it('pads the top bar with the title bar inset, never a fixed spacing step', () => {
    const bar = classNameContaining({ source: TOP_BAR, marker: 'grid h-9' });

    expect(bar).toContain('pl-(--titlebar-inset)');
    expect(bar).not.toMatch(/(?:^|\s)pl-[\d.]+(?:\s|$)/);
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
