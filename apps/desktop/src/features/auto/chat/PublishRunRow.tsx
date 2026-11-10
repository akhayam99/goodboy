import { Button } from '@goodboy/ui';
import type { PublishAct } from '../publishPort';
import { PublishResultLine } from './PublishResultLine';
import type { PublishRow } from './publishRowsOf';

type ActParams = {
  readonly act: PublishAct;
  readonly delegationIds: ReadonlyArray<string>;
};

type Props = {
  readonly rows: ReadonlyArray<PublishRow>;
  readonly busyIds: ReadonlyArray<string>;
  readonly onAct: (params: ActParams) => void;
};

type LineParams = {
  readonly branches: ReadonlyArray<string>;
};

const askLineOf = ({ branches }: LineParams): string => {
  const count = branches.length;
  const what = count === 1 ? 'Force push 1 branch' : `Force push ${count} branches`;
  return `${what}? ${branches.join(', ')}. Each earlier version is kept as a backup.`;
};

export const PublishRunRow = ({ rows, busyIds, onAct }: Props) => {
  const waiting = rows.filter((row) => row.line.state === 'awaiting_confirm');
  const answered = rows.filter((row) => row.line.state !== 'awaiting_confirm');
  const waitingIds = waiting.map((row) => row.delegationId);
  const isAskBusy = waitingIds.some((id) => busyIds.includes(id));
  return (
    <div role="group" aria-label="Force push" className="flex min-w-0 flex-col gap-2">
      {waiting.length === 0 ? null : (
        <div
          role="group"
          aria-label="Confirm the force push"
          className="flex min-w-0 items-center gap-3 text-meta text-foreground"
        >
          <p className="min-w-0 flex-1">
            {askLineOf({ branches: waiting.map((row) => row.branch) })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={isAskBusy}
            onClick={() => onAct({ act: 'decline', delegationIds: waitingIds })}
          >
            Don&apos;t push
          </Button>
          <Button
            size="sm"
            isBusy={isAskBusy}
            busyLabel="Pushing"
            onClick={() => onAct({ act: 'confirm', delegationIds: waitingIds })}
          >
            Force push
          </Button>
        </div>
      )}
      {answered.map((row) => (
        <PublishResultLine
          key={row.delegationId}
          row={row}
          isBusy={busyIds.includes(row.delegationId)}
          onRetry={() => onAct({ act: 'retry', delegationIds: [row.delegationId] })}
          onPutBack={() => onAct({ act: 'put_back', delegationIds: [row.delegationId] })}
        />
      ))}
    </div>
  );
};
