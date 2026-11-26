import { TruncatedText, cn } from '@goodboy/ui';
import type { ErrorFrame } from '../../errorGroupsOf';

type Props = {
  readonly frame: ErrorFrame;
  readonly file: string | null;
};

export const ErrorsFrame = ({ frame, file }: Props) => (
  <div
    data-error-frame={file === null ? 'library' : 'own'}
    className={cn(
      'flex min-w-0 items-center gap-3',
      file === null ? 'text-muted-foreground' : 'text-foreground',
    )}
  >
    <TruncatedText className="min-w-0 flex-1">
      {frame.name === '' ? 'anonymous' : frame.name}
    </TruncatedText>
    <TruncatedText
      className={cn(
        'max-w-[60%] shrink-0',
        file === null ? 'text-faint-foreground' : 'text-primary',
      )}
    >
      {file ?? frame.label}
    </TruncatedText>
  </div>
);
