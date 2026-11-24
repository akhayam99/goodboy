import type { ReactNode } from 'react';
import { TruncatedText } from '@goodboy/ui';
import type { CardFacts } from '../cardFactsOf';

type Props = {
  readonly facts: CardFacts;
  readonly signal: ReactNode;
};

export const CardFactsLine = ({ facts, signal }: Props) => (
  <div className="flex min-h-5 min-w-0 items-center gap-2">
    <span
      data-slot="card-facts"
      className="flex min-w-0 flex-1 items-baseline gap-1 text-meta text-faint-foreground"
    >
      {facts.state === '' ? null : <TruncatedText className="min-w-0">{facts.state}</TruncatedText>}
      {facts.state === '' || facts.age === '' ? null : (
        <span aria-hidden className="shrink-0">
          ·
        </span>
      )}
      {facts.age === '' ? null : (
        <span className="shrink-0 whitespace-nowrap tabular-nums">{facts.age}</span>
      )}
    </span>
    {signal}
  </div>
);
