import type { BranchIntegration, WorktreeDetachAssessment } from '@goodboy/types';
import type { MountCleanupBlocker } from '../../../../../store/slices/mount-cleanup/cleanupPolicy';
import type { DetachDisposition } from '../../../../../store/slices/project-mounts/detachProject';

export type MountAssessment = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly assessment: WorktreeDetachAssessment;
};

export type DetachDetails = {
  readonly totals: ReadonlyArray<string>;
  readonly worktrees: ReadonlyArray<string>;
};

export type DetachPlan =
  | { readonly kind: 'checking' }
  | {
      readonly kind: 'keep';
      readonly reason: 'folder' | 'blocked' | 'unavailable' | 'unverified';
      readonly lines: ReadonlyArray<string>;
      readonly details: DetachDetails;
    }
  | { readonly kind: 'missing'; readonly lines: ReadonlyArray<string> }
  | {
      readonly kind: 'safe';
      readonly lines: ReadonlyArray<string>;
      readonly details: DetachDetails;
    }
  | {
      readonly kind: 'risky';
      readonly lines: ReadonlyArray<string>;
      readonly details: DetachDetails;
    };

const NO_DETAILS = { totals: [], worktrees: [] } satisfies DetachDetails;

export type BuildDetachPlanParams = {
  readonly projectName: string;
  readonly worktreePath: string;
  readonly isRepoProject: boolean;
  readonly blockers: ReadonlyArray<MountCleanupBlocker>;
  readonly assessments: ReadonlyArray<MountAssessment> | null;
};

export const CHECKING_STATUS = 'Checking files and commits';
export const REMOVAL_STAGE = 'Removing worktree';

type ProjectNameParams = {
  readonly projectName: string;
};

export const BLOCKER_SENTENCE = {
  'agent-running': ({ projectName }: ProjectNameParams) =>
    `Work is still running in ${projectName}; stop it before removing this worktree.`,
  'terminal-open': ({ projectName }: ProjectNameParams) =>
    `A terminal is open in ${projectName}; close it before removing this worktree.`,
} satisfies Record<MountCleanupBlocker, (input: ProjectNameParams) => string>;

type CountNoun =
  | 'branch'
  | 'clean worktree'
  | 'ignored file'
  | 'local-only commit'
  | 'uncommitted file'
  | 'unpushed commit'
  | 'worktree';

const PLURAL_LABEL = {
  branch: 'branches',
  'clean worktree': 'clean worktrees',
  'ignored file': 'ignored files',
  'local-only commit': 'local-only commits',
  'uncommitted file': 'uncommitted files',
  'unpushed commit': 'unpushed commits',
  worktree: 'worktrees',
} satisfies Record<CountNoun, string>;

type CountLabelParams = {
  readonly count: number;
  readonly singular: CountNoun;
};

export const countLabel = ({ count, singular }: CountLabelParams): string =>
  count === 1 ? `1 ${singular}` : `${count} ${PLURAL_LABEL[singular]}`;

const branchLabelFor = ({
  assessed,
  fallback,
}: {
  readonly assessed: string | null;
  readonly fallback: string;
}): string => {
  if (assessed !== null && assessed !== '') {
    return assessed;
  }
  if (fallback !== '') {
    return fallback;
  }
  return 'this worktree';
};

export type Measured = {
  readonly branch: string;
  readonly path: string;
  readonly isAbsent: boolean;
  readonly hasUpstream: boolean;
  readonly affectedFiles: number;
  readonly localOnlyCommits: number;
  readonly ignoredFiles: number;
  readonly ignoredFileSamples: ReadonlyArray<string>;
  readonly integration: BranchIntegration;
};

type MountRiskParams = {
  readonly measured: Measured;
};

type MeasuredListParams = {
  readonly measured: ReadonlyArray<Measured>;
};

