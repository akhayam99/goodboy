import { Chip, SelectionCheckbox, Tooltip, TruncatedText, cn } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../store';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import { useNow } from '../../../../shared/hooks/useNow';
import { ObjectActionVerb } from '../../../actions/ObjectActionVerb';
import type { BranchActionTarget } from '../../../actions/types';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { LOCATION_LABEL, verdictCopy } from '../../branches/branchCopy';
import { branchStateLabel } from '../../branches/branchStateLabel';
import { BRANCH_TABLE_GRID } from '../../branches/branchTableGrid';
import { unmergedCommits, type ClassifiedBranch } from '../../branches/classifyBranch';
import { BranchSessionLine } from './BranchSessionLine';

type Props = {
  readonly entry: ClassifiedBranch;
  readonly selectId: string;
  readonly base: string;
  readonly projectName: string;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly onToggle: (isOn: boolean) => void;
  readonly onDelete: () => Promise<void>;
};

export const BranchRow = ({
  entry,
  selectId,
  base,
  projectName,
  isSelected,
  isBusy,
  onToggle,
  onDelete,
}: Props) => {
  const now = useNow(30_000);
  const navigate = useAppStore((state) => state.navigate);
  const { branch } = entry;
  const verdict = verdictCopy({ branch, base });
  const age =
    branch.lastCommitAt === null
      ? ''
      : formatSpan({ from: new Date(branch.lastCommitAt * 1000).toISOString(), to: now });
  const status = verdict.detail === null ? verdict.label : `${verdict.label}\n${verdict.detail}`;
  const owner = entry.owner;
  const target: BranchActionTarget = {
    kind: 'branch',
    facts: {
      name: branch.name,
      isSafe: verdict.isSafe,
      unmergedCommits: unmergedCommits(entry),
      isBusy,
      onOpenSession:
        owner.kind === 'session'
          ? () => navigate({ to: sessionPlace({ sessionId: owner.sessionId }) })
          : null,
      onDelete,
    },
  };
  const menu = useObjectMenuTrigger({ target, anchorKey: `branch:${selectId}` });
  return (
    <li
      data-select-id={selectId}
      onContextMenu={menu.onContextMenu}
      className={cn(BRANCH_TABLE_GRID, 'group/select-row group/row rounded-md px-2 hover:bg-hover')}
    >
      <span data-cell="select" className="flex items-center">
        <SelectionCheckbox
          checked={isSelected}
          onToggle={() => onToggle(!isSelected)}
          label={`Select ${branch.name}`}
          disabled={isBusy}
        />
      </span>
      <span data-cell="branch" className="flex min-w-0 flex-col py-1">
        <TruncatedText className="font-mono text-code text-foreground">{branch.name}</TruncatedText>
        <BranchSessionLine entry={entry} />
      </span>
      <span data-cell="folder" className="truncate text-meta text-muted-foreground">
        {projectName}
      </span>
      <span data-cell="state" className="flex min-w-0">
        <Tooltip
          content={`${status}\n${LOCATION_LABEL[branch.location]}`}
          anchorClassName="flex min-w-0"
        >
          <Chip
            kind="state"
            tone={verdict.isSafe ? 'success' : 'neutral'}
            width="md"
            label={branchStateLabel({ branch, base })}
          />
        </Tooltip>
      </span>
      <span data-cell="age" className="text-right text-meta tabular-nums text-muted-foreground">
        {age}
      </span>
      <span data-cell="action" className="row-actions flex justify-end">
        <ObjectActionVerb target={target} actionId="branch.delete" />
      </span>
    </li>
  );
};
