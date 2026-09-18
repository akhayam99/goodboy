import type { LucideIcon } from 'lucide-react';
import type { LensKind } from '../../../../store';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import { lensDestinations } from '../../lens-destinations';
import { LENS_ICON } from '../../lens-labels';

export type LensMenuGroupLabel = 'Work' | 'Output' | 'Context' | 'Tools';

export type LensMenuEntry = Readonly<{
  lens: LensKind;
  shortcut: ShortcutId;
  icon: LucideIcon;
}>;

export type LensMenuGroup = Readonly<{
  label: LensMenuGroupLabel;
  entries: ReadonlyArray<LensMenuEntry>;
}>;

const LENS_GROUP = {
  agents: 'Work',
  workflows: 'Work',
  questions: 'Work',
  plans: 'Output',
  review: 'Output',
  files: 'Output',
  explore: 'Output',
  scripts: 'Output',
  terminal: 'Output',
  pr: 'Output',
  context: 'Context',
  goal: 'Context',
  decisions: 'Context',
  last_output_summary: 'Context',
  linear: 'Tools',
  gitlab_issues: 'Tools',
  jira_issues: 'Tools',
  slack_threads: 'Tools',
  github_issue: 'Tools',
} satisfies Record<LensKind, LensMenuGroupLabel>;

const GROUP_ORDER = [
  'Work',
  'Output',
  'Context',
  'Tools',
] satisfies ReadonlyArray<LensMenuGroupLabel>;

type Params = Readonly<{
  isBranchless: boolean;
}>;

export const lensSwitcherGroups = ({ isBranchless }: Params): ReadonlyArray<LensMenuGroup> => {
  const entries = lensDestinations({ isBranchless }).flatMap<LensMenuEntry>(({ lens, shortcut }) =>
    lens === null ? [] : [{ lens, shortcut, icon: LENS_ICON[lens] }],
  );
  return GROUP_ORDER.flatMap<LensMenuGroup>((label) => {
    const grouped = entries.filter((entry) => LENS_GROUP[entry.lens] === label);
    if (grouped.length === 0) {
      return [];
    }
    return [{ label, entries: grouped }];
  });
};
