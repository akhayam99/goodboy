import type { ToolCount } from './ToolCount';
import type { RailToolId } from './sessionTools';

type Params = {
  readonly pane: RailToolId;
  readonly portsInUse: number;
  readonly hasDownPin: boolean;
};

export const toolCountOf = ({ pane, portsInUse, hasDownPin }: Params): ToolCount | null => {
  if (pane !== 'monitoring' || (portsInUse === 0 && !hasDownPin)) {
    return null;
  }
  return { count: portsInUse, tone: hasDownPin ? 'warning' : 'neutral' };
};
