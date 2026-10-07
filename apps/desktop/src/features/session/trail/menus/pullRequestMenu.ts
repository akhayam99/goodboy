import type { PullRequestState } from '@goodboy/types';
import type { CrumbMenuAction, CrumbMenuModel, CrumbMenuRow } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { pullRequestKindOf } from '../../../../shared/pullRequestKind';
import { PULL_REQUEST_PRESENTATION } from '../../../../shared/pullRequestPresentation';

type Params = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly currentNumber: number | null;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (pr: PullRequestState) => void;
};

export const pullRequestMenu = ({
  prs,
  currentNumber,
  actions,
  onSelect,
}: Params): CrumbMenuModel => {
  const rowOf = (pr: PullRequestState): CrumbMenuRow => {
    const presentation =
      PULL_REQUEST_PRESENTATION[pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft })];
    return {
      id: String(pr.number),
      lead: { kind: 'icon', icon: CONCEPT_ICONS.pr },
      label: `#${pr.number} ${pr.title}`,
      secondary: null,
      metaA: null,
      state: { word: presentation.label, tone: presentation.tone },
      isCurrent: pr.number === currentNumber,
      isDisabled: false,
      indent: 0,
      onSelect: () => onSelect(pr),
    };
  };
  const branches = [...new Set(prs.map((pr) => pr.headBranch))];
  return {
    title: 'Pull requests',
    context: 'this session',
    count: prs.length,
    triggerLabel: 'Switch pull request',
    groups: branches.map((branch) => ({
      id: branch,
      label: branch,
      rows: prs.filter((pr) => pr.headBranch === branch).map(rowOf),
    })),
    actions: actions.slice(0, 2),
    width: 'wide',
    filterPlaceholder: null,
  };
};
