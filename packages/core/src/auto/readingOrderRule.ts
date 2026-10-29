import { OUTCOME_MAX_CHARS } from './outcome';

export const OUTCOME_MARKER_EXAMPLE = '<<outcome>>Changes needed: 1 blocker, 4 major.<</outcome>>';

export const READING_ORDER_RULE = [
  `Start every message that ends your turn with one \`<<outcome>>...<</outcome>>\` line of at most ${OUTCOME_MAX_CHARS} characters: the state and the result in one sentence, for example ${OUTCOME_MARKER_EXAMPLE}`,
  'Write the outcome line only from facts you checked. Goodboy replaces it when checks are red or a push failed.',
  'After the outcome line keep the text short, at most three sentences, and put files, plans and reports in an artifact block instead of prose.',
].join(' ');
