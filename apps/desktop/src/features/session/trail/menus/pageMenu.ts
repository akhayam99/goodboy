import type { CrumbMenuAction, CrumbMenuGroup, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { LensDestination } from '../../lens-destinations';
import { LENS_ICON, lensIconClass, lensLabelFor } from '../../lens-labels';

export type PageSummaries = Partial<Record<LensKind, string>>;

type SummaryParams = {
  readonly summaries: PageSummaries;
  readonly lens: LensKind | null;
};

export const pageSummaryOf = ({ summaries, lens }: SummaryParams): string | null =>
  lens === null ? null : (summaries[lens] ?? null);

type Params = {
  readonly destinations: ReadonlyArray<LensDestination>;
  readonly activeLens: LensKind | null;
  readonly isBranchless: boolean;
  readonly sessionTitle: string;
  readonly summaries: PageSummaries;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (lens: LensKind | null) => void;
};

const TOOLS = new Set<LensKind>(['scripts', 'terminal', 'explore']);
const LINKED = new Set<LensKind>([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
  'github_issue',
]);

const isCurrentLens = ({
  lens,
  activeLens,
}: {
  readonly lens: LensKind | null;
  readonly activeLens: LensKind | null;
}): boolean => lens === activeLens;

export const pageMenu = ({
  destinations,
  activeLens,
  isBranchless,
  sessionTitle,
  summaries,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const rowOf = (lens: LensKind | null): CrumbMenuRow => ({
    id: lens ?? 'overview',
    lead:
      lens === null
        ? { kind: 'icon', icon: CONCEPT_ICONS.timeline }
        : {
            kind: 'icon',
            icon: LENS_ICON[lens],
            className: lensIconClass({
              lens,
              isQuiet: lens === 'questions' && summaries.questions === undefined,
            }),
          },
    label: lens === null ? 'Session' : lensLabelFor({ lens, isBranchless }),
    secondary: null,
    metaA: pageSummaryOf({ summaries, lens }),
    state: null,
    isCurrent: isCurrentLens({ lens, activeLens }),
    isDisabled: false,
    indent: 0,
    onSelect: () => onSelect(lens),
  });
  const lenses = destinations.map((destination) => destination.lens);
  const main = lenses.filter((lens) => lens === null || (!TOOLS.has(lens) && !LINKED.has(lens)));
  const tools = lenses.filter((lens): lens is LensKind => lens !== null && TOOLS.has(lens));
  const linked = lenses.filter((lens): lens is LensKind => lens !== null && LINKED.has(lens));
  const groups: ReadonlyArray<CrumbMenuGroup> = [
    { id: 'pages', label: null, rows: main.map(rowOf) },
    { id: 'tools', label: 'Tools', rows: tools.map(rowOf) },
    { id: 'linked', label: 'Linked', rows: linked.map(rowOf) },
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
