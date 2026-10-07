// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules']);
const HAND_ROLLED_INLINE = /size="inline"/;
const HAND_WRITTEN_NONE = /<([A-Za-z][\w.]*)((?:[^<>]|=>)*?)>\s*(?:No [a-z]|Nothing\b|None\b)/g;
const WRAPPERS: ReadonlySet<string> = new Set([
  'EmptyLine',
  'EmptyState',
  'LensEmptyState',
  'FilledEmptyState',
]);

const ALLOWED: Readonly<Record<string, number>> = {
  'features/budget/components/SessionSpendPopover/AgentSpendList.tsx': 1,
  'features/budget/components/SessionSpendPopover/SpendLimitRow.tsx': 1,
  'features/changelog/components/ChangelogStudio/ChangelogRail.tsx': 1,
  'features/context/components/ContextPanel/strips/BitbucketPrStrip.tsx': 1,
  'features/diff/components/ChangeTree/index.tsx': 1,
  'features/history/components/CommitsHistory/HistoryBackups.tsx': 1,
  'features/history/components/CommitsHistory/HistoryPlannedChanges.tsx': 1,
  'features/history/components/CommitsHistory/HistoryResult.tsx': 1,
  'features/integrations/github/components/PullRequest/PrOverview.tsx': 1,
  'features/integrations/jira/AssigneePicker.tsx': 1,
  'features/permissions/components/PermissionsSettings/RecentDecisions.tsx': 1,
  'features/permissions/components/PermissionsSettings/index.tsx': 1,
  'features/session/components/AgentTree/WorkflowRow.tsx': 1,
  'features/session/components/AgentTree/WorkflowRunAsk.tsx': 1,
  'features/session/components/ContextDrawer/ContextUpdates.tsx': 1,
  'features/session/components/ContextDrawer/DecisionsSection.tsx': 1,
  'features/session/components/ContextDrawer/LearnedTab.tsx': 1,
  'features/session/components/ContextDrawer/SummaryBlock.tsx': 1,
  'features/session/components/SessionKickoff/IssueBriefProposal/BriefVerbatim.tsx': 1,
  'features/session/components/SessionKickoff/TaskStart.tsx': 1,
  'features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectList.tsx': 1,
  'features/session/components/SessionWorkspace/parts/QuestionsPane.tsx': 1,
  'features/session/trail/menus/branchMenu.tsx': 1,
  'features/settings/components/GuideStudio/parts/GuideRail.tsx': 1,
  'features/settings/components/SettingsStudio/SecurityFindingsSection.tsx': 1,
  'features/settings/components/SettingsStudio/WorkspaceSettingsFlow.tsx': 1,
  'features/storage/components/BranchesPage/RecentlyDeletedBranches.tsx': 1,
  'features/storage/components/StoragePage/ArtifactBulkDeleteBar.tsx': 1,
  'features/storage/components/StoragePage/ArtifactRow.tsx': 1,
  'features/storage/components/StoragePage/BulkRemoveBar.tsx': 1,
  'features/wireframes/components/WireframeViewer/ChangeList.tsx': 1,
  'features/workflows/components/AddStepMenu/index.tsx': 1,
  'features/workflows/components/WorkflowBuilderView/index.tsx': 1,
  'shared/components/PromptField/PromptPreview.tsx': 1,
  'shared/components/RoutingPicker/NoConnectedProviders.tsx': 1,
};

const listSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    if (SKIP_SEGMENTS.has(entry)) {
      return [];
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return listSourceFiles({ dir: full });
    }
    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) {
      return [];
    }
    return [full];
  });

type TextParams = {
  readonly text: string;
};

const countHandWrittenNone = ({ text }: TextParams): number =>
  Array.from(text.matchAll(HAND_WRITTEN_NONE)).filter((match) => !WRAPPERS.has(match[1] ?? ''))
    .length;

const toPath = (full: string): string => relative(SRC, full).split(sep).join('/');

const measure = (): Record<string, number> =>
  Object.fromEntries(
    listSourceFiles({ dir: SRC })
      .map(
        (file) =>
          [toPath(file), countHandWrittenNone({ text: readFileSync(file, 'utf8') })] as const,
      )
      .filter(([, count]) => count > 0),
  );

describe('inline empty states', () => {
  it('go through FilledEmptyState or LensEmptyState, never a hand-rolled EmptyState size="inline"', () => {
    const offenders = listSourceFiles({ dir: SRC })
      .filter((file) => HAND_ROLLED_INLINE.test(readFileSync(file, 'utf8')))
      .map(toPath);

    expect(offenders).toEqual([]);
  });
});

describe('an empty line is written through a wrapper', () => {
  it('counts text that opens with No, Nothing or None outside EmptyLine and the empty states', () => {
    expect(countHandWrittenNone({ text: '<p className="text-meta">No notes.</p>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<span>\n  Nothing to show\n</span>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<li onClick={() => open()}>None</li>' })).toBe(1);
    expect(countHandWrittenNone({ text: '<EmptyLine>No notes on this screen.</EmptyLine>' })).toBe(
      0,
    );
    expect(countHandWrittenNone({ text: '<p>Notes are saved.</p>' })).toBe(0);
    expect(countHandWrittenNone({ text: '<EmptyState title="No notes" />' })).toBe(0);
  });

  it('adds no hand-written empty sentence to any file beyond its allowance', () => {
    const counts = measure();
    const grown = Object.entries(counts)
      .filter(([path, count]) => count > (ALLOWED[path] ?? 0))
      .map(([path, count]) => `${path}: ${count} (allowed ${ALLOWED[path] ?? 0})`);

    expect(
      grown,
      `Write an empty line with EmptyLine, a first-time state with EmptyState (DESIGN-SYSTEM.md, Empty states):\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('shrinks the allowance as sentences move into the wrappers', () => {
    const counts = measure();
    const stale = Object.entries(ALLOWED)
      .filter(([path, allowed]) => (counts[path] ?? 0) < allowed)
      .map(([path, allowed]) => `${path}: allowed ${allowed}, found ${counts[path] ?? 0}`);

    expect(stale, `Lower or remove these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
