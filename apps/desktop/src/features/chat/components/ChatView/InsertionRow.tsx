import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';
import { UserText } from '../TranscriptCards/UserText';
import type { TakenEchoRow } from './takenEchoesOf';

type Props = {
  readonly insertion: TranscriptInsertion;
  readonly taken: ReadonlyMap<string, TakenEchoRow>;
};

export const InsertionRow = ({ insertion, taken }: Props) => (
  <li>
    {(insertion.takesOver ?? []).map((echo) => {
      const original = taken.get(echo.key)?.item;
      return (
        <div key={echo.key} data-taken-echo="" className="flex flex-col gap-1">
          <UserText
            text={original?.text ?? echo.text}
            at={original?.at ?? new Date(echo.sentAtMs).toISOString()}
            attachments={original?.attachments}
          />
          {echo.line}
        </div>
      );
    })}
    {insertion.node}
  </li>
);
