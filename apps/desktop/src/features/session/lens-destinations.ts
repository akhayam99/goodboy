import type { LensKind } from '../../store';
import type { ShortcutId } from '../../shared/keyboard/registry';
import { SIMPLE_LENSES } from './lens-labels';

export type LensDestination = {
  readonly lens: LensKind | null;
  readonly shortcut: ShortcutId;
};

const DESTINATIONS = [
  { lens: null, shortcut: 'lens.overview' },
  { lens: 'context', shortcut: 'lens.context' },
  { lens: 'goal', shortcut: 'lens.goal' },
  { lens: 'decisions', shortcut: 'lens.decisions' },
  { lens: 'last_output_summary', shortcut: 'lens.summary' },
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

type Params = {
  readonly isBranchless: boolean;
};

export const lensDestinations = ({ isBranchless }: Params): ReadonlyArray<LensDestination> =>
  DESTINATIONS.filter(({ lens }) => {
    if (lens === null) {
      return true;
    }
    if (lens === 'files') {
      return !isBranchless;
    }
    if (lens === 'explore') {
      return isBranchless;
    }
    return !isBranchless || SIMPLE_LENSES.has(lens);
  });