export const measure = ({ branch, assessment }: MountAssessment): Measured | null => {
  switch (assessment.kind) {
    case 'unavailable':
      return null;
    case 'missing':
      return {
        branch: branchLabelFor({ assessed: null, fallback: branch }),
        path: assessment.path,
        isAbsent: true,
        hasUpstream: true,
        affectedFiles: 0,
        localOnlyCommits: 0,
        ignoredFiles: 0,
        ignoredFileSamples: [],
        integration: { kind: 'unknown' },
      };
    case 'assessed':
      return {
        branch: branchLabelFor({ assessed: assessment.branch, fallback: branch }),
        path: assessment.path,
        isAbsent: false,
        hasUpstream: assessment.hasUpstream,
        affectedFiles: assessment.affectedFiles,
        localOnlyCommits: assessment.localOnlyCommits,
        ignoredFiles: assessment.ignoredFiles,
        ignoredFileSamples: assessment.ignoredFileSamples,
        integration: assessment.integration,
      };
  }
};

export const isMountRisky = ({ measured }: MountRiskParams): boolean =>
  !measured.isAbsent &&
  (measured.affectedFiles > 0 ||
    measured.localOnlyCommits > 0 ||
    !measured.hasUpstream ||
    measured.ignoredFiles > 0);

export const ignoredFilesLine = ({ measured }: MeasuredListParams): string | null => {
  const count = measured.reduce((total, entry) => total + entry.ignoredFiles, 0);
  if (count === 0) {
    return null;
  }
  const samples = measured.flatMap((entry) => entry.ignoredFileSamples).slice(0, 5);
  const noun = countLabel({ count, singular: 'ignored file' });
  return `${noun} at risk, not tracked by git: ${samples.join(', ')}.`;
};

export const isIntegrationUnknown = ({ measured }: MountRiskParams): boolean =>
  !measured.isAbsent && measured.integration.kind === 'unknown';

const presentOf = ({ measured }: MeasuredListParams): ReadonlyArray<Measured> =>
  measured.filter((entry) => !entry.isAbsent);

const unmergedOf = ({ measured }: MeasuredListParams): ReadonlyArray<Measured> =>
  measured.filter((entry) => entry.integration.kind === 'unmerged');

const baseName = ({ base }: { readonly base: string | null }): string =>
  base === null ? 'its base branch' : base;

const baseOf = ({ measured }: MountRiskParams): string | null =>
  measured.integration.kind === 'unknown' ? null : measured.integration.base;

const integrationDetailOf = ({ measured }: MountRiskParams): string => {
  switch (measured.integration.kind) {
    case 'unknown':
      return 'merge state unknown';
    case 'merged':
      return `merged into ${measured.integration.base}`;
    case 'unmerged':
      return `not merged into ${measured.integration.base}`;
  }
};

const unmergedVerb = ({ count }: { readonly count: number }): string =>
  count === 1 ? 'is' : 'are';

export const integrationLine = ({ measured }: MeasuredListParams): string | null => {
  const present = presentOf({ measured });
  const only = present[0];
  if (only === undefined) {
    return null;
  }
  const unmerged = unmergedOf({ measured: present });
  if (present.length === 1) {
    const base = baseName({ base: baseOf({ measured: only }) });
    return unmerged.length === 0
      ? `${only.branch} is merged into ${base}.`
      : `${only.branch} is not merged into ${base} yet.`;
  }
  if (unmerged.length === 0) {
    return 'Every branch is merged into its base branch.';
  }
  return `${countLabel({ count: unmerged.length, singular: 'branch' })} ${unmergedVerb({ count: unmerged.length })} not merged into the base branch yet.`;
};

export const integrationDetails = ({ measured }: MeasuredListParams): DetachDetails => {
  const present = presentOf({ measured });
  const unmerged = unmergedOf({ measured: present });
  if (unmerged.length === 0) {
    return NO_DETAILS;
  }
  return {
    totals: [`Branches not merged into the base (${unmerged.length})`],
    worktrees: present.map(
      (entry) => `${entry.branch} at ${entry.path}: ${integrationDetailOf({ measured: entry })}`,
    ),
  };
};

