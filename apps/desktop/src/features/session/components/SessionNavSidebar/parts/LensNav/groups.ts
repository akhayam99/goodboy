import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import type { LensKind } from '../../../../../../store';
import type { ShortcutId } from '../../../../../../shared/keyboard/registry';
import type { IntegrationGlyphProvider } from '../../../../../integrations/components/IntegrationGlyph';

export type LensDot = 'attention' | 'running';

export type LensRow = {
  readonly kind: LensKind;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly glyph?: IntegrationGlyphProvider;
  readonly tone: Tone;
  readonly count?: number;
  readonly diffstat?: {
    readonly additions: number;
    readonly deletions: number;
  };
  readonly isCountLoading?: boolean;
  readonly dot?: LensDot;
  readonly secondaryDot?: boolean;
  readonly secondaryDotLabel?: string;
  readonly isConnected?: boolean;
  readonly repoOnly?: boolean;
};

export type LensGroup = {
  readonly label: string;
  readonly rows: ReadonlyArray<LensRow>;
  readonly repoOnly?: boolean;
};

type Params = {
  readonly isBranchless: boolean;
  readonly isPrReview: boolean;
  readonly reviewDraftCount: number;
  readonly activeWorkflows: number;
  readonly attentionLens: LensKind | null;
  readonly unreadLens: LensKind | null;
  readonly agentCount: number;
  readonly areAgentsLoading: boolean;
  readonly hasRunningAgent: boolean;
  readonly openResolvers: number;
  readonly hasPendingBatch: boolean;
  readonly openCount: number;
  readonly areQuestionsLoading: boolean;
  readonly filesCount: number;
  readonly diffstat?: {
    readonly additions: number;
    readonly deletions: number;
  };
  readonly activePlans: number;
  readonly arePlansLoading: boolean;
  readonly areWorkflowsLoading: boolean;
  readonly areReviewDraftsLoading: boolean;
  readonly areFilesLoading: boolean;
  readonly runningScripts: number;
  readonly summarizerDot?: LensDot;
  readonly liveTerminals: number;
  readonly integrationRows: ReadonlyArray<LensRow>;
};

export const LENS_SHORTCUTS = {
  questions: 'lens.questions',
  agents: 'lens.agents',
  workflows: 'lens.workflows',
  resolve: 'lens.resolve',
  review: 'lens.review',
  plans: 'lens.plans',
  scripts: 'lens.scripts',
  terminal: 'lens.terminal',
  goal: 'lens.goal',
  decisions: 'lens.decisions',
  last_output_summary: 'lens.summary',
  pr: 'lens.pr',
  files: 'lens.files',
  explore: 'lens.explore',
  linear: 'lens.linear',
  sentry: 'lens.sentry',
  gitlab_issues: 'lens.gitlab_issues',
  jira_issues: 'lens.jira_issues',
  github_issue: 'lens.pr',
  slack_threads: 'lens.slack_threads',
} satisfies Readonly<Record<LensKind, ShortcutId>>;

