import type { LensKind } from '../../store';
import type { ShortcutId } from '../../shared/keyboard/registry';
import { SIMPLE_LENSES } from './lens-labels';
import type { ToolPaneDestination } from './panes/openToolPane';

export type LensDestination =
  | { readonly lens: LensKind | null; readonly pane?: never; readonly shortcut: ShortcutId }
  | { readonly lens?: never; readonly pane: ToolPaneDestination; readonly shortcut: ShortcutId };

type LensTool = 'linear' | 'gitlab' | 'jira' | 'slack';

export type ConnectedLensTools = Readonly<Record<LensTool, boolean>>;

const DESTINATIONS = [
  { lens: null, shortcut: 'lens.overview' },
  { lens: 'workflows', shortcut: 'lens.workflows' },
  { pane: 'spawned', shortcut: 'session.spawned' },
  { lens: 'questions', shortcut: 'lens.questions' },
  { lens: 'plans', shortcut: 'lens.plans' },
  { lens: 'review', shortcut: 'lens.review' },
  { lens: 'files', shortcut: 'lens.files' },
  { pane: 'explore', shortcut: 'lens.explore' },
  { pane: 'scripts', shortcut: 'lens.scripts' },
  { lens: 'pr', shortcut: 'lens.pr' },
  { lens: 'linear', shortcut: 'lens.linear' },
  { lens: 'gitlab_issues', shortcut: 'lens.gitlab_issues' },
  { lens: 'jira_issues', shortcut: 'lens.jira_issues' },
  { lens: 'slack_threads', shortcut: 'lens.slack_threads' },
] satisfies ReadonlyArray<LensDestination>;

const TOOL_OF_LENS: Partial<Record<LensKind, LensTool>> = {
  linear: 'linear',
  gitlab_issues: 'gitlab',
  jira_issues: 'jira',
  slack_threads: 'slack',
};

type Params = {
  readonly isBranchless: boolean;
  readonly connectedTools: ConnectedLensTools;
};

type DestinationParams = Params & {
  readonly destination: LensDestination;
};

const isReachable = ({ destination, isBranchless, connectedTools }: DestinationParams): boolean => {
  if (destination.pane !== undefined) {
    return destination.pane !== 'scripts' || !isBranchless;
  }
  const lens = destination.lens ?? null;
  if (lens === null) {
    return true;
  }
  if (lens === 'files') {
    return !isBranchless;
  }
  if (isBranchless && !SIMPLE_LENSES.has(lens)) {
    return false;
  }
  const tool = TOOL_OF_LENS[lens];
  return tool === undefined || connectedTools[tool];
};

export const lensDestinations = ({
  isBranchless,
  connectedTools,
}: Params): ReadonlyArray<LensDestination> =>
  DESTINATIONS.filter((destination) => isReachable({ destination, isBranchless, connectedTools }));