const CHECK_AGAIN_SENTENCE = 'Check again, or set the base branch for this project in Settings.';

type UnverifiedParams = {
  readonly unknown: ReadonlyArray<Measured>;
  readonly total: number;
  readonly projectName: string;
};

const unverifiedLines = ({
  unknown,
  total,
  projectName,
}: UnverifiedParams): ReadonlyArray<string> => {
  const only = unknown[0];
  if (total === 1 && only !== undefined) {
    return [
      `Whether ${only.branch} is merged into its base branch is unknown; detach will keep its files at ${only.path}.`,
      CHECK_AGAIN_SENTENCE,
    ];
  }
  return [
    `Whether ${countLabel({ count: unknown.length, singular: 'branch' })} in ${projectName} reached the base branch is unknown; detach will keep every directory.`,
    CHECK_AGAIN_SENTENCE,
  ];
};

type CommitSingularParams = {
  readonly hasUpstream: boolean;
};

const commitSingular = ({ hasUpstream }: CommitSingularParams): CountNoun =>
  hasUpstream ? 'unpushed commit' : 'local-only commit';

const perWorktreeDetail = ({ measured }: { readonly measured: Measured }): string => {
  if (measured.isAbsent) {
    return `${measured.branch} at ${measured.path}: directory already absent`;
  }
  const files = countLabel({ count: measured.affectedFiles, singular: 'uncommitted file' });
  const commits = countLabel({
    count: measured.localOnlyCommits,
    singular: commitSingular({ hasUpstream: measured.hasUpstream }),
  });
  return `${measured.branch} at ${measured.path}: ${files}, ${commits}, ${integrationDetailOf({ measured })}`;
};

const removalLine = ({
  measured,
  projectName,
}: {
  readonly measured: ReadonlyArray<Measured>;
  readonly projectName: string;
}): string => {
  const commits = measured.reduce((total, entry) => total + entry.localOnlyCommits, 0);
  const unpublished = measured.filter((entry) => !entry.hasUpstream).length;
  const singular = commitSingular({ hasUpstream: unpublished === 0 });
  const only = measured[0];
  if (measured.length === 1 && only !== undefined) {
    const head = `Remove the worktree at ${only.path} for ${only.branch}`;
    if (unpublished > 0 && commits > 0) {
      return `${head}, which has no upstream and ${countLabel({ count: commits, singular })}.`;
    }
    if (unpublished > 0) {
      return `${head}, which has no upstream.`;
    }
    if (commits > 0) {
      return `${head}, which has ${countLabel({ count: commits, singular })}.`;
    }
    return `${head}.`;
  }
  const head = `Remove ${countLabel({ count: measured.length, singular: 'worktree' })} for ${projectName}`;
  if (unpublished > 0 && commits > 0) {
    return `${head}, which have ${countLabel({ count: commits, singular })} and ${countLabel({ count: unpublished, singular: 'branch' })} without an upstream.`;
  }
  if (unpublished > 0) {
    const verb = unpublished === 1 ? 'has' : 'have';
    return `${head}, of which ${countLabel({ count: unpublished, singular: 'branch' })} ${verb} no upstream.`;
  }
  if (commits > 0) {
    return `${head}, which have ${countLabel({ count: commits, singular })}.`;
  }
  return `${head}.`;
};

const lossLine = ({ measured }: { readonly measured: ReadonlyArray<Measured> }): string => {
  const files = measured.reduce((total, entry) => total + entry.affectedFiles, 0);
  if (files === 0) {
    return 'No uncommitted files will be deleted.';
  }
  return `${countLabel({ count: files, singular: 'uncommitted file' })} will be deleted.`;
};

const retentionLine = ({ measured }: { readonly measured: ReadonlyArray<Measured> }): string =>
  measured.length === 1
    ? 'The branch and its commits stay in the repository.'
    : 'The branches and their commits stay in the repository.';

