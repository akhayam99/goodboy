import type { StoppedProcess } from '@goodboy/types';
import { formatStoppedProcesses } from '../../utils/formatStoppedProcesses';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly stopped: ReadonlyArray<StoppedProcess>;
};

export const StoppedProcessesLine = ({ stopped }: Props) => {
  const line = formatStoppedProcesses({ stopped });
  if (line === null) {
    return null;
  }
  return (
    <TranscriptShell
      tone="neutral"
      variant="leftBorder"
      className="flex w-fit text-meta text-muted-foreground"
      data-testid="transcript-stopped-processes"
    >
      {line}
    </TranscriptShell>
  );
};
