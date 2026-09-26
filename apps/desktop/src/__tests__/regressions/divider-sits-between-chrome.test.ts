import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SOURCE_ROOTS = [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  join(REPO_ROOT, 'packages', 'ui', 'src'),
];
const SKIP_SEGMENTS = new Set(['__tests__', 'node_modules', 'dist']);

const DIVIDER_COMPONENT = /<Divider\b/g;
const DIVIDE_UTILITY = /\bdivide-[xy]\b/g;
const HR_TAG = /<hr\b/g;
const BORDER_DIVIDER = /\bborder-[tb](?!-0)\b/g;

const BORDER_FALSE_POSITIVE_FILES = new Set([
  'apps/desktop/src/features/notifications/components/NotificationRow/NotificationRowDetail.tsx',
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane/ActivityFilterPanel/ActivityFilterOption.tsx',
  'apps/desktop/src/features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectList.tsx',
]);

type Reason = 'chrome' | 'markdown' | 'debt';

type Allowance = {
  readonly count: number;
  readonly reason: Reason;
};

const ALLOWED: Readonly<Record<string, Allowance>> = {
  'apps/desktop/src/app/components/AppFooter/index.tsx': { count: 1, reason: 'chrome' },
  'apps/desktop/src/app/components/AppFooter/GoodboyChip/GoodboyMenu.tsx': {
    count: 2,
    reason: 'chrome',
  },
  'apps/desktop/src/app/components/AppFooter/GoodboyChip/index.tsx': { count: 1, reason: 'chrome' },
  'apps/desktop/src/app/components/AppTopBar/index.tsx': { count: 1, reason: 'chrome' },
  'apps/desktop/src/app/components/AppTopBar/NowChip/index.tsx': { count: 1, reason: 'debt' },
  'apps/desktop/src/features/artifacts/components/ArtifactCreationPane/ArtifactCreationFooter.tsx':
    { count: 1, reason: 'chrome' },
  'apps/desktop/src/features/artifacts/components/ArtifactStudio/ArtifactConversation/index.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/budget/components/spend/CapEditor.tsx': { count: 1, reason: 'debt' },
  'apps/desktop/src/features/budget/components/spend/SessionBudgetContent.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/chat/components/ChatInput/index.tsx': { count: 1, reason: 'debt' },
  'apps/desktop/src/features/chat/components/ChatView/index.tsx': { count: 1, reason: 'debt' },
  'apps/desktop/src/features/companion/components/CompanionStudio/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/explore/components/ExplorePane/ExplorePreviewPanel.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/explore/components/ExplorePane/ExploreSpawnPopover.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/features/github/components/PullRequest/CreatePrPanel.tsx': {
    count: 5,
    reason: 'debt',
  },
  'apps/desktop/src/features/github/components/PullRequest/ThreadReplies.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/impact/components/ImpactStudio/RailGroupLabel.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/inbox/components/InboxStudio/InboxStudioLayout.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm.tsx': {
    count: 4,
    reason: 'debt',
  },
  'apps/desktop/src/features/integrations/jira/AssigneePicker.tsx': { count: 3, reason: 'debt' },
  'apps/desktop/src/features/integrations/jira/TransitionMenu.tsx': { count: 1, reason: 'debt' },
  'apps/desktop/src/features/notifications/components/NotificationCenter/index.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/features/onboarding/OnboardingWizard/steps/ProviderRow.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/permissions/components/DiffViewSelector/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/providers/components/ProviderConnect/ConnectDetails.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/resolve/components/ResolvePanelHeader/index.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/resolve/components/ResolveItemView/index.tsx': {
    count: 2,
    reason: 'chrome',
  },
  'apps/desktop/src/features/session/components/CommandPalette/index.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/session/components/CreateAgentPopover/index.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/session/components/SessionOverviewPane/ProjectMountRows/DetachDetails.tsx':
    { count: 1, reason: 'debt' },
  'apps/desktop/src/features/session/components/SessionOverviewPane/ProjectMountRows/ProjectSyncControl.tsx':
    { count: 1, reason: 'debt' },
  'apps/desktop/src/features/session/components/SessionOverviewPane/SessionCostChip.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/FileVersionsPane/index.tsx':
    { count: 1, reason: 'debt' },
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane/ActivityFilterPanel/index.tsx':
    { count: 1, reason: 'debt' },
  'apps/desktop/src/features/session/components/SessionWorkspace/parts/TimelinePane/TimelineDayRule.tsx':
    { count: 1, reason: 'chrome' },
  'apps/desktop/src/features/settings/components/GuideStudio/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/settings/components/ImportConfigDialog/index.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/features/settings/components/ReportIssueForm/index.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/features/settings/components/ReportIssueStudio/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/skills/components/SkillsPanel/index.tsx': {
    count: 5,
    reason: 'debt',
  },
  'apps/desktop/src/features/terminal/components/TerminalDock/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/workflows/components/RunSpendLimitPopover/index.tsx': {
    count: 2,
    reason: 'chrome',
  },
  'apps/desktop/src/features/workspace/components/ProjectGitPill/ProjectGitDetail.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/features/workspace/components/ProjectGitPill/ProjectGitSummaryPill.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/workspace/components/SessionActivityBar/SessionViewMenu/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/workspace/components/WorkspaceLinkForm/index.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/workspace/components/WorkspaceSwitcher/index.tsx': {
    count: 2,
    reason: 'debt',
  },
  'apps/desktop/src/shared/components/PaneShell/FocusedPane.tsx': { count: 1, reason: 'chrome' },
  'apps/desktop/src/shared/components/PaneShell/index.tsx': { count: 1, reason: 'chrome' },
  'apps/desktop/src/shared/components/RoutingPicker/RoutingPickerBody.tsx': {
    count: 1,
    reason: 'chrome',
  },
  'apps/desktop/src/shared/components/StudioShell/StudioBand.tsx': { count: 1, reason: 'chrome' },
  'packages/ui/src/components/Dialog.tsx': { count: 3, reason: 'chrome' },
  'packages/ui/src/components/DrawerFrame.tsx': { count: 1, reason: 'chrome' },
  'packages/ui/src/components/Markdown/index.tsx': { count: 3, reason: 'markdown' },
  'apps/desktop/src/app/components/MockScene/scenes/audit/UpdateConfirmScene.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/app/components/MockScene/scenes/audit/ToastsScene.tsx': {
    count: 1,
    reason: 'debt',
  },
  'apps/desktop/src/features/reports/components/ArtifactReaderView/PrintLetterhead.tsx': {
    count: 1,
    reason: 'chrome',
  },
};