const safeLines = ({
  measured,
  projectName,
}: {
  readonly measured: ReadonlyArray<Measured>;
  readonly projectName: string;
}): ReadonlyArray<string> => {
  const present = presentOf({ measured });
  const unmerged = unmergedOf({ measured: present });
  const only = present[0];
  if (present.length === 1 && only !== undefined) {
    const base = baseName({ base: baseOf({ measured: only }) });
    const head = `Remove the clean worktree at ${only.path}: 0 uncommitted files, 0 unpushed commits`;
    return unmerged.length === 0
      ? [
          `${head}, and ${only.branch} is merged into ${base}.`,
          'The branch stays in the repository.',
        ]
      : [
          `${head}, and ${only.branch} is not merged into ${base} yet.`,
          'The branch and its commits stay in the repository.',
        ];
  }
  const head = `Remove ${countLabel({ count: present.length, singular: 'clean worktree' })} for ${projectName}: 0 uncommitted files, 0 unpushed commits`;
  return unmerged.length === 0
    ? [
        `${head}, and every branch is merged into its base branch.`,
        'The branches stay in the repository.',
      ]
    : [
        `${head}, and ${countLabel({ count: unmerged.length, singular: 'branch' })} ${unmergedVerb({ count: unmerged.length })} not merged into the base branch yet.`,
        'The branches and their commits stay in the repository.',
      ];
};

const missingLine = ({
  measured,
  projectName,
}: {
  readonly measured: ReadonlyArray<Measured>;
  readonly projectName: string;
}): string => {
  const only = measured[0];
  if (measured.length === 1 && only !== undefined) {
    return `The directory at ${only.path} is already absent; detach will remove only the session's mount record.`;
  }
  return `Every directory of ${projectName} is already absent; detach will remove only the session's mount records.`;
};

const unavailableLine = ({
  unread,
  total,
  projectName,
}: {
  readonly unread: ReadonlyArray<MountAssessment>;
  readonly total: number;
  readonly projectName: string;
}): string => {
  const only = unread[0];
  if (total === 1 && only !== undefined) {
    return `The safety of ${branchLabelFor({ assessed: null, fallback: only.branch })} at ${only.worktreePath} could not be verified; detach will keep the directory.`;
  }
  return `The safety of ${unread.length} of ${total} worktrees in ${projectName} could not be verified; detach will keep every directory.`;
};

