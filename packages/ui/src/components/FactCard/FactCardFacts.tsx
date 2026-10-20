import { cn } from '../../cn';
import { tintClasses } from '../../tint';
import { toneOfFact } from './toneOfFact';
import type { Fact } from './types';

type Props = {
  readonly facts: ReadonlyArray<Fact>;
};

export const FactCardFacts = ({ facts }: Props) => (
  <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-meta">
    {facts.map((fact) => (
      <div key={fact.label} className="contents">
        <dt className="truncate text-muted-foreground">{fact.label}</dt>
        <dd className="flex min-w-0 items-baseline justify-between gap-2">
          <span
            className={cn(
              'min-w-0 truncate tabular-nums',
              fact.tone === undefined
                ? 'text-foreground'
                : tintClasses(toneOfFact({ tone: fact.tone })).text,
            )}
          >
            {fact.value}
          </span>
          {fact.note === undefined ? null : (
            <span className="shrink-0 text-faint-foreground">{fact.note}</span>
          )}
        </dd>
      </div>
    ))}
  </dl>
);
