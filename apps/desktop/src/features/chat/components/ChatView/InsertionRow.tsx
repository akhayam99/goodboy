import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { UserText } from '../TranscriptCards/UserText';

type Props = {
  readonly insertion: TranscriptInsertion;
};

export const InsertionRow = ({ insertion }: Props) => (
  <li>
    {(insertion.takesOver ?? []).map((echo) => (
      <div key={echo.key} data-taken-echo="" className="flex flex-col gap-1">
        <UserText text={echo.text} at={new Date(echo.sentAtMs).toISOString()} />
        {echo.line}
      </div>
    ))}
    {insertion.node}
  </li>
);
