import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { BranchTab } from '../../store/slices/navigation/types';

export const WORKTREE_ENTRY_ICONS: Readonly<Record<BranchTab, LucideIcon>> = {
  pr: CONCEPT_ICONS.pr,
  comments: CONCEPT_ICONS.comments,
  files: CONCEPT_ICONS.diff,
  commits: CONCEPT_ICONS.commits,
  checks: CONCEPT_ICONS.checks,
};
