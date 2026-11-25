import type { ReactNode } from 'react';
import type { CardFacts } from '../cardFactsOf';

type Props = {
  readonly facts: CardFacts;
  readonly signal: ReactNode;
};

const SEPARATOR = (
  <span aria-hidden className="inline-block w-4 shrink-0 text-center">
    ·
  </span>
);

export const CardFactsLine = ({ facts, signal }: Props) => (
  <div className="flex min-h-5 min-w-0 items-start gap-2">
    <span
      data-slot="card-facts"
      className="min-w-0 flex-1 overflow-hidden text-meta text-faint-foreground"
    >
      <span className="flex w-[calc(100%+1rem)] -translate-x-4 flex-wrap">
        {facts.state === '' ? null : (
          <span className="flex min-w-0">
            {SEPARATOR}
            <span className="min-w-0">{facts.state}</span>
          </span>
        )}
        {facts.age === '' ? null : (
          <span className="flex shrink-0 whitespace-nowrap tabular-nums">
            {SEPARATOR}
            {facts.age}
          </span>
        )}
      </span>
    </span>
    {signal}
  </div>
);
