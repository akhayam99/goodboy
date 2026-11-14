import { Button } from '@goodboy/ui';
import type { PublishAct } from '../publishPort';
import type { PublishRow } from './publishRowsOf';

type ActParams = {
  readonly act: PublishAct;
  readonly delegationIds: ReadonlyArray<string>;
};

type Props = {
  readonly rows: ReadonlyArray<PublishRow>;
  readonly busyIds: ReadonlyArray<string>;
  readonly isForce: boolean;
  readonly onAct: (params: ActParams) => void;
};

type LineParams = {
  readonly branches: ReadonlyArray<string>;
};

const forceLineOf = ({ branches }: LineParams): string => {
  const count = branches.length;
  const what = count === 1 ? 'Force push 1 branch' : `Force push ${count} branches`;
  return `${what}? ${branches.join(', ')}. Each earlier version is kept as a backup.`;
};

const plainLineOf = ({ branches }: LineParams): string => {
  const count = branches.length;
  const what = count === 1 ? 'Push 1 branch' : `Push ${count} branches`;
  return `${what}? ${branches.join(', ')}. Goodboy pushes, agents never do.`;
};

export const PublishPushAsk = ({ rows, busyIds, isForce, onAct }: Props) => {
  const ids = rows.map((row) => row.delegationId);
  const isBusy = ids.some((id) => busyIds.includes(id));
  const branches = rows.map((row) => row.branch);
  return (
    <div
      role="group"
      aria-label={isForce ? 'Confirm the force push' : 'Confirm the push'}
      className="flex min-w-0 items-center gap-3 text-meta text-foreground"
    >
      <p className="min-w-0 flex-1">
        {isForce ? forceLineOf({ branches }) : plainLineOf({ branches })}
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={isBusy}
        onClick={() => onAct({ act: 'decline', delegationIds: ids })}
      >
        Don&apos;t push
      </Button>
      <Button
        size="sm"
        isBusy={isBusy}
        busyLabel="Pushing"
        onClick={() => onAct({ act: 'confirm', delegationIds: ids })}
      >
        {isForce ? 'Force push' : 'Push'}
      </Button>
    </div>
  );
};
