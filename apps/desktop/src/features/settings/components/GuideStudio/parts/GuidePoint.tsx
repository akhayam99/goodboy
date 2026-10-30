import { useEffect, useRef } from 'react';
import { PANE_RHYTHM, cn, tintClasses } from '@goodboy/ui';

type Props = {
  readonly term: string;
  readonly desc: string;
  readonly flashNonce: number | null;
};

export const GuidePoint = ({ term, desc, flashNonce }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const isFlashing = flashNonce !== null;

  useEffect(() => {
    if (!isFlashing) {
      return;
    }
    ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [isFlashing, flashNonce]);

  return (
    <div
      ref={ref}
      data-guide-point={term}
      data-flash={isFlashing ? '' : undefined}
      className="relative flex flex-col gap-1"
    >
      {isFlashing ? (
        <span
          key={flashNonce}
          aria-hidden
          className={cn(
            'pointer-events-none absolute -inset-x-3 -inset-y-2 hidden rounded-lg motion-safe:block motion-safe:animate-history-arrive',
            tintClasses('primary').bg,
          )}
        />
      ) : null}
      <h2 className="relative text-lead text-foreground">{term}</h2>
      <p className={cn('relative text-prose text-muted-foreground', PANE_RHYTHM.prose)}>{desc}</p>
    </div>
  );
};
