import type { ActionListOf } from '../actions/types';

const OPEN_ROWS: ReadonlyArray<string> = [
  'mount.openInEditor',
  'mount.openTerminal',
  'mount.openInTerminalApp',
];

const COPY_ROWS: ReadonlyArray<string> = ['mount.copyBranch', 'mount.copyPath'];

const OPEN_BRANCH_ROWS: ReadonlyArray<string> = [
  'mount.openPullRequest',
  'mount.mergeOrder',
  ...OPEN_ROWS,
  'mount.switchBranch',
  ...COPY_ROWS,
  'mount.close',
];

const MERGED_BRANCH_ROWS: ReadonlyArray<string> = [
  'mount.openPullRequest',
  ...OPEN_ROWS,
  ...COPY_ROWS,
  'mount.cleanUp',
];

const CLOSED_BRANCH_ROWS: ReadonlyArray<string> = [
  'mount.reopen',
  'mount.restoreBranch',
  ...COPY_ROWS,
  'mount.forget',
  'mount.removeGone',
];

const CLOSED_IDS: ReadonlySet<string> = new Set([
  'mount.reopen',
  'mount.restoreBranch',
  'mount.forget',
  'mount.removeGone',
]);

export const mountRowMenuOf: ActionListOf = ({ actions }) => {
  if (actions.some((action) => CLOSED_IDS.has(action.id))) {
    return CLOSED_BRANCH_ROWS;
  }
  if (actions.some((action) => action.id === 'mount.cleanUp')) {
    return MERGED_BRANCH_ROWS;
  }
  return OPEN_BRANCH_ROWS;
};
