import type { BreadcrumbCrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import type { LensKind, SessionStudio } from '../../../../store';

export type SessionBreadcrumbHandlers = {
  toOverview: () => void;
  toLens: (lens: LensKind) => void;
  toWorkflowsList: () => void;
  toPlansList: () => void;
};

export type SessionBreadcrumbInput = {
  lens: LensKind | null;
  studio: SessionStudio | null;
  selectedAgentName: string | null;
  overlayHomeLens: LensKind | null;
  suppressAgentTail: boolean;
  focusedWorkflowName: string | null;
  focusedPlanTitle: string | null;
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
    selectedAgentName,
    overlayHomeLens,
    suppressAgentTail,
    focusedWorkflowName,
    focusedPlanTitle,
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
    return sealLast([
      overview,
      { id: 'pr', label: lensLabel('pr'), onClick: () => handlers.toLens('pr') },
      { id: 'mr', label: 'Merge request' },
    ]);
  }

  if (suppressAgentTail && selectedAgentName != null && overlayHomeLens != null) {
    return sealLast([overview]);
  }

  if (selectedAgentName != null && overlayHomeLens != null) {
    const home = overlayHomeLens;
    return sealLast([
      overview,
      {
        id: 'overlay-home',
        label: lensLabel(home),
        onClick: () => (home === 'workflows' ? handlers.toWorkflowsList() : handlers.toLens(home)),
      },
      { id: 'agent', label: selectedAgentName },
    ]);
  }

  if (lens === 'workflows' && focusedWorkflowName != null) {
    return sealLast([overview, workflowsList, { id: 'workflow-run', label: focusedWorkflowName }]);
  }

  if (lens === 'plans' && focusedPlanTitle != null) {
    return sealLast([overview, plansList, { id: 'plan', label: focusedPlanTitle }]);
  }

  if (lens != null) {
    return sealLast([overview, { id: `lens-${lens}`, label: lensLabel(lens) }]);
  }

  return sealLast([overview]);
};