export const buildDetachPlan = ({
  projectName,
  worktreePath,
  isRepoProject,
  blockers,
  assessments,
}: BuildDetachPlanParams): DetachPlan => {
  if (blockers.length > 0) {
    return {
      kind: 'keep',
      reason: 'blocked',
      lines: blockers.map((blocker) => BLOCKER_SENTENCE[blocker]({ projectName })),
      details: NO_DETAILS,
    };
  }
  if (!isRepoProject) {
    return {
      kind: 'keep',
      reason: 'folder',
      lines: [
        `Detach ${projectName} from this session; its folder at ${worktreePath} will stay on disk.`,
      ],
      details: NO_DETAILS,
    };
  }
  if (assessments === null || assessments.length === 0) {
    return { kind: 'checking' };
  }
  const unread = assessments.filter((entry) => entry.assessment.kind === 'unavailable');
  if (unread.length > 0) {
    return {
      kind: 'keep',
      reason: 'unavailable',
      lines: [unavailableLine({ unread, total: assessments.length, projectName })],
      details: {
        totals: [],
        worktrees:
          assessments.length === 1
            ? []
            : unread.map((entry) => `${entry.branch} at ${entry.worktreePath}: not verified`),
      },
    };
  }
  const measured = assessments.flatMap((entry) => {
    const found = measure(entry);
    return found === null ? [] : [found];
  });
  if (measured.every((entry) => entry.isAbsent)) {
    return { kind: 'missing', lines: [missingLine({ measured, projectName })] };
  }
  const unknown = measured.filter((entry) => isIntegrationUnknown({ measured: entry }));
  if (unknown.length > 0) {
    return {
      kind: 'keep',
      reason: 'unverified',
      lines: unverifiedLines({ unknown, total: measured.length, projectName }),
      details: {
        totals: [],
        worktrees:
          measured.length === 1
            ? []
            : unknown.map((entry) => `${entry.branch} at ${entry.path}: merge state unknown`),
      },
    };
  }
  const isRisky = measured.some((entry) => isMountRisky({ measured: entry }));
  if (!isRisky) {
    return {
      kind: 'safe',
      lines: safeLines({ measured, projectName }),
      details: integrationDetails({ measured }),
    };
  }
  const files = measured.reduce((total, entry) => total + entry.affectedFiles, 0);
  const commits = measured.reduce((total, entry) => total + entry.localOnlyCommits, 0);
  const hasUpstream = measured.every((entry) => entry.hasUpstream);
  const ignoredLine = ignoredFilesLine({ measured });
  const integration = integrationLine({ measured });
  const unmerged = unmergedOf({ measured: presentOf({ measured }) });
  return {
    kind: 'risky',
    lines: [
      removalLine({ measured, projectName }),
      lossLine({ measured }),
      ...(ignoredLine === null ? [] : [ignoredLine]),
      ...(integration === null ? [] : [integration]),
      retentionLine({ measured }),
    ],
    details: {
      totals: [
        `Files affected (${files})`,
        hasUpstream ? `Unpushed commits (${commits})` : `Local-only commits (${commits})`,
        ...(unmerged.length === 0
          ? []
          : [`Branches not merged into the base (${unmerged.length})`]),
      ],
      worktrees: measured.map((entry) => perWorktreeDetail({ measured: entry })),
    },
  };
};

export type DetachAction = {
  readonly label: string;
  readonly disposition: DetachDisposition;
  readonly role: 'primary' | 'danger';
};

export const detachActionFor = ({ plan }: { readonly plan: DetachPlan }): DetachAction | null => {
  switch (plan.kind) {
    case 'checking':
      return null;
    case 'keep':
      return plan.reason === 'blocked'
        ? null
        : { label: 'Detach and keep files', disposition: 'keep-files', role: 'primary' };
    case 'missing':
      return { label: 'Detach and remove', disposition: 'remove-clean', role: 'primary' };
    case 'safe':
      return { label: 'Detach and remove', disposition: 'remove-clean', role: 'primary' };
    case 'risky':
      return { label: 'Detach and delete files', disposition: 'delete-files', role: 'danger' };
  }
};

export type DetachOutcomeKind = 'removed' | 'missing' | 'kept' | 'failed';

export const detachOutcomeMessage = ({
  kind,
  projectName,
  worktreePath,
}: {
  readonly kind: DetachOutcomeKind;
  readonly projectName: string;
  readonly worktreePath: string;
}): string => {
  switch (kind) {
    case 'removed':
      return `Detached ${projectName} and removed its worktree.`;
    case 'missing':
      return `Detached ${projectName}. Its directory was already absent.`;
    case 'kept':
      return `Detached ${projectName}. Files remain at ${worktreePath}.`;
    case 'failed':
      return 'Could not finish removing the worktree. The mount is retained; check again before retrying.';
  }
};

const OUTCOME_RANK: Record<DetachOutcomeKind, number> = {
  failed: 3,
  kept: 2,
  missing: 1,
  removed: 0,
};

export const summarizeDetachOutcomes = ({
  outcomes,
}: {
  readonly outcomes: ReadonlyArray<{ readonly kind: DetachOutcomeKind }>;
}): DetachOutcomeKind => {
  let summary: DetachOutcomeKind = 'removed';
  for (const outcome of outcomes) {
    if (OUTCOME_RANK[outcome.kind] > OUTCOME_RANK[summary]) {
      summary = outcome.kind;
    }
  }
  return summary;
};
