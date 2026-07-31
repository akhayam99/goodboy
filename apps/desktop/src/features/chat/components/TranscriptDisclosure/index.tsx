import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Props = {
  readonly tone: Tone;
  readonly open: boolean;
  readonly header: ReactNode;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly bodyClassName?: string;
  readonly 'data-testid'?: string;
};

export const TranscriptDisclosure = ({
  tone,
  open,
  header,
  children,
  className,
  bodyClassName,
  'data-testid': testId,
}: Props) => {
  const accent = tintClasses(tone);

  return (
    <div
      data-testid={testId}
      className={cn(
        'flex min-w-0 flex-col rounded-r-md border-l-2',
        accent.border,
        open && accent.bgSoft,
        className,
      )}
    >
      {header}
      {open && children != null ? (
        <div className={cn('flex min-w-0 flex-col gap-1 pb-2 pl-7 pr-2', bodyClassName)}>
          {children}
        </div>
      ) : null}
    </div>
  );
};