type ListParams = {
  readonly dir: string;
  readonly acc: string[];
};

const listSourceFiles = ({ dir, acc }: ListParams): string[] => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(entry)) {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles({ dir: full, acc });
      continue;
    }
    const isSource = entry.endsWith('.ts') || entry.endsWith('.tsx');
    if (isSource && !entry.includes('.test.')) {
      acc.push(full);
    }
  }
  return acc;
};

type CountParams = {
  readonly path: string;
  readonly source: string;
};

const countDividerSignals = ({ path, source }: CountParams): number => {
  const component = source.match(DIVIDER_COMPONENT)?.length ?? 0;
  const utility = source.match(DIVIDE_UTILITY)?.length ?? 0;
  const hr = source.match(HR_TAG)?.length ?? 0;
  const border = BORDER_FALSE_POSITIVE_FILES.has(path)
    ? 0
    : (source.match(BORDER_DIVIDER)?.length ?? 0);
  return component + utility + hr + border;
};

const measure = (): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const root of SOURCE_ROOTS) {
    for (const file of listSourceFiles({ dir: root, acc: [] })) {
      const path = relative(REPO_ROOT, file).split(sep).join('/');
      const count = countDividerSignals({ path, source: readFileSync(file, 'utf8') });
      if (count > 0) {
        counts[path] = count;
      }
    }
  }
  return counts;
};

describe('a divider sits between chrome and content, never inside content', () => {
  it('counts the Divider component, divide-y/x, hr and border-t/b signals', () => {
    const source = [
      '<Divider />',
      '<Divider orientation="vertical" />',
      "className='divide-y divide-border-soft'",
      '<hr />',
      "className='flex border-t border-border-soft'",
      "className='flex border-t-0'",
    ].join('\n');
    expect(countDividerSignals({ path: 'irrelevant.tsx', source })).toBe(5);
  });

  it('excludes known pseudo-element and control-shape borders from the count', () => {
    const source = "className='before:border-b before:border-l'";
    for (const path of BORDER_FALSE_POSITIVE_FILES) {
      expect(countDividerSignals({ path, source })).toBe(0);
    }
  });

  it('keeps dividers to chrome boundaries and a frozen list of debt', () => {
    const counts = measure();
    const offenders = Object.entries(counts)
      .filter(([path, count]) => count > (ALLOWED[path]?.count ?? 0))
      .map(([path, count]) => `${path}: ${count} (allowed ${ALLOWED[path]?.count ?? 0})`);
    expect(
      offenders,
      `A Divider, divide-y/x, <hr> or border-t/b separates chrome from content, never content from content. Use gap, a Band or a labeled rule (Eyebrow, TimelineDayRule) instead. docs/styling.md owns the rule:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('shrinks the allowlist as content-level dividers go away', () => {
    const counts = measure();
    const stale = Object.entries(ALLOWED)
      .filter(([path, allowance]) => (counts[path] ?? 0) < allowance.count)
      .map(
        ([path, allowance]) => `${path}: allowed ${allowance.count}, found ${counts[path] ?? 0}`,
      );
    expect(stale, `Lower or remove these entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
