import { requestTimingOf } from '../../requestTimingOf';
import type { BrowserConsoleEntry } from '../../types';
import { NetworkFactList } from './NetworkFactList';

type Props = {
  readonly entry: BrowserConsoleEntry;
};

const NO_PHASES_TEXT = 'The page reported no waiting and download split for this request.';

export const NetworkTiming = ({ entry }: Props) => {
  const isSplit = (entry.network?.phases ?? null) !== null;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <NetworkFactList label="Timing" facts={requestTimingOf({ entry })} />
      {isSplit ? null : <p className="text-meta text-faint-foreground">{NO_PHASES_TEXT}</p>}
    </div>
  );
};
