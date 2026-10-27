import type { LucideIcon } from 'lucide-react';
import type { LensKind } from '../../store';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { ShortcutId } from '../../shared/keyboard/registry';
import { NAMES } from '../../shared/utils/names';
import type { LensDestination } from './lens-destinations';
import { LENS_ICON, LENS_LABEL, lensLabelFor } from './lens-labels';
import type { CountedPageId } from './pageCountWord';

type PageId =
  | 'overview'
  | 'files'
  | 'runs'
  | 'artifacts'
  | 'questions'
  | 'explore'
  | 'scripts'
  | 'terminal'
  | 'linear'
  | 'gitlab'
  | 'jira'
  | 'slack';

type PageGroup = 'work' | 'tools' | 'linked';

export type Page = {
  readonly id: PageId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tint: LensKind | null;
  readonly shortcut: ShortcutId;
  readonly count: CountedPageId | null;
  readonly group: PageGroup;
  readonly lens: LensKind | null;
  readonly currentLenses: ReadonlyArray<LensKind | null>;
};

type LensPage = {
  readonly id: PageId;
  readonly lens: LensKind;
  readonly shortcut: ShortcutId;
  readonly group: PageGroup;
  readonly count: CountedPageId | null;
};

const lensPage = ({ id, lens, shortcut, group, count }: LensPage): Page => ({
  id,
  label: LENS_LABEL[lens],
  icon: LENS_ICON[lens],
  tint: lens,
  shortcut,
  count,
  group,
  lens,
  currentLenses: [lens],
});

const OVERVIEW_PAGE: Page = {
  id: 'overview',
  label: NAMES.overview,
  icon: CONCEPT_ICONS.timeline,
  tint: null,
  shortcut: 'lens.overview',
  count: null,
  group: 'work',
  lens: null,
  currentLenses: [null],
};

const CHANGES_PAGE: Page = {
  id: 'files',
  label: lensLabelFor({ lens: 'files', isBranchless: true }),
  icon: LENS_ICON.files,
  tint: 'files',
  shortcut: 'lens.files',
  count: 'files',
  group: 'work',
  lens: 'files',
  currentLenses: ['files'],
};

const RUNS_PAGE: Page = {
  ...lensPage({
    id: 'runs',
    lens: 'workflows',
    shortcut: 'lens.workflows',
    group: 'work',
    count: 'runs',
  }),
  currentLenses: ['workflows', 'orchestrated', 'agents', 'auto'],
};

const ARTIFACTS_PAGE = lensPage({
  id: 'artifacts',
  lens: 'plans',
  shortcut: 'lens.plans',
  group: 'work',
  count: 'artifacts',
});

const REST: ReadonlyArray<Page> = [
  lensPage({
    id: 'questions',
    lens: 'questions',
    shortcut: 'lens.questions',
    group: 'work',
    count: 'questions',
  }),
  lensPage({
    id: 'explore',
    lens: 'explore',
    shortcut: 'lens.explore',
    group: 'tools',
    count: null,
  }),
  lensPage({
    id: 'scripts',
    lens: 'scripts',
    shortcut: 'lens.scripts',
    group: 'tools',
    count: null,
  }),
  lensPage({ id: 'linear', lens: 'linear', shortcut: 'lens.linear', group: 'linked', count: null }),
  lensPage({
    id: 'gitlab',
    lens: 'gitlab_issues',
    shortcut: 'lens.gitlab_issues',
    group: 'linked',
    count: null,
  }),
  lensPage({
    id: 'jira',
    lens: 'jira_issues',
    shortcut: 'lens.jira_issues',
    group: 'linked',
    count: null,
  }),
  lensPage({
    id: 'slack',
    lens: 'slack_threads',
    shortcut: 'lens.slack_threads',
    group: 'linked',
    count: null,
  }),
];

type ColumnParams = {
  readonly isBranchless: boolean;
};

export const columnPagesOf = ({ isBranchless }: ColumnParams): ReadonlyArray<Page> => [
  OVERVIEW_PAGE,
  ...(isBranchless ? [CHANGES_PAGE] : []),
  RUNS_PAGE,
  ARTIFACTS_PAGE,
];

type PagesParams = ColumnParams & {
  readonly destinations: ReadonlyArray<LensDestination>;
  readonly hasOpenQuestions: boolean;
};

export const pagesOf = ({
  isBranchless,
  destinations,
  hasOpenQuestions,
}: PagesParams): ReadonlyArray<Page> => [
  ...columnPagesOf({ isBranchless }),
  ...REST.filter(
    (page) =>
      (page.id !== 'questions' || hasOpenQuestions) &&
      destinations.some((destination) => destination.lens === page.lens),
  ),
];
