import { Eyebrow } from '@goodboy/ui';
import type { HintTally } from './hints/hintTally';
import { DemoHintDots } from './DemoHintDots';

type Props = {
  readonly title: string;
  readonly isOptional: boolean;
  readonly tally: HintTally;
  readonly instruction: string | undefined;
};

export const DemoChapterHeader = ({ title, isOptional, tally, instruction }: Props) => (
  <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-display text-foreground">{title}</h1>
        {isOptional ? <Eyebrow label="Optional" muted /> : null}
      </div>
      {instruction === undefined ? null : (
        <p className="text-ui text-muted-foreground">{instruction}</p>
      )}
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
