import { Check } from 'lucide-react';
import { Button, ICON_SIZE, StatusDot, TruncatedText, tintClasses } from '@goodboy/ui';
import type { RebaseFileState } from '../rebaseFileStatesOf';

export type OpenFileParams = {
  readonly path: string;
};

type FileStateParams = {
  readonly file: RebaseFileState;
};

const fileStateLabelOf = ({ file }: FileStateParams): string => {
  if (file.isResolved) {
    return 'Resolved';
  }
  if (file.isWorking) {
    return 'Auto is resolving';
  }
  return 'Still conflicts';
};

type Props = {
  readonly label: string;
  readonly files: ReadonlyArray<RebaseFileState>;
  readonly onOpen: ((params: OpenFileParams) => void) | null;
};

export const RebaseStopFiles = ({ label, files, onOpen }: Props) => {
  if (files.length === 0) {
    return null;
  }
  return (
    <ul aria-label={label} className="flex w-full min-w-0 flex-col gap-1">
      {files.map((file) => (
        <li
          key={file.path}
          data-rebase-file={file.isResolved ? 'resolved' : 'conflict'}
          className="grid min-h-7 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
        >
          <span className="flex size-3 items-center justify-center">
            <span className="sr-only">{fileStateLabelOf({ file })}</span>
            <span aria-hidden className="flex items-center justify-center">
              {file.isResolved ? (
                <Check size={ICON_SIZE.row} className={tintClasses('success').icon} />
              ) : (
                <StatusDot
                  tone={file.isWorking ? 'info' : 'warning'}
                  size="sm"
                  pulsing={file.isWorking}
                />
              )}
            </span>
          </span>
          <TruncatedText className="min-w-0 truncate text-code text-foreground">
            {file.path}
          </TruncatedText>
          {onOpen === null ? (
            <span aria-hidden />
          ) : (
            <Button
              size="xs"
              variant="ghost"
              aria-label={`Open ${file.path}`}
              onClick={() => onOpen({ path: file.path })}
            >
              Open
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
};
