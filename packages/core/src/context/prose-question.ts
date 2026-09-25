import { stripControlMarkers } from './marker-parsing';

const FENCED_BLOCK_RE = /```[\s\S]*?(?:```|$)/g;
const HEADING_LINE_RE = /^\s*#{1,6}\s/;
const SENTENCE_SPLIT_RE = /(?<=[?!.])\s+/;
const TRAILING_WRAP_RE = /[\s*_"'`)\]]+$/;
const ASK_RE =
  /\b(confermi|conferma|confirm|approvi|approve|shall i|should i|do you want|would you like|can i proceed|may i proceed|ok to proceed|let me know|vuoi che|posso procedere|fammi sapere|dimmi se|serve il tuo ok|need your (?:ok|approval|confirmation)|waiting for your (?:ok|approval|confirmation))\b/i;
const TAIL_PARAGRAPHS = 2;
const MAX_QUESTION_CHARS = 500;

type Params = {
  readonly assistantText: string;
};

const isQuestionSentence = (sentence: string): boolean => {
  const trimmed = sentence.replace(TRAILING_WRAP_RE, '');
  return trimmed.endsWith('?') || ASK_RE.test(trimmed);
};

const paragraphsOf = (text: string): ReadonlyArray<string> =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .filter((line) => !HEADING_LINE_RE.test(line))
        .join('\n')
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);

const questionTextOf = (paragraph: string): string | null => {
  const sentences = paragraph.split(SENTENCE_SPLIT_RE).map((sentence) => sentence.trim());
  const asks = sentences.filter((sentence) => sentence.length > 0 && isQuestionSentence(sentence));
  if (asks.length === 0) {
    return null;
  }
  if (paragraph.length <= MAX_QUESTION_CHARS) {
    return paragraph;
  }
  return asks.join(' ').slice(0, MAX_QUESTION_CHARS).trim();
};

export const extractProseQuestion = ({ assistantText }: Params): string | null => {
  FENCED_BLOCK_RE.lastIndex = 0;
  const visible = stripControlMarkers(assistantText).replace(FENCED_BLOCK_RE, '');
  const tail = paragraphsOf(visible).slice(-TAIL_PARAGRAPHS).reverse();
  for (const paragraph of tail) {
    const question = questionTextOf(paragraph);
    if (question !== null) {
      return question;
    }
  }
  return null;
};
