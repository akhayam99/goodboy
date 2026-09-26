import type { PullRequestState } from '@goodboy/types';
import { Listbox } from '@goodboy/ui';
import { PullRequestChip } from '../PullRequestChip';

type Props = {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly selected: number | null;
  readonly onSelect: (prNumber: number) => void;
};

export const PrSwitcher = ({ prs, selected, onSelect }: Props) => {
  const current = prs.find((p) => p.number === selected) ?? prs[0];
  if (!current) {
    return null;
  }

  return (
    <Listbox
      ariaLabel={`${prs.length} pull requests on this branch`}
      size="sm"
      noun="pull request"
      anchorClassName="shrink-0"
      value={current.number}
      options={prs.map((p) => ({
        value: p.number,
        label: p.title,
        leading: <PullRequestChip state={p.state} variant="icon" iconSize={12} />,
        meta: `#${p.number}`,
        keywords: String(p.number),
      }))}
      onChange={onSelect}
      valueLabel={
        <>
          <PullRequestChip state={current.state} variant="icon" iconSize={12} />
          <span className="tabular-nums text-foreground">#{current.number}</span>
          <span className="text-secondary text-muted-foreground">of {prs.length}</span>
        </>
      }
    />
  );
};
