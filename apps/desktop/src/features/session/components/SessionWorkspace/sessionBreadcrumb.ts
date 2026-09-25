import type { BreadcrumbCrumb } from '../../breadcrumbCrumb';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { LensKind, SessionStudio } from '../../../../store';
import type { AgentHomeLens } from '../../agent-kind';
import { LENS_ICON } from '../../lens-labels';

export type SessionBreadcrumbHandlers = {
  toOverview: () => void;
  toLens: (lens: LensKind) => void;
  toWorkflowsList: () => void;
  toWorkflowRun: () => void;
  toArtifactsList: () => void;
  toParentAgent: () => void;
  toRootAgent: () => void;
  toReviewHome: () => void;
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
  selectedQuestionLabel: string | null;
  reviewModeLabel: string | null;
  lensLabel: (lens: LensKind) => string;
  handlers: SessionBreadcrumbHandlers;
};

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
    selectedQuestionLabel,
    reviewModeLabel,
    lensLabel,
    handlers,
  } = input;

  const overview: BreadcrumbCrumb = {
    id: 'overview',
    label: 'Overview',
    icon: CONCEPT_ICONS.timeline,
    onClick: handlers.toOverview,
  };
  const workflowsList: BreadcrumbCrumb = {
    id: 'workflows',
    label: 'Workflows',
    icon: LENS_ICON.workflows,
    onClick: handlers.toWorkflowsList,
  };
  const plansList: BreadcrumbCrumb = {
    id: 'plans',
    label: 'Artifacts',
    icon: LENS_ICON.plans,
    onClick: handlers.toArtifactsList,
  };

  if (studio != null) {
    if (studio.kind === 'workflow') {
      return sealLast([overview, workflowsList, { id: 'create', label: 'Create' }]);
    }
    if (studio.kind === 'bitbucket') {
      return sealLast([
        overview,
        {
          id: 'pr',
          label: lensLabel('pr'),
          icon: LENS_ICON.pr,
          onClick: () => handlers.toLens('pr'),
        },
        { id: 'bitbucket', label: 'Bitbucket' },
      ]);
    }
    return sealLast([
      overview,
      {
        id: 'gitlab_issues',
        label: lensLabel('gitlab_issues'),
        icon: LENS_ICON.gitlab_issues,
        onClick: () => handlers.toLens('gitlab_issues'),
      },
      { id: 'mr', label: 'Merge request' },
    ]);
  }

  if (selectedChildLabel != null && selectedChildHome != null) {
    const question: BreadcrumbCrumb[] =
      selectedQuestionLabel == null
        ? []
        : [{ id: 'selected-question', label: selectedQuestionLabel }];
    const selectedChild: BreadcrumbCrumb =
      selectedQuestionLabel == null
        ? { id: 'selected-child', label: selectedChildLabel }
        : { id: 'delegated-answers', label: 'Answers', icon: CONCEPT_ICONS.agents };
    const ancestors: BreadcrumbCrumb[] = [];
    if (selectedRootLabel != null) {
      ancestors.push({
        id: 'selected-root',
        label: selectedRootLabel,
        onClick: handlers.toRootAgent,
      });
    }
    if (selectedParentLabel != null) {
      ancestors.push({
        id: 'selected-parent',
        label: selectedParentLabel,
        onClick: handlers.toParentAgent,
      });
    }

    if (selectedChildHome !== 'workflows') {
      return sealLast([
        overview,
        {
          id: `lens-${selectedChildHome}`,
          label: lensLabel(selectedChildHome),
          icon: LENS_ICON[selectedChildHome],
          onClick: () => handlers.toLens(selectedChildHome),
        },
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
        onClick: handlers.toWorkflowRun,
      },
      ...ancestors,
      selectedChild,
      ...question,
    ]);
  }

  if (lens === 'workflows' && focusedWorkflowName != null) {
    return sealLast([overview, workflowsList, { id: 'workflow-run', label: focusedWorkflowName }]);
  }

  if (lens === 'plans' && artifactCreationLabel != null) {
    return sealLast([overview, plansList, { id: 'artifact-create', label: artifactCreationLabel }]);
  }

  if (lens === 'plans' && focusedArtifactTitle != null) {
    return sealLast([overview, plansList, { id: 'artifact', label: focusedArtifactTitle }]);
  }

  if (lens === 'review' && reviewModeLabel != null) {
    return sealLast([
      overview,
      {
        id: 'lens-review',
        label: lensLabel('review'),
        icon: LENS_ICON.review,
        onClick: handlers.toReviewHome,
      },
      { id: 'review-mode', label: reviewModeLabel },
    ]);
  }

  if (lens != null) {
    return sealLast([
      overview,
      { id: `lens-${lens}`, label: lensLabel(lens), icon: LENS_ICON[lens] },
    ]);
  }

  return sealLast([overview]);
};
