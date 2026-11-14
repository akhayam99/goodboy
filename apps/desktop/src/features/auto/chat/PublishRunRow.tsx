import type { PublishAct } from '../publishPort';
import { PublishPushAsk } from './PublishPushAsk';
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

const groupLabelOf = ({ rows }: Pick<Props, 'rows'>): string => {
  if (rows.every((row) => row.isForce)) {
    return 'Force push';
  }
  return rows.every((row) => !row.isForce) ? 'Push' : 'Publish';
};

export const PublishRunRow = ({ rows, busyIds, onAct }: Props) => {
  const waiting = rows.filter((row) => row.line.state === 'awaiting_confirm');
  const answered = rows.filter((row) => row.line.state !== 'awaiting_confirm');
  const forceWaiting = waiting.filter((row) => row.isForce);
  const plainWaiting = waiting.filter((row) => !row.isForce);
  return (
    <div role="group" aria-label={groupLabelOf({ rows })} className="flex min-w-0 flex-col gap-2">
      {forceWaiting.length === 0 ? null : (
        <PublishPushAsk rows={forceWaiting} busyIds={busyIds} isForce onAct={onAct} />
      )}
      {plainWaiting.length === 0 ? null : (
        <PublishPushAsk rows={plainWaiting} busyIds={busyIds} isForce={false} onAct={onAct} />
      )}
      {answered.map((row) => (
        <PublishResultLine
          key={row.delegationId}
          row={row}
          isBusy={busyIds.includes(row.delegationId)}
          onRetry={() => onAct({ act: 'retry', delegationIds: [row.delegationId] })}
          onPutBack={() => onAct({ act: 'put_back', delegationIds: [row.delegationId] })}
          onPushNow={() => onAct({ act: 'confirm', delegationIds: [row.delegationId] })}
        />
      ))}
    </div>
  );
};
