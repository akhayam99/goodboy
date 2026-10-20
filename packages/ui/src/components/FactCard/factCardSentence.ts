import { cappedFacts } from './cappedFacts';
import type { Fact, FactCardSpec } from './types';

type Params = {
  readonly card: FactCardSpec;
};

type EndParams = {
  readonly text: string;
};

type PhraseParams = {
  readonly fact: Fact;
};

const endSentence = ({ text }: EndParams): string => (/[.!?]$/.test(text) ? text : `${text}.`);

const factPhrase = ({ fact }: PhraseParams): string =>
  [fact.label, fact.value, fact.note]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(', ');

export const factCardSentence = ({ card }: Params): string =>
  [
    card.sub === undefined ? card.title : `${card.title} ${card.sub}`,
    card.state?.words,
    ...cappedFacts({ card }).map((fact) => factPhrase({ fact })),
    card.footnote,
  ]
    .filter((part): part is string => part !== undefined && part !== '')
    .map((text) => endSentence({ text }))
    .join(' ');
