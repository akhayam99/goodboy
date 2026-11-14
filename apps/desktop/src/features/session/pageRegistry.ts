import type { LucideIcon } from 'lucide-react';
import type { LensKind } from '../../store';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import type { ShortcutId } from '../../shared/keyboard/registry';
import { NAMES } from '../../shared/utils/names';
import { LENS_ICON, LENS_LABEL } from './lens-labels';
import type { CountedPageId } from './pageCountWord';

type PageId = 'overview' | 'files' | 'runs' | 'artifacts' | 'questions' | 'context';

export type Page = {
  readonly id: PageId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tint: LensKind | null;
  readonly shortcut: ShortcutId;
  readonly count: CountedPageId | null;
  readonly lens: LensKind | null;
  readonly currentLenses: ReadonlyArray<LensKind | null>;
};

type LensPage = {
  readonly id: PageId;
  readonly lens: LensKind;
  readonly shortcut: ShortcutId;
  readonly count: CountedPageId | null;
};

const lensPage = ({ id, lens, shortcut, count }: LensPage): Page => ({
  id,
  label: LENS_LABEL[lens],
  icon: LENS_ICON[lens],
  tint: lens,
  shortcut,
  count,
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
  lens: null,
  currentLenses: [null],
};

const CHANGES_PAGE = lensPage({
  id: 'files',
  lens: 'files',
  shortcut: 'lens.files',
  count: 'files',
});

const RUNS_PAGE: Page = {
  ...lensPage({ id: 'runs', lens: 'workflows', shortcut: 'lens.workflows', count: 'runs' }),
  currentLenses: ['workflows', 'orchestrated'],
};

const ARTIFACTS_PAGE = lensPage({
  id: 'artifacts',
  lens: 'plans',
  shortcut: 'lens.plans',
  count: 'artifacts',
});

const QUESTIONS_PAGE = lensPage({
  id: 'questions',
  lens: 'questions',
  shortcut: 'lens.questions',
  count: 'questions',
});

const CONTEXT_PAGE = lensPage({
  id: 'context',
  lens: 'context',
  shortcut: 'lens.context',
  count: null,
});

export const columnPagesOf = (): ReadonlyArray<Page> => [
  OVERVIEW_PAGE,
  CHANGES_PAGE,
  RUNS_PAGE,
  ARTIFACTS_PAGE,
];

type PagesParams = {
  readonly hasOpenQuestions: boolean;
};

export const pagesOf = ({ hasOpenQuestions }: PagesParams): ReadonlyArray<Page> => [
  ...columnPagesOf(),
  ...(hasOpenQuestions ? [QUESTIONS_PAGE] : []),
  CONTEXT_PAGE,
];
