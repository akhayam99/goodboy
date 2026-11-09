import { useEffect, type RefObject } from 'react';
import { Button, FLOATING_SURFACE, KbdPill, WorkNode, cn } from '@goodboy/ui';

export type ChapterDone = {
  readonly title: string;
  readonly outro: string;
  readonly nextTitle: string;
};

type Props = {
  readonly done: ChapterDone;
  readonly nextRef: RefObject<HTMLButtonElement | null>;
  readonly onNext: () => void;
  readonly onReplay: () => void;
};

export const DemoChapterDone = ({ done, nextRef, onNext, onReplay }: Props) => {
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [nextRef]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <section
        aria-label={`${done.title} is done`}
        data-testid="demo-chapter-done"
        className={cn(
          'pointer-events-auto flex w-full max-w-lg flex-col gap-4 p-4 motion-safe:animate-fade-in',
          FLOATING_SURFACE,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <WorkNode state="done" tone="primary" label="done" mark={{ kind: 'dot' }} />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-heading text-foreground">{done.title} is done</h2>
            <p className="text-body text-muted-foreground">{done.outro}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="md" onClick={onReplay}>
            Replay this chapter
          </Button>
          <Button ref={nextRef} variant="primary" size="md" onClick={onNext}>
            Next: {done.nextTitle}
            <KbdPill isOnTone aria-hidden>
              →
            </KbdPill>
          </Button>
        </div>
      </section>
    </div>
  );
};
