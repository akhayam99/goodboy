export type BreadcrumbCrumb = { id: string; label: string; onClick?: () => void };

export type BreadcrumbChrome =
  | { kind: 'none' }
  | { kind: 'workspace-launcher' }
  | { kind: 'workspace-create' }
  | { kind: 'resolve'; name?: string }
  | { kind: 'pull-request'; view: 'comments' };

export type BreadcrumbHandlers = {
  toOverview: () => void;
  toWorkspaceLauncher: () => void;
  toWorkspaceBoard: () => void;
};

export type BreadcrumbInput = {
  workspace: { id: string; name: string } | null;
  session: { id: string; label: string } | null;
  chrome: BreadcrumbChrome;
  handlers: BreadcrumbHandlers;
};

export const buildBreadcrumb = (input: BreadcrumbInput): BreadcrumbCrumb[] => {
  const { workspace, session, chrome, handlers } = input;

  const overview: BreadcrumbCrumb = {
    id: 'overview',
    label: 'Overview',
    onClick: handlers.toOverview,
  };
  const workspaceRoot: BreadcrumbCrumb = { id: 'workspace', label: 'Workspace' };
  const workspaceRootClickable: BreadcrumbCrumb = {
    ...workspaceRoot,
    onClick: handlers.toWorkspaceLauncher,
  };

  const trail = (crumbs: BreadcrumbCrumb[]): BreadcrumbCrumb[] => {
    const copy = [...crumbs];
    delete copy[copy.length - 1]!.onClick;
    return copy;
  };

  if (chrome.kind === 'workspace-launcher') {
    return trail([overview, workspaceRoot]);
  }

  if (chrome.kind === 'workspace-create') {
    return trail([overview, workspaceRootClickable, { id: 'create', label: 'Create' }]);
  }

  if (chrome.kind === 'resolve') {
    if (chrome.name) {
      return trail([
        overview,
        { id: 'resolve', label: 'Resolve', onClick: handlers.toOverview },
        { id: 'resolve-name', label: chrome.name },
      ]);
    }
    return trail([overview, { id: 'resolve', label: 'Resolve' }]);
  }

  if (chrome.kind === 'pull-request') {
    return trail([
      overview,
      { id: 'pr', label: 'PullRequest' },
      { id: 'pr-comments', label: 'Comments' },
    ]);
  }

  if (session !== null) {
    const wsName = workspace?.name ?? 'Workspace';
    return trail([
      overview,
      workspaceRootClickable,
      { id: 'workspace-name', label: wsName, onClick: handlers.toWorkspaceBoard },
      { id: 'session', label: session.label },
    ]);
  }

  if (workspace !== null) {
    return trail([
      overview,
      workspaceRootClickable,
      { id: 'workspace-name', label: workspace.name },
    ]);
  }

  return trail([overview]);
};
