import { proseWordsOf } from './proseWordsOf';
import { SESSION_LANGUAGES, type SessionLanguage } from './sessionLanguages';
import { LANGUAGE_STOPWORDS } from './stopwords';

const MIN_PROSE_WORDS = 3;
const MIN_WINNER_HITS = 2;
const MIN_DENSITY_PERCENT = 15;
const LEAD_NUMERATOR = 3;
const LEAD_DENOMINATOR = 2;

type DetectParams = { readonly text: string };

export const detectSessionLanguage = ({ text }: DetectParams): SessionLanguage | null => {
  const words = proseWordsOf({ text });
  if (words.length < MIN_PROSE_WORDS) {
    return null;
  }
  const scored = SESSION_LANGUAGES.map((language) => ({
    language,
    hits: words.filter((word) => LANGUAGE_STOPWORDS[language].has(word)).length,
  })).sort((left, right) => right.hits - left.hits);
  const [winner, runnerUp] = scored;
  if (winner === undefined || winner.hits < MIN_WINNER_HITS) {
    return null;
  }
  if (winner.hits * 100 < words.length * MIN_DENSITY_PERCENT) {
    return null;
  }
  const runnerUpHits = runnerUp?.hits ?? 0;
  if (winner.hits * LEAD_DENOMINATOR < runnerUpHits * LEAD_NUMERATOR) {
    return null;
  }
  return winner.hits > runnerUpHits ? winner.language : null;
};
