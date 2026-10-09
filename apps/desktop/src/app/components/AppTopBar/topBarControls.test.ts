// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TOP_BAR_CONTROL } from '@goodboy/ui';

const SRC = join(__dirname, '..', '..', '..');

const CONTROL_SOURCES: ReadonlyArray<string> = [
  'app/components/AppTopBar/NavCluster/HistoryArrow.tsx',
  'app/components/AppTopBar/NavCluster/BoardButton.tsx',
  'app/components/AppTopBar/NavCluster/ChatButton.tsx',
  'app/components/AppTopBar/CommandCenter.tsx',
  'app/components/AppTopBar/ThemeToggle/index.tsx',
  'app/components/AppTopBar/ImpactButton.tsx',
  'app/components/AppTopBar/SpendButton.tsx',
  'app/components/AppTopBar/NowChip/index.tsx',
  'app/components/AppTopBar/LimitsStrip/LimitsChip.tsx',
  'app/components/AppTopBar/LimitsStrip/LimitsOverflowPopover.tsx',
  'app/components/AppTopBar/LimitsStrip/LimitsProvidersMenu.tsx',
  'features/notifications/components/NotificationCenter/index.tsx',
];

const BAR_SIZES = /(?<![\w-])(?:h|size)-(?:5|6|8|9)(?![\w.-])/;
const NEGATIVE_OFFSET = /'[^']*(?<![\w-])-(?:top|right|bottom|left)-(?!0\.5(?![\d]))[^\s']+/;

const sourceOf = ({ path }: { readonly path: string }): string =>
  readFileSync(join(SRC, path), 'utf8');

describe('every control in the top bar is 28 high with a 6px radius', () => {
  it('has one token for the bar control: 28 high, square, rounded-md', () => {
    expect(TOP_BAR_CONTROL.heightPx).toBe(28);
    expect(TOP_BAR_CONTROL.height).toBe('h-7');
    expect(TOP_BAR_CONTROL.square).toBe('size-7');
    expect(TOP_BAR_CONTROL.radius).toBe('rounded-md');
  });

  it.each(CONTROL_SOURCES)('%s takes its geometry from the token', (path) => {
    const text = sourceOf({ path });

    expect(text).toContain('TOP_BAR_CONTROL.');
    expect(text).toContain('TOP_BAR_CONTROL.radius');
  });

  it.each(CONTROL_SOURCES)('%s names no other control height', (path) => {
    const controlClasses = sourceOf({ path })
      .split('\n')
      .filter((line) => /'(?:flex|relative)[^']*'/.test(line) && !/h-(?:2|3|4)\b/.test(line));

    expect(controlClasses.filter((line) => BAR_SIZES.test(line))).toEqual([]);
  });

  it('keeps the bar container at 36 so a 28 control has 4px above and below', () => {
    expect(sourceOf({ path: 'app/components/AppTopBar/index.tsx' })).toContain('h-9');
  });

  it('keeps the bell badge inside the bell box, not on its edge', () => {
    const bell = sourceOf({
      path: 'features/notifications/components/NotificationCenter/index.tsx',
    });
    const badge = bell.split('\n').find((line) => line.includes('bg-warning'));

    expect(badge).toBeDefined();
    expect(NEGATIVE_OFFSET.test(badge ?? '')).toBe(false);
    expect(badge).toContain('right-0.5');
    expect(badge).toContain('top-0.5');
  });
});
