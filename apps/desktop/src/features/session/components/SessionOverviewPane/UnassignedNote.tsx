import { useId, useState } from 'react';
import type { DiffComment, MountId } from '@goodboy/types';
import { Trash2 } from 'lucide-react';
import { Button, OverflowMenu } from '@goodboy/ui';

export type NoteTarget = {
  readonly mountId: MountId;
  readonly branch: string;
  readonly mountName: string;
};

type Props = {
  readonly note: DiffComment;
  readonly targets: ReadonlyArray<NoteTarget>;
  readonly onMove: (mountId: MountId) => void;
  readonly onDiscard: () => void;
};

const lineOf = ({
  filePath,
  line,
}: {
  readonly filePath: string;
  readonly line: number | undefined;
}): string => (line === undefined ? filePath : `${filePath}:${line}`);

export const UnassignedNote = ({ note, targets, onMove, onDiscard }: Props) => {
  const [isChoosing, setIsChoosing] = useState(false);
  const chooserId = useId();
  const [only] = targets;

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-soft bg-elevated px-3 py-2">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-mono text-meta text-muted-foreground">
            {lineOf({ filePath: note.filePath, line: note.anchor?.lineNumber })}
          </span>
          <p className="whitespace-pre-wrap break-words text-body text-foreground">{note.body}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {targets.length === 1 && only !== undefined && (
            <Button size="sm" variant="ghost" onClick={() => onMove(only.mountId)}>
              Move to {only.branch}
            </Button>
          )}
          {targets.length > 1 && (
            <Button
              size="sm"
              variant="ghost"
              aria-expanded={isChoosing}
              aria-controls={chooserId}
              onClick={() => setIsChoosing((current) => !current)}
            >
              Move to
            </Button>
          )}
          <OverflowMenu
            label="Note actions"
            items={[
              {
                kind: 'item',
                key: 'discard',
                label: 'Discard',
                icon: Trash2,
                destructive: true,
                onClick: onDiscard,
              },
            ]}
          />
        </div>
      </div>
      {isChoosing && (
        <div
          id={chooserId}
          role="group"
          aria-label="Move to a branch"
          className="flex min-w-0 flex-wrap items-center gap-1"
        >
          {targets.map((target) => (
            <Button
              key={target.mountId}
              size="sm"
              variant="secondary"
              title={target.mountName}
              onClick={() => {
                setIsChoosing(false);
                onMove(target.mountId);
              }}
            >
              {target.branch}
              <span className="text-faint-foreground">{target.mountName}</span>
            </Button>
          ))}
        </div>
      )}
    </li>
  );
};
