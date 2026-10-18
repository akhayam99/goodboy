import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { FOCUS_RING, ICON_SIZE, cn } from '@goodboy/ui';
import { useFileDropTarget } from '../../hooks/useFileDropTarget';

type DropParams = {
  readonly paths: ReadonlyArray<string>;
};

type Props = {
  readonly readingName: string | null;
  readonly isBusy: boolean;
  readonly onChoose: () => void;
  readonly onDrop: (params: DropParams) => void;
};

export const DropZone = ({ readingName, isBusy, onChoose, onDrop }: Props) => {
  const targetRef = useRef<HTMLButtonElement>(null);
  const { isDragging } = useFileDropTarget({
    targetRef,
    isEnabled: !isBusy,
    onDropPaths: onDrop,
  });

  return (
    <button
      ref={targetRef}
      type="button"
      data-drop-composer=""
      aria-busy={readingName === null ? undefined : true}
      disabled={isBusy}
      onClick={onChoose}
      className={cn(
        'flex h-52 w-full flex-col items-center justify-center gap-3 rounded-lg bg-subtle ring-1 ring-inset ring-border-soft motion-safe:transition-colors',
        'hover:bg-hover disabled:cursor-default',
        FOCUS_RING,
        isDragging && 'bg-muted ring-2 ring-primary',
      )}
    >
      <span
        className={cn(
          'flex size-10 items-center justify-center rounded-full bg-fill text-muted-foreground',
          isDragging && 'text-primary',
        )}
      >
        <Upload size={ICON_SIZE.hero} strokeWidth={1.6} aria-hidden />
      </span>
      <span className="flex flex-col items-center gap-1">
        <span className="text-row text-foreground">
          {readingName === null ? 'Drop a folder here' : `Reading ${readingName}`}
        </span>
        <span className="text-meta text-faint-foreground">
          A repository, or a folder that holds several
        </span>
      </span>
    </button>
  );
};
