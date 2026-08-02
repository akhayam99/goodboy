import type { LucideIcon } from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { LensKind } from '../../../../../../store';
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
  readonly runningScripts: number;
  readonly summarizerDot?: LensDot;
  readonly liveTerminals: number;
  readonly integrationRows: ReadonlyArray<LensRow>;
};

export const LENS_SHORTCUTS = {
  questions: '⌘⇧Q',
  agents: '⌘⇧B',
  workflows: '⌘⇧W',
  resolve: '⌘⇧R',
  review: null,
  plans: '⌘⇧L',
  scripts: '⌘⇧S',
  terminal: '⌘J',
  goal: '⌘⇧G',
  decisions: '⌘⇧E',
  last_output_summary: '⌘⇧U',
  pr: '⌘⇧H',
  files: '⌘⇧D',
  explore: '⌘⇧D',
  linear: null,
  sentry: null,
  gitlab_issues: null,
} satisfies Readonly<Record<LensKind, string | null>>;

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
          tone: 'primary',
          dot: summarizerDot,
        },
        {
          kind: 'decisions',
          label: 'Decisions',
          icon: CONCEPT_ICONS.decisions,
          tone: 'success',
          dot: summarizerDot,
        },
        {
          kind: 'last_output_summary',
          label: 'Session summary',
          icon: CONCEPT_ICONS.sessionSummary,
          tone: 'info',
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
                tone: 'primary',
                count: reviewDraftCount,
                repoOnly: true,
              } satisfies LensRow,
            ]
          : []),
        {
          kind: 'workflows',
          label: 'Workflows',
          icon: CONCEPT_ICONS.workflows,
          tone: 'accent',
          count: activeWorkflows,
          ...flags('workflows'),
        },
        {
          kind: 'agents',
          label: 'Agents',
          icon: CONCEPT_ICONS.agents,
          tone: 'primary',
          count: agentCount,
          isCountLoading: areAgentsLoading,
          dot: flags('agents').dot ?? (hasRunningAgent ? 'running' : undefined),
        },
        {
          kind: 'resolve',
          label: 'Resolve',
          icon: CONCEPT_ICONS.resolve,
          tone: 'success',
          count: openResolvers,
          isCountLoading: areAgentsLoading,
          ...flags('resolve'),
          secondaryDot: hasPendingBatch,
          repoOnly: true,
        },
        {
          kind: 'questions',
          label: 'Questions',
          icon: CONCEPT_ICONS.questions,
          tone: 'warning',
          count: openCount,
          isCountLoading: areQuestionsLoading,
        },
        ...(isBranchless
          ? [
              {
                kind: 'explore',
                label: 'Explore',
                icon: CONCEPT_ICONS.explore,
                tone: 'info',
              } satisfies LensRow,
              {
                kind: 'files',
                label: 'File versions',
                icon: CONCEPT_ICONS.diff,
                tone: 'info',
                count: filesCount,
              } satisfies LensRow,
            ]
          : [
              {
                kind: 'files',
                label: 'Diff',
                icon: CONCEPT_ICONS.diff,
                tone: 'info',
                count: filesCount,
                diffstat,
                repoOnly: true,
              } satisfies LensRow,
            ]),
        {
          kind: 'plans',
          label: 'Plans',
          icon: CONCEPT_ICONS.plans,
          tone: 'success',
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
          tone: 'info',
          count: runningScripts,
          dot: runningScripts > 0 ? 'running' : undefined,
          repoOnly: true,
        },
        {
          kind: 'terminal',
          label: 'Terminal',
          icon: CONCEPT_ICONS.terminal,
          tone: 'neutral',
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
    return groups.filter((group) => group.rows.length > 0 || group.label === 'Integrations');
  }

  return groups
    .filter((group) => group.repoOnly !== true)
    .map((group) => ({ ...group, rows: group.rows.filter((row) => row.repoOnly !== true) }))
    .filter((group) => group.rows.length > 0);
};
