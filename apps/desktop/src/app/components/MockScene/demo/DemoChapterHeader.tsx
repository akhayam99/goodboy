import { MousePointerClick } from 'lucide-react';
import { Button, Eyebrow, ICON_SIZE, Kbd, cn } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { HintTally } from './hints/hintTally';
import { DemoHintDots } from './DemoHintDots';
import { quietClasses } from './quietClasses';

type Props = {
  readonly chapter: DemoChapter;
  readonly tally: HintTally;
  readonly isHintHidden: boolean;
  readonly isQuiet: boolean;
  readonly onShowHint: () => void;
};

export const DemoChapterHeader = ({ chapter, tally, isHintHidden, isQuiet, onShowHint }: Props) => (
  <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-display text-foreground">{chapter.title}</h1>
        {chapter.isOptional === true ? <Eyebrow label="Optional" muted /> : null}
      </div>
      <p
        data-quiet={isQuiet ? 'true' : 'false'}
        className={cn('text-ui text-muted-foreground', quietClasses({ isQuiet }))}
      >
        {chapter.summary}
      </p>
    </div>
    {tally.total > 0 ? (
      <div className="flex items-center gap-3">
        <DemoHintDots tally={tally} />
        <p className="text-ui text-muted-foreground">
          <span className="text-foreground">
            {tally.tried} of {tally.total}
          </span>{' '}
          tried
        </p>
        {isHintHidden ? (
          <Button size="sm" variant="secondary" onClick={onShowHint}>
            Show hint
            <Kbd>H</Kbd>
          </Button>
        ) : null}
      </div>
    ) : (
      <p
        data-quiet={isQuiet ? 'true' : 'false'}
        className={cn(
          'flex max-w-sm items-center gap-2 text-ui text-muted-foreground',
          quietClasses({ isQuiet }),
        )}
      >
        <MousePointerClick size={ICON_SIZE.control} className="shrink-0 text-primary" aria-hidden />
        <span>
          <span className="text-foreground">Try this</span> {chapter.tryThis}
        </span>
      </p>
    )}
  </header>
);
