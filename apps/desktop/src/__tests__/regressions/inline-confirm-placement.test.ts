import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SOURCE_ROOTS = [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);
const CONFIRM_POPOVER = ['packages', 'ui', 'src', 'components', 'ConfirmPopover.tsx'].join(sep);

const PENDING: ReadonlyArray<string> = [
  'apps/desktop/src/features/integrations/components/IntegrationDisconnect/index.tsx',
  'apps/desktop/src/features/session/components/SessionOverviewPane/ProjectMountRows/RemoveWorktreeAction.tsx',
  'apps/desktop/src/features/workflows/components/OrchestratorPanel/index.tsx',
  'apps/desktop/src/features/workflows/components/WorkflowNextStepCta/index.tsx',
  'apps/desktop/src/features/workspace/components/WorkspacesSidebar/parts/WorkflowDeleteButton.tsx',
  'apps/desktop/src/features/workspace/components/WorkspacesSidebar/parts/WorkflowKillButton.tsx',
  'apps/desktop/src/features/workspace/components/WorkspacesSidebar/parts/WorkflowRunStartButton.tsx',
];

const CONFIRM_TAG = /<InlineConfirm\b(?:[^\n]*\/>|[\s\S]*?\n\s*\/?>)/g;

const listSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      acc.push(full);
    }
  }
  return acc;
};

const placementProblem = (source: string): string | null => {
  if (!source.includes('<InlineConfirm')) {
    return null;
  }
  if (/\babsolute\b[^'"`]*\btop-full\b/.test(source)) {
    return 'floats InlineConfirm with absolute top-full; use ConfirmPopover';
  }
  if (!source.includes('<AnchoredPopover') && !source.includes('<Popover')) {
    return null;
  }
  const tags = source.match(CONFIRM_TAG) ?? [];
  const carded = tags.filter((tag) => !tag.includes('surface="plain"'));
  if (carded.length === 0) {
    return null;
  }
  return 'nests a card InlineConfirm in a popover; use ConfirmPopover or a plain menu swap';
};

describe('inline confirm placement', () => {
  it('renders only as a row swap, a ConfirmPopover or a plain menu swap', () => {
    const offenders: string[] = [];
    const seen = new Set<string>();
    for (const root of SOURCE_ROOTS) {
      for (const file of listSourceFiles(root)) {
        if (file.endsWith(CONFIRM_POPOVER)) {
          continue;
        }
        const path = relative(REPO_ROOT, file).split(sep).join('/');
        const problem = placementProblem(readFileSync(file, 'utf8'));
        if (problem === null) {
          continue;
        }
        seen.add(path);
        if (PENDING.includes(path)) {
          continue;
        }
        offenders.push(`${path}: ${problem}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
    expect(
      PENDING.filter((path) => !seen.has(path)),
      'remove migrated files from PENDING',
    ).toEqual([]);
  });
});
