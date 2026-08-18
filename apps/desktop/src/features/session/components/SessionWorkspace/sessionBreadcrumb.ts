import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import type { LensKind, SessionStudio } from '../../../../store';

export type SessionBreadcrumbHandlers = {
  toOverview: () => void;
  toLens: (lens: LensKind) => void;
  toWorkflowsList: () => void;
  toWorkflowRun: () => void;
  toPlansList: () => void;
};

export type SessionBreadcrumbInput = {
  lens: LensKind | null;
  studio: SessionStudio | null;
  focusedWorkflowName: string | null;
  selectedChildWorkflowName: string | null;
  focusedPlanTitle: string | null;
  selectedChildLabel: string | null;
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
    focusedPlanTitle,
    selectedChildLabel,
    lensLabel,
    handlers,
  } = input;

  const overview: BreadcrumbCrumb = {
    id: 'overview',
    label: 'Overview',
    onClick: handlers.toOverview,
  };
  const workflowsList: BreadcrumbCrumb = {
    id: 'workflows',
    label: 'Workflows',
    onClick: handlers.toWorkflowsList,
  };
  const plansList: BreadcrumbCrumb = {
    id: 'plans',
    label: 'Plans',
    onClick: handlers.toPlansList,
  };

  if (studio != null) {
    if (studio.kind === 'workflow') {
      return sealLast([overview, workflowsList, { id: 'create', label: 'Create' }]);
    }
    if (studio.kind === 'github') {
      return sealLast([
        overview,
        { id: 'pr', label: lensLabel('pr'), onClick: () => handlers.toLens('pr') },
        {
          id: 'github',
          label: studio.prNumber != null ? `PR #${studio.prNumber}` : 'GitHub',
        },
      ]);
    }
    if (studio.kind === 'bitbucket') {
      return sealLast([
        overview,
        { id: 'pr', label: lensLabel('pr'), onClick: () => handlers.toLens('pr') },
        { id: 'bitbucket', label: 'Bitbucket' },
      ]);
    }
    return sealLast([
      overview,
      {
        id: 'gitlab_issues',
        label: lensLabel('gitlab_issues'),
        onClick: () => handlers.toLens('gitlab_issues'),
      },
      { id: 'mr', label: 'Merge request' },
    ]);
  }

  if (lens === 'workflows' && selectedChildWorkflowName != null && selectedChildLabel != null) {
    return sealLast([
      overview,
      workflowsList,
      {
        id: 'workflow-run',
        label: selectedChildWorkflowName,
        onClick: handlers.toWorkflowRun,
      },
      { id: 'selected-child', label: selectedChildLabel },
    ]);
  }

  if (lens === 'workflows' && focusedWorkflowName != null) {
    return sealLast([overview, workflowsList, { id: 'workflow-run', label: focusedWorkflowName }]);
  }

  if (lens === 'plans' && focusedPlanTitle != null) {
    return sealLast([overview, plansList, { id: 'plan', label: focusedPlanTitle }]);
  }

  if (lens != null && selectedChildLabel != null) {
    return sealLast([
      overview,
      { id: `lens-${lens}`, label: lensLabel(lens), onClick: () => handlers.toLens(lens) },
      { id: 'selected-child', label: selectedChildLabel },
    ]);
  }

  if (lens != null) {
    return sealLast([overview, { id: `lens-${lens}`, label: lensLabel(lens) }]);
  }

  return sealLast([overview]);
};
