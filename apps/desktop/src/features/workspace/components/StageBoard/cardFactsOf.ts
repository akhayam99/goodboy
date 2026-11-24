import { sentenceCase } from '../../../../shared/utils/sentenceCase';
import type { BoardSignal } from './boardSignalOf';

type Params = {
  readonly reason: string;
  readonly hasFact: boolean;
  readonly age: string;
  readonly signal: BoardSignal;
  readonly isArchived: boolean;
};

export type CardFacts = {
  readonly state: string;
  readonly age: string;
};

export const cardFactsOf = ({ reason, hasFact, age, signal, isArchived }: Params): CardFacts => {
  const isStateShown = !isArchived && hasFact && signal.kind !== 'attention';
  return { state: isStateShown ? sentenceCase({ text: reason.trim() }) : '', age: age.trim() };
};
