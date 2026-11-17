import type { ShellRailMark } from '@goodboy/ui';
import type { ColumnDoorId } from '../../../shared/navigation/columnPlace';
import type { DoorSignal } from './doorSignal';

type Params = {
  readonly id: ColumnDoorId;
  readonly signal: DoorSignal | undefined;
};

export const railMarkOf = ({ id, signal }: Params): ShellRailMark | null => {
  if (signal === undefined) {
    return null;
  }
  if (id === 'board' && signal.isWarning) {
    return {
      kind: 'count',
      count: signal.count,
      name: signal.fact,
      tone: signal.tone === 'danger' ? 'danger' : 'warning',
    };
  }
  if (id === 'inbox' && signal.isUnread) {
    return { kind: 'dot', name: signal.fact };
  }
  return null;
};