export const buildLensGroups = ({
  isBranchless,
  isPrReview,
  reviewDraftCount,
  activeWorkflows,
  attentionLens,
  unreadLens,
  agentCount,
  areAgentsLoading,
  hasRunningAgent,
  openResolvers,
  hasPendingBatch,
  openCount,
  areQuestionsLoading,
  filesCount,
  diffstat,
  activePlans,
  arePlansLoading,
  areWorkflowsLoading,
  areReviewDraftsLoading,
  areFilesLoading,
  runningScripts,
  summarizerDot,
  liveTerminals,
  integrationRows,
}: Params): ReadonlyArray<LensGroup> => {
  const flags = (kind: LensKind): Pick<LensRow, 'dot'> => ({
    dot: attentionLens === kind || unreadLens === kind ? 'attention' : undefined,
  });

  const groups: ReadonlyArray<LensGroup> = [
    {
      label: 'Context',
      rows: [
        {
          kind: 'goal',
          label: 'Goal',
          icon: CONCEPT_ICONS.goal,
          tone: CONCEPT_TONE.goal,
          dot: summarizerDot,
        },
        {
          kind: 'decisions',
          label: 'Decisions',
          icon: CONCEPT_ICONS.decisions,
          tone: CONCEPT_TONE.decisions,
          dot: summarizerDot,
        },
        {
          kind: 'last_output_summary',
          label: 'Session summary',
          icon: CONCEPT_ICONS.sessionSummary,
          tone: CONCEPT_TONE.sessionSummary,
          dot: summarizerDot,
        },
      ],
    },
    {
      label: 'Work',
      rows: [
        ...(isPrReview
          ? [
              {
                kind: 'review',
                label: 'Review board',
                icon: CONCEPT_ICONS.review,
                tone: CONCEPT_TONE.review,
                count: reviewDraftCount,
                isCountLoading: areReviewDraftsLoading,
                repoOnly: true,
              } satisfies LensRow,
            ]
          : []),
        {
          kind: 'workflows',
          label: 'Workflows',
          icon: CONCEPT_ICONS.workflows,
          tone: CONCEPT_TONE.workflows,
          count: activeWorkflows,
          isCountLoading: areWorkflowsLoading,
          ...flags('workflows'),
        },
        {
          kind: 'agents',
          label: 'Agents',
          icon: CONCEPT_ICONS.agents,
          tone: CONCEPT_TONE.agents,
          count: agentCount,
          isCountLoading: areAgentsLoading,
          dot: flags('agents').dot ?? (hasRunningAgent ? 'running' : undefined),
        },
        {
          kind: 'resolve',
          label: 'Resolve',
          icon: CONCEPT_ICONS.resolve,
          tone: CONCEPT_TONE.resolve,
          count: openResolvers,
          isCountLoading: areAgentsLoading,
          ...flags('resolve'),
          secondaryDot: hasPendingBatch,
          secondaryDotLabel: 'Resolutions queued to push',
          repoOnly: true,
        },
        {
          kind: 'questions',
          label: 'Questions',
          icon: CONCEPT_ICONS.questions,
          tone: CONCEPT_TONE.questions,
          count: openCount,
          isCountLoading: areQuestionsLoading,
        },
        ...(isBranchless
          ? [
              {
                kind: 'explore',
                label: 'Explore',
                icon: CONCEPT_ICONS.explore,
                tone: CONCEPT_TONE.explore,
              } satisfies LensRow,
              {
                kind: 'files',
                label: 'File versions',
                icon: CONCEPT_ICONS.diff,
                tone: CONCEPT_TONE.diff,
                count: filesCount,
                isCountLoading: areFilesLoading,
              } satisfies LensRow,
            ]
          : [
              {
                kind: 'files',
                label: 'Diff',
                icon: CONCEPT_ICONS.diff,
                tone: CONCEPT_TONE.diff,
                count: filesCount,
                diffstat,
                repoOnly: true,
              } satisfies LensRow,
            ]),
        {
          kind: 'plans',
          label: 'Plans',
          icon: CONCEPT_ICONS.plans,
          tone: CONCEPT_TONE.plans,
          count: activePlans,
          isCountLoading: arePlansLoading,
        },
      ],
    },
    {
      label: 'Infra',
      rows: [
        {
          kind: 'scripts',
          label: 'Scripts',
          icon: CONCEPT_ICONS.scripts,
          tone: CONCEPT_TONE.scripts,
          count: runningScripts,
          dot: runningScripts > 0 ? 'running' : undefined,
          repoOnly: true,
        },
        {
          kind: 'terminal',
          label: 'Terminal',
          icon: CONCEPT_ICONS.terminal,
          tone: CONCEPT_TONE.terminal,
          count: liveTerminals,
          dot: liveTerminals > 0 ? 'running' : undefined,
          repoOnly: true,
        },
      ],
    },
    {
      label: 'Integrations',
      rows: integrationRows,
      repoOnly: true,
    },
  ];

  if (!isBranchless) {
    return groups;
  }

  return groups
    .filter((group) => group.repoOnly !== true)
    .map((group) => ({ ...group, rows: group.rows.filter((row) => row.repoOnly !== true) }))
    .filter((group) => group.rows.length > 0);
};
