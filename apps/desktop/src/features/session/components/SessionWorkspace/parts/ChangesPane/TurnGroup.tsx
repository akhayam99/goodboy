import type { SessionId } from '@goodboy/types';
import type { ChangeTurn } from '../../../../../file-versions/changeTurnsOf';
import { ChangeRow } from './ChangeRow';
import { turnNameOf } from '../../../../../file-versions/turnNameOf';

type Props = {
  readonly sessionId: SessionId;
  readonly turn: ChangeTurn;
  readonly age: string;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
};

export const TurnGroup = ({ sessionId, turn, age, selectedKey, onSelect }: Props) => (
  <section aria-label={turnNameOf({ turn })} className="flex flex-col gap-1">
    <h3 className="flex min-w-0 items-baseline gap-2 px-2 text-label text-foreground">
      <span className="min-w-0 flex-1 truncate">{turnNameOf({ turn })}</span>
      <span className="shrink-0 text-meta text-faint-foreground">{age}</span>
    </h3>
    <ul className="flex flex-col">
      {turn.files.map((file) => (
        <ChangeRow
          key={file.key}
          sessionId={sessionId}
          file={file}
          turnNumber={turn.number}
          isSelected={file.key === selectedKey}
          onSelect={() => onSelect(file.key)}
        />
      ))}
    </ul>
  </section>
);
