import { joinNouns } from '../../../auto/joinNouns';
import { firstSentenceOf } from './firstSentenceOf';

type Params = {
  readonly text: string | null | undefined;
};

type TextParams = {
  readonly text: string;
};

const MAX_TITLE_LENGTH = 90;

const MAX_TOKEN_LENGTH = 24;

const LABEL_PREFIX =
  /^(?:cluster|batch|step|part|phase|wave|run|pr|mr|commit|task|unit|round|item)\s+#?[^\s\d]*\d\S*(?:\s+\w+){0,3}:\s+(?=\S)/i;

const SHA_TOKEN = /^(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}$/;

const SLASH_LIST = /(?<![\w./-])[A-Za-z]{2,12}(?:\/[A-Za-z]{2,12}){2,}(?![\w./-])/g;

const LIST_PARENTHETICAL = /\s*\([^()]{0,40}[,/][^()]{0,40}\)/g;

const withoutLabelOf = ({ text }: TextParams): string => text.replace(LABEL_PREFIX, '');

const withoutMarkupOf = ({ text }: TextParams): string =>
  text.replace(/`/g, '').replace(LIST_PARENTHETICAL, '');

const slashListWordsOf = ({ text }: TextParams): string =>
  text.replace(SLASH_LIST, (list) => joinNouns({ nouns: list.split('/') }));

const tokenOf = ({ text }: TextParams): string | null => {
  if (SHA_TOKEN.test(text.replace(/[.,;:]+$/, ''))) {
    return null;
  }
  if (text.length > MAX_TOKEN_LENGTH && text.includes('/')) {
    const segments = text.split('/').filter((segment) => segment !== '');
    return segments[segments.length - 1] ?? text;
  }
  return text;
};

const withoutNoiseOf = ({ text }: TextParams): string =>
  text
    .split(/\s+/)
    .flatMap((token) => {
      const kept = tokenOf({ text: token });
      return kept === null ? [] : [kept];
    })
    .join(' ');

const cappedOf = ({ text }: TextParams): string => {
  if (text.length <= MAX_TITLE_LENGTH) {
    return text;
  }
  const cut = text.slice(0, MAX_TITLE_LENGTH + 1);
  const space = cut.lastIndexOf(' ');
  const head = (space > 0 ? cut.slice(0, space) : cut.slice(0, MAX_TITLE_LENGTH)).replace(
    /[\s.,;:]+$/,
    '',
  );
  return `${head}…`;
};

const capitalizedOf = ({ text }: TextParams): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

export const plainTitleOf = ({ text }: Params): string | null => {
  const sentence = firstSentenceOf({ text });
  if (sentence === null) {
    return null;
  }
  const plain = withoutNoiseOf({
    text: slashListWordsOf({ text: withoutMarkupOf({ text: withoutLabelOf({ text: sentence }) }) }),
  })
    .trim()
    .replace(/[\s.,;:]+$/, '');
  return plain === '' ? null : capitalizedOf({ text: cappedOf({ text: plain }) });
};
