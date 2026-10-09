import type { ShortcutId } from '../../shared/keyboard/registry';
import { NAMES } from '../../shared/names';
import type { BranchTab } from '../../store/slices/navigation/types';

export type BranchTabEntry = {
  readonly id: BranchTab;
  readonly label: string;
  readonly address: string;
  readonly shortcut: ShortcutId | null;
  readonly isAvailable: boolean;
};

export type BranchTabRegistry = Readonly<Record<BranchTab, BranchTabEntry>>;

type BranchProvider = 'local' | 'github' | 'gitlab' | 'bitbucket';

export type BranchScope = {
  readonly hasPullRequest: boolean;
  readonly provider: BranchProvider;
};

export const BRANCH_TAB_REGISTRY: BranchTabRegistry = {
  pr: {
    id: 'pr',
    label: NAMES.pullRequest,
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

export const branchTabsOf = (
  _scope: BranchScope,
  registry: BranchTabRegistry = BRANCH_TAB_REGISTRY,
): ReadonlyArray<BranchTabEntry> =>
  BRANCH_TAB_ORDER.map((id) => registry[id]).filter((entry) => entry.isAvailable);

export const isBranchTabAvailable = (tab: BranchTab): boolean =>
  BRANCH_TAB_REGISTRY[tab].isAvailable;
