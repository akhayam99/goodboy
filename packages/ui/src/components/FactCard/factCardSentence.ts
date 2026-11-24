import { cappedFacts } from './cappedFacts';
import { cappedModels, type CappedModel } from './cappedModels';
import type { Fact, FactCardSpec, FactEffort, FactState } from './types';

type Params = {
  readonly card: FactCardSpec;
};

type EndParams = {
  readonly text: string;
};

type PhraseParams = {
  readonly fact: Fact;
};

type ModelPhraseParams = {
  readonly line: CappedModel;
};

type EffortPhraseParams = {
  readonly effort: FactEffort | undefined;
};

type StatePhraseParams = {
  readonly state: FactState | undefined;
};

type JoinParams = {
  readonly parts: ReadonlyArray<string | undefined>;
  readonly separator: string;
};

const joinFilled = ({ parts, separator }: JoinParams): string =>
  parts.filter((part): part is string => part !== undefined && part !== '').join(separator);

const endSentence = ({ text }: EndParams): string => (/[.!?]$/.test(text) ? text : `${text}.`);

const factPhrase = ({ fact }: PhraseParams): string =>
  joinFilled({ parts: [fact.label, fact.value, fact.note], separator: ', ' });

const effortPhrase = ({ effort }: EffortPhraseParams): string | undefined => {
  if (effort === undefined) {
    return undefined;
  }
  if (effort.steps <= 0) {
    return effort.word;
  }
  return `Effort ${effort.word}, ${effort.step} of ${effort.steps}`;
};

const modelPhrase = ({ line }: ModelPhraseParams): string =>
  joinFilled({
    parts: [
      line.label,
      line.model.providerLabel,
      line.model.name,
      effortPhrase({ effort: line.model.effort }),
    ],
    separator: ', ',
  });

const statePhrase = ({ state }: StatePhraseParams): string | undefined =>
  state === undefined
    ? undefined
    : joinFilled({ parts: [state.words, state.note], separator: ' ' });

export const factCardSentence = ({ card }: Params): string =>
  joinFilled({
    parts: [
      card.sub === undefined ? card.title : `${card.title} ${card.sub}`,
      card.task,
      statePhrase({ state: card.state }),
      ...cappedModels({ card }).map((line) => modelPhrase({ line })),
      ...cappedFacts({ card }).map((fact) => factPhrase({ fact })),
      card.footnote,
    ].map((text) => (text === undefined || text === '' ? undefined : endSentence({ text }))),
    separator: ' ',
  });
