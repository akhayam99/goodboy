import { Eyebrow } from '@goodboy/ui';
import type { DemoChapter } from './demoChapters';
import type { HintTally } from './hints/hintTally';
import { DemoHintDots } from './DemoHintDots';

type Props = {
  readonly chapter: DemoChapter;
  readonly tally: HintTally;
  readonly instruction: string;
};

export const DemoChapterHeader = ({ chapter, tally, instruction }: Props) => (
  <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-display text-foreground">{chapter.title}</h1>
        {chapter.isOptional === true ? <Eyebrow label="Optional" muted /> : null}
      </div>
      <p className="text-ui text-muted-foreground">{instruction}</p>
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
      </div>
    ) : null}
  </header>
);
