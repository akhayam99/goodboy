import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import type { LensKind, SessionStudio } from '../../../../store';
import type { AgentHomeLens } from '../../agent-kind';
import { LENS_ICON, lensIconClass } from '../../lens-labels';

export type SessionBreadcrumbHandlers = {
  toOverview: () => void;
  toLens: (lens: LensKind) => void;
  toWorkflowsList: () => void;
  toWorkflowRun: () => void;
  toArtifactsList: () => void;
  toParentAgent: () => void;
  toRootAgent: () => void;
  toDiffBranch?: () => void;
  toPullRequestHome: () => void;
  toThread?: () => void;
};

export type SessionBreadcrumbInput = {
  lens: LensKind | null;
  studio: SessionStudio | null;
  focusedWorkflowName: string | null;
  selectedChildWorkflowName: string | null;
  focusedArtifactTitle: string | null;
  artifactCreationLabel: string | null;
  selectedChildLabel: string | null;
  selectedChildHome: AgentHomeLens | null;
  selectedParentLabel: string | null;
  selectedRootLabel: string | null;
  selectedChildTone?: string | null;
  selectedParentTone?: string | null;
  selectedRootTone?: string | null;
  selectedQuestionLabel: string | null;
  pullRequestModeLabel: string | null;
  pullRequestNumber?: number | null;
  diffBranchLabel?: string | null;
  diffPageLabel?: string | null;
  selectedThreadLabel?: string | null;
  lensLabel: (lens: LensKind) => string;
  handlers: SessionBreadcrumbHandlers;
};

const lensIcon = ({ lens }: { readonly lens: LensKind }) => ({
  icon: LENS_ICON[lens],
  iconClassName: lensIconClass({ lens }),
});

const sealLast = (crumbs: BreadcrumbCrumb[]): BreadcrumbCrumb[] => {
  const copy = crumbs.map((crumb) => ({ ...crumb }));
  const last = copy[copy.length - 1];
  if (last) delete last.onClick;
  return copy;
};

