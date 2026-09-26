import type { CrumbMenuAction, CrumbMenuGroup, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { LensDestination } from '../../lens-destinations';
import { LENS_ICON, lensLabelFor } from '../../lens-labels';

export type PageSummaries = Partial<Record<LensKind, string>>;

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
const CONTEXT_PARTS = new Set<LensKind>(['goal', 'decisions', 'last_output_summary']);

const isCurrentLens = ({
  lens,
  activeLens,
}: {
  readonly lens: LensKind | null;
  readonly activeLens: LensKind | null;
}): boolean =>
  lens === activeLens ||
  (lens === 'context' && activeLens !== null && CONTEXT_PARTS.has(activeLens));

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
    lead: { kind: 'icon', icon: lens === null ? CONCEPT_ICONS.timeline : LENS_ICON[lens] },
    label: lens === null ? 'Overview' : lensLabelFor({ lens, isBranchless }),
    secondary: null,
    metaA: lens === null ? null : (summaries[lens] ?? null),
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
