import type { ShortcutId } from '../../shared/keyboard/registry';
import { NAMES } from '../../shared/names';
import type { PullRequestPresentationState } from '../../shared/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';

export type BranchTabEntry = {
  readonly id: BranchTab;
  readonly label: string;
  readonly address: string;
  readonly shortcut: ShortcutId | null;
  readonly isAvailable: boolean;
};

export type BranchTabRegistry = Readonly<Record<BranchTab, BranchTabEntry>>;

export type BranchScope = {
  readonly state: PullRequestPresentationState;
  readonly hasComments: boolean;
};

export const BRANCH_TAB_REGISTRY: BranchTabRegistry = {
  pr: {
    id: 'pr',
    label: 'Pull request',
    address: 'pr',
    shortcut: 'lens.pr',
    isAvailable: true,
  },
  comments: {
    id: 'comments',
    label: NAMES.comments,
    address: 'comments',
    shortcut: 'lens.review',
    isAvailable: true,
  },
  files: {
    id: 'files',
    label: NAMES.files,
    address: 'files',
    shortcut: 'lens.files',
    isAvailable: true,
  },
  commits: {
    id: 'commits',
    label: 'Commits',
    address: 'commits',
    shortcut: null,
    isAvailable: true,
  },
  checks: {
    id: 'checks',
    label: 'Checks',
    address: 'checks',
    shortcut: null,
    isAvailable: true,
  },
};

const BRANCH_TAB_ORDER: ReadonlyArray<BranchTab> = ['pr', 'comments', 'files', 'commits', 'checks'];

type ShownParams = {
  readonly tab: BranchTab;
  readonly scope: BranchScope;
};

const isBranchTabShown = ({ tab, scope }: ShownParams): boolean => {
  if (tab === 'checks') {
    return scope.state !== 'none';
  }
  if (tab === 'comments') {
    return scope.state !== 'none' || scope.hasComments;
  }
  return true;
};

export const branchTabsOf = (
  scope: BranchScope,
  registry: BranchTabRegistry = BRANCH_TAB_REGISTRY,
): ReadonlyArray<BranchTabEntry> =>
  BRANCH_TAB_ORDER.map((id) => registry[id]).filter(
    (entry) => entry.isAvailable && isBranchTabShown({ tab: entry.id, scope }),
  );

export const isBranchTabAvailable = (tab: BranchTab): boolean =>
  BRANCH_TAB_REGISTRY[tab].isAvailable;

export const isBranchReadOnly = ({ state }: Pick<BranchScope, 'state'>): boolean =>
  state === 'merged' || state === 'closed';

type ResolveParams = ShownParams & {
  readonly isAvailable?: (tab: BranchTab) => boolean;
};

export const resolveBranchTab = ({
  tab,
  scope,
  isAvailable = isBranchTabAvailable,
}: ResolveParams): BranchTab => {
  if (!isAvailable(tab)) {
    return resolveBranchTab({ tab: 'comments', scope, isAvailable });
  }
  if (isBranchTabShown({ tab, scope })) {
    return tab;
  }
  return tab === 'comments' ? 'files' : 'pr';
};