export const buildSessionBreadcrumb = (input: SessionBreadcrumbInput): BreadcrumbCrumb[] => {
  const {
    lens,
    studio,
    focusedWorkflowName,
    selectedChildWorkflowName,
    focusedArtifactTitle,
    artifactCreationLabel,
    selectedChildLabel,
    selectedChildHome,
    selectedParentLabel,
    selectedRootLabel,
    selectedChildTone = null,
    selectedParentTone = null,
    selectedRootTone = null,
    selectedQuestionLabel,
    pullRequestModeLabel,
    pullRequestNumber = null,
    diffBranchLabel = null,
    diffPageLabel = null,
    selectedThreadLabel = null,
    lensLabel,
    handlers,
  } = input;
  const agentIcon = (tone: string | null) => ({
    icon: CONCEPT_ICONS.agents,
    ...(tone != null && { iconClassName: tone }),
  });

  const overview: BreadcrumbCrumb = {
    id: 'overview',
    label: 'Overview',
    icon: CONCEPT_ICONS.timeline,
    onClick: handlers.toOverview,
  };
  const workflowsList: BreadcrumbCrumb = {
    id: 'workflows',
    label: NAMES.runs,
    ...lensIcon({ lens: 'workflows' }),
    onClick: handlers.toWorkflowsList,
  };
  const plansList: BreadcrumbCrumb = {
    id: 'plans',
    label: 'Artifacts',
    ...lensIcon({ lens: 'plans' }),
    onClick: handlers.toArtifactsList,
  };

  if (studio != null) {
    if (studio.kind === 'workflow') {
      return sealLast([
        overview,
        workflowsList,
        { id: 'create', label: 'Create', icon: CONCEPT_ICONS.workflows },
      ]);
    }
    if (studio.kind === 'bitbucket') {
      return sealLast([
        overview,
        {
          id: 'pr',
          label: lensLabel('pr'),
          ...lensIcon({ lens: 'pr' }),
          onClick: () => handlers.toLens('pr'),
        },
        { id: 'bitbucket', label: 'Bitbucket', icon: CONCEPT_ICONS.bitbucket },
      ]);
    }
    return sealLast([
      overview,
      {
        id: 'gitlab_issues',
        label: lensLabel('gitlab_issues'),
        ...lensIcon({ lens: 'gitlab_issues' }),
        onClick: () => handlers.toLens('gitlab_issues'),
      },
      { id: 'mr', label: 'Merge request', icon: CONCEPT_ICONS.gitlab },
    ]);
  }

  if (selectedChildLabel != null && selectedChildHome != null) {
    const question: BreadcrumbCrumb[] =
      selectedQuestionLabel == null
        ? []
        : [
            {
              id: 'selected-question',
              label: selectedQuestionLabel,
              icon: CONCEPT_ICONS.questions,
            },
          ];
    const selectedChild: BreadcrumbCrumb =
      selectedQuestionLabel == null
        ? {
            id: 'selected-child',
            label: selectedChildHome === 'review' ? 'Resolver' : selectedChildLabel,
            ...agentIcon(selectedChildTone),
          }
        : { id: 'delegated-answers', label: 'Answers', icon: CONCEPT_ICONS.agents };
    const ancestors: BreadcrumbCrumb[] = [];
    if (selectedRootLabel != null) {
      ancestors.push({
        id: 'selected-root',
        label: selectedRootLabel,
        ...agentIcon(selectedRootTone),
        onClick: handlers.toRootAgent,
      });
    }
    if (selectedParentLabel != null) {
      ancestors.push({
        id: 'selected-parent',
        label: selectedParentLabel,
        ...agentIcon(selectedParentTone),
        onClick: handlers.toParentAgent,
      });
    }

    if (selectedChildHome !== 'workflows') {
      const thread: BreadcrumbCrumb[] =
        selectedChildHome === 'review' && selectedThreadLabel != null
          ? [
              {
                id: 'review-thread',
                label: selectedThreadLabel,
                icon: CONCEPT_ICONS.comments,
                ...(handlers.toThread !== undefined && { onClick: handlers.toThread }),
              },
            ]
          : [];
      return sealLast([
        overview,
        {
          id: `lens-${selectedChildHome}`,
          label: lensLabel(selectedChildHome),
          ...lensIcon({ lens: selectedChildHome }),
          onClick: () => handlers.toLens(selectedChildHome),
        },
        ...thread,
        ...ancestors,
        selectedChild,
        ...question,
      ]);
    }

    if (selectedChildWorkflowName == null) {
      return sealLast([overview, workflowsList, ...ancestors, selectedChild, ...question]);
    }

    return sealLast([
      overview,
      workflowsList,
      {
        id: 'workflow-run',
        label: selectedChildWorkflowName,
        icon: CONCEPT_ICONS.sessions,
        onClick: handlers.toWorkflowRun,
      },
      ...ancestors,
      selectedChild,
      ...question,
    ]);
  }

  if (lens === 'workflows' && focusedWorkflowName != null) {
    return sealLast([
      overview,
      workflowsList,
      { id: 'workflow-run', label: focusedWorkflowName, icon: CONCEPT_ICONS.sessions },
    ]);
  }

  if (lens === 'plans' && artifactCreationLabel != null) {
    return sealLast([
      overview,
      plansList,
      { id: 'artifact-create', label: artifactCreationLabel, icon: CONCEPT_ICONS.artifacts },
    ]);
  }

  if (lens === 'plans' && focusedArtifactTitle != null) {
    return sealLast([
      overview,
      plansList,
      { id: 'artifact', label: focusedArtifactTitle, icon: CONCEPT_ICONS.artifacts },
    ]);
  }

  if (lens === 'pr') {
    const pullRequest: BreadcrumbCrumb = {
      id: 'lens-pr',
      label: lensLabel('pr'),
      ...lensIcon({ lens: 'pr' }),
      onClick: handlers.toPullRequestHome,
    };
    const numbered: ReadonlyArray<BreadcrumbCrumb> =
      pullRequestNumber === null
        ? []
        : [
            {
              id: 'pr-number',
              label: `#${pullRequestNumber}`,
              icon: CONCEPT_ICONS.pr,
              onClick: handlers.toPullRequestHome,
            },
          ];
    const child: ReadonlyArray<BreadcrumbCrumb> =
      pullRequestModeLabel === null
        ? []
        : [{ id: 'pr-mode', label: pullRequestModeLabel, icon: CONCEPT_ICONS.pr }];
    return sealLast([overview, pullRequest, ...numbered, ...child]);
  }

  if (lens === 'files' && diffBranchLabel != null && diffPageLabel != null) {
    return sealLast([
      overview,
      { id: 'lens-files', label: lensLabel('files'), ...lensIcon({ lens: 'files' }) },
      {
        id: 'diff-branch',
        label: diffBranchLabel,
        icon: CONCEPT_ICONS.branch,
        iconClassName: tintClasses(CONCEPT_TONE.branch).icon,
        ...(handlers.toDiffBranch !== undefined && { onClick: handlers.toDiffBranch }),
      },
      { id: 'rewrite-history', label: diffPageLabel, icon: CONCEPT_ICONS.history },
    ]);
  }

  if (lens === 'files' && diffBranchLabel != null) {
    return sealLast([
      overview,
      { id: 'lens-files', label: lensLabel('files'), ...lensIcon({ lens: 'files' }) },
      {
        id: 'diff-branch',
        label: diffBranchLabel,
        icon: CONCEPT_ICONS.branch,
        iconClassName: tintClasses(CONCEPT_TONE.branch).icon,
      },
    ]);
  }

  if (lens != null) {
    return sealLast([
      overview,
      { id: `lens-${lens}`, label: lensLabel(lens), ...lensIcon({ lens: lens }) },
    ]);
  }

  return sealLast([overview]);
};
