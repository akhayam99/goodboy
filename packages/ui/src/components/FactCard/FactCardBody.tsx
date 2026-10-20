import { StatusDot } from '../StatusDot';
import { FactCardFacts } from './FactCardFacts';
import { FactCardFootnote } from './FactCardFootnote';
import { FactCardHeader } from './FactCardHeader';
import { FactCardState } from './FactCardState';
import { cappedFacts } from './cappedFacts';
import { toneOfFact } from './toneOfFact';
import type { FactCardSpec } from './types';

type Props = {
  readonly card: FactCardSpec;
};

export const FactCardBody = ({ card }: Props) => (
  <div className="flex flex-col gap-3">
    <FactCardHeader glyph={card.glyph} title={card.title} sub={card.sub} />
    {card.state === undefined ? null : (
      <FactCardState
        glyph={
          <StatusDot
            tone={toneOfFact({ tone: card.state.tone })}
            size="sm"
            pulsing={card.state.isRunning === true}
          />
        }
        words={card.state.words}
      />
    )}
    {card.facts.length === 0 ? null : <FactCardFacts facts={cappedFacts({ card })} />}
    {card.footnote === undefined ? null : <FactCardFootnote text={card.footnote} />}
  </div>
);
