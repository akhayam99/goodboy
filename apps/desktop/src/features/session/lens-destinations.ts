import type { LensKind } from '../../store';
import type { ShortcutId } from '../../shared/keyboard/registry';
import { SIMPLE_LENSES } from './lens-labels';

export type LensDestination = {
  readonly lens: LensKind | null;
  readonly shortcut: ShortcutId;
};

export type LensTool = 'linear' | 'gitlab' | 'jira' | 'slack';

export type ConnectedLensTools = Readonly<Record<LensTool, boolean>>;

const DESTINATIONS = [
  { lens: null, shortcut: 'lens.overview' },
  { lens: 'context', shortcut: 'lens.context' },
  { lens: 'workflows', shortcut: 'lens.workflows' },
  { lens: 'agents', shortcut: 'lens.agents' },
  { lens: 'questions', shortcut: 'lens.questions' },
  { lens: 'plans', shortcut: 'lens.plans' },
  { lens: 'review', shortcut: 'lens.review' },
  { lens: 'files', shortcut: 'lens.files' },
  { lens: 'explore', shortcut: 'lens.explore' },
  { lens: 'scripts', shortcut: 'lens.scripts' },
  { lens: 'terminal', shortcut: 'lens.terminal' },
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
  readonly isGithubCodeHost: boolean;
  readonly connectedTools: ConnectedLensTools;
};

export const lensDestinations = ({
  isBranchless,
  isGithubCodeHost,
  connectedTools,
}: Params): ReadonlyArray<LensDestination> =>
  DESTINATIONS.filter(({ lens }) => {
    if (lens === null || lens === 'explore') {
      return true;
    }
    if (lens === 'files') {
      return !isBranchless;
    }
    if (isBranchless && !SIMPLE_LENSES.has(lens)) {
      return false;
    }
    if (lens === 'pr') {
      return !isGithubCodeHost;
    }
    const tool = TOOL_OF_LENS[lens];
    return tool === undefined || connectedTools[tool];
  });
