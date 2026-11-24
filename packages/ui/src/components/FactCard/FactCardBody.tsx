import { StatusDot } from '../StatusDot';
import { FactCardFacts } from './FactCardFacts';
import { FactCardFootnote } from './FactCardFootnote';
import { FactCardHeader } from './FactCardHeader';
import { FactCardModels } from './FactCardModels';
import { FactCardState } from './FactCardState';
import { FactCardTask } from './FactCardTask';
import { cappedFacts } from './cappedFacts';
import { cappedModels } from './cappedModels';
import { toneOfFact } from './toneOfFact';
import type { FactCardSpec } from './types';

type Props = {
  readonly card: FactCardSpec;
};

export const FactCardBody = ({ card }: Props) => {
  const models = cappedModels({ card });
  const dot =
    card.state === undefined ? null : (
      <StatusDot
        tone={toneOfFact({ tone: card.state.tone })}
        size="sm"
        pulsing={card.state.isRunning === true}
      />
    );
  const stateGlyph = card.stateGlyph ?? dot;
  return (
    <div className="flex flex-col gap-3">
      <FactCardHeader glyph={card.glyph} title={card.title} sub={card.sub} />
      {card.task === undefined ? null : (
        <FactCardTask task={card.task} state={card.state} stateGlyph={stateGlyph} />
      )}
      {card.task !== undefined || card.state === undefined ? null : (
        <FactCardState glyph={stateGlyph} words={card.state.words} />
      )}
      {card.facts.length === 0 && models.length === 0 ? null : (
        <FactCardFacts
          facts={cappedFacts({ card })}
          lead={models.length === 0 ? null : <FactCardModels models={models} />}
        />
      )}
      {card.footnote === undefined ? null : <FactCardFootnote text={card.footnote} />}
    </div>
  );
};
