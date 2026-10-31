// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { productSources } from './scanControls';

const css = readFileSync(join(__dirname, '..', '..', 'styles.css'), 'utf8');

const NUMBER_CARRIERS: ReadonlyArray<string> = [
  'apps/desktop/src/shared/components/RelativeTime/index.tsx',
  'apps/desktop/src/shared/components/toneCountClass.ts',
  'apps/desktop/src/features/notifications/components/NotificationsStudio/FacetCount.tsx',
  'apps/desktop/src/features/notifications/components/NotificationRow/index.tsx',
  'apps/desktop/src/features/notifications/components/NotificationRow/NotificationRowDetail.tsx',
  'apps/desktop/src/features/branch/components/WorktreeEntrySlot.tsx',
  'apps/desktop/src/features/storage/components/StoragePage/ArtifactRow.tsx',
  'apps/desktop/src/features/storage/components/StoragePage/WorktreeRow.tsx',
  'apps/desktop/src/features/search/components/SearchMode/SearchResultRow.tsx',
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/SlotHistoryPanel.tsx',
  'packages/ui/src/components/ListGrid/ListGridRow.tsx',
  'packages/ui/src/components/WorkTree/workMetaSpec.ts',
];

const COUNT_FACT_FILES: ReadonlyArray<string> = [
  'apps/desktop/src/shared/utils/countSlotText.ts',
  'apps/desktop/src/features/session/pageSlot.ts',
  'apps/desktop/src/features/branch/worktreeEntryFacts.ts',
  'apps/desktop/src/features/branch/branchRowFactsOf.ts',
];

const NUMERIC_COLUMN_KEY = /key:\s*'(?:age|time|updated|lastRun|cost|steps|runs|request)'/;

describe('numbers are tabular, words are not', () => {
  it('does not force tabular figures on text-meta or text-chip', () => {
    expect(css).not.toMatch(/\.text-meta\b/);
    expect(css).not.toMatch(/\.text-chip\b/);
    expect(css).not.toMatch(/@utility text-(?:meta|chip)\b/);
  });

  it.each(NUMBER_CARRIERS)('%s carries tabular-nums itself', (path) => {
    const source = productSources().find((file) => file.path === path);
    expect(source, `${path} must exist`).toBeDefined();
    expect(source?.text).toContain('tabular-nums');
  });

  it('puts tabular-nums on every file that draws a count slot', () => {
    const offenders = productSources()
      .filter(
        ({ path, text }) =>
          text.includes('countSlotText(') &&
          !COUNT_FACT_FILES.includes(path) &&
          !text.includes('tabular-nums'),
      )
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it('marks every time, cost and count column of a ListGrid as numeric', () => {
    const offenders = productSources().flatMap(({ path, text }) =>
      text
        .split('\n')
        .filter((line) => NUMERIC_COLUMN_KEY.test(line) && /width:\s*\d+/.test(line))
        .filter((line) => !line.includes('isNumeric: true'))
        .map((line) => `${path}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
