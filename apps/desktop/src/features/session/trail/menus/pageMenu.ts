import type { CrumbMenuAction, CrumbMenuGroup, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import type { LensDestination } from '../../lens-destinations';
import { lensIconClass } from '../../lens-labels';
import type { PageSummaries } from '../../pageCountWord';
import { pagesOf, type Page } from '../../pageRegistry';

type SummaryParams = {
  readonly summaries: PageSummaries;
  readonly page: Page;
};

export const pageSummaryOf = ({ summaries, page }: SummaryParams): string | null =>
  page.count === null ? null : (summaries[page.count] ?? null);

type Params = {
  readonly destinations: ReadonlyArray<LensDestination>;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
  readonly sessionTitle: string;
  readonly summaries: PageSummaries;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (lens: LensKind | null) => void;
};

export const pageMenu = ({
  destinations,
  activeLens,
  isBranchless,
  sessionTitle,
  summaries,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const rowOf = (page: Page): CrumbMenuRow => ({
    id: page.id,
    lead: {
      kind: 'icon',
      icon: page.icon,
      ...(page.tint !== null && { className: lensIconClass({ lens: page.tint }) }),
    },
    label: page.label,
    secondary: null,
    metaA: pageSummaryOf({ summaries, page }),
    state: null,
    isCurrent: page.currentLenses.includes(activeLens),
    isDisabled: false,
    indent: 0,
    onSelect: () => onSelect(page.lens),
  });
  const pages = pagesOf({
    isBranchless,
    destinations,
    hasOpenQuestions: summaries.questions !== undefined,
  });
  const groups: ReadonlyArray<CrumbMenuGroup> = [
    { id: 'pages', label: null, rows: pages.filter((page) => page.group === 'work').map(rowOf) },
    {
      id: 'tools',
      label: 'Tools',
      rows: pages.filter((page) => page.group === 'tools').map(rowOf),
    },
    {
      id: 'linked',
      label: 'Linked',
      rows: pages.filter((page) => page.group === 'linked').map(rowOf),
    },
  ].filter((group) => group.rows.length > 0);

  return {
    title: 'Pages',
    context: sessionTitle,
    count: null,
    triggerLabel: 'Switch page',
    groups,
    actions: actions.slice(0, 2),
    width: 'narrow',
    filterPlaceholder: null,
  };
};
