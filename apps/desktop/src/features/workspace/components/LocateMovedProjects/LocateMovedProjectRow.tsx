import { Button } from '@goodboy/ui';
import type { ProjectRelocationCandidate } from '../../../../store/slices/project-relocation/state';

type Props = {
  readonly candidate: ProjectRelocationCandidate;
  readonly isBusy: boolean;
  readonly onSelectedChange: (params: {
    readonly projectId: string;
    readonly isSelected: boolean;
  }) => void;
  readonly onChoose: () => void;
};

const verdictLabel = ({
  candidate,
}: {
  readonly candidate: ProjectRelocationCandidate;
}): string => {
  if (candidate.status === 'updating') {
    return 'Updating paths…';
  }
  if (candidate.status === 'done') {
    return 'Git links repaired';
  }
  if (candidate.verdict === 'same_repository') {
    return 'Same repository';
  }
  if (candidate.verdict === 'same_name_unconfirmed') {
    return "Same name, can't confirm";
  }
  if (candidate.verdict === 'different_repository') {
    return 'Different repository';
  }
  return 'Not found here';
};

export const LocateMovedProjectRow = ({ candidate, isBusy, onSelectedChange, onChoose }: Props) => {
  const canSelect =
    candidate.toRoot !== null && candidate.verdict !== 'different_repository' && !isBusy;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md bg-muted p-2">
      <input
        type="checkbox"
        aria-label={`Move ${candidate.name}`}
        checked={candidate.isSelected}
        disabled={!canSelect}
        onChange={(event) =>
          onSelectedChange({ projectId: candidate.projectId, isSelected: event.target.checked })
        }
        className="mt-1 size-4 accent-primary"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-row text-foreground">{candidate.name}</span>
        <span className="truncate text-code text-faint-foreground line-through">
          {candidate.fromRoot}
        </span>
        {candidate.toRoot !== null && (
          <span className="truncate text-code text-muted-foreground">{candidate.toRoot}</span>
        )}
        <span className="text-meta text-muted-foreground">{verdictLabel({ candidate })}</span>
      </span>
      {candidate.toRoot === null && !isBusy && (
        <Button variant="secondary" size="sm" onClick={onChoose}>
          Choose…
        </Button>
      )}
    </li>
  );
};
