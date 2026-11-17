import { markdownPlainLinesOf } from '../../shared/utils/markdownPreview';
import { commentPlaceOf } from './commentPlaceOf';
import { firstSentence } from './components/ReviewFlow/firstSentence';

export type RunGoalComment = {
  readonly body: string;
  readonly path: string | null;
  readonly line: number | null;
};

type Params = {
  readonly comments: ReadonlyArray<RunGoalComment>;
};

type TextParams = {
  readonly text: string;
};

type PlacesParams = {
  readonly places: ReadonlyArray<string>;
};

const MAX_BODY = 600;
const MAX_NAMED_PLACES = 3;
const NAMED_MODEL =
  /\b(?:follow|use|copy|mirror) (the [a-z][\w.-]*(?: [a-z][\w.-]*){0,3}) as (?:the|a|an) (?:model|example|reference|template)\b/i;
const WAY_MODEL = /\bthe way (the [a-z][\w.-]*(?: [a-z][\w.-]*){0,3}) does it\b/i;

const plainCommentOf = ({ text }: TextParams): string =>
  markdownPlainLinesOf({ text, shouldKeepOpenFence: false }).join(' ').replace(/\s+/g, ' ').trim();

const clippedBodyOf = ({ text }: TextParams): string => {
  if (text.length <= MAX_BODY) {
    return text;
  }
  const cut = text.slice(0, MAX_BODY);
  const space = cut.lastIndexOf(' ');
  return `${space > 0 ? cut.slice(0, space) : cut}…`;
};

const placesSentenceOf = ({ places }: PlacesParams): string => {
  if (places.length > MAX_NAMED_PLACES) {
    return `${places.length} places`;
  }
  if (places.length === 1) {
    return places[0] ?? '';
  }
  return `${places.slice(0, -1).join(', ')} and ${places[places.length - 1] ?? ''}`;
};

const modelOf = ({ text }: TextParams): string | null => {
  const match = NAMED_MODEL.exec(text) ?? WAY_MODEL.exec(text);
  const named = match?.[1];
  return named === undefined ? null : named.toLowerCase();
};

export const runGoalOf = ({ comments }: Params): string => {
  const plains = comments.map((comment) => plainCommentOf({ text: comment.body }));
  const places = [
    ...new Set(
      comments.flatMap((comment) => {
        const place = commentPlaceOf({ path: comment.path, line: comment.line });
        return place === null ? [] : [place];
      }),
    ),
  ];
  const isMany = comments.length > 1;
  const asks = isMany ? 'as the comments ask' : 'as the comment asks';
  const head =
    places.length === 0
      ? `Do what the ${isMany ? 'comments ask' : 'comment asks'}`
      : `Change ${placesSentenceOf({ places })} ${asks}`;
  const model = plains.map((text) => modelOf({ text })).find((named) => named !== null) ?? null;
  const lead = model === null ? `${head}.` : `${head}, the way ${model} does it.`;
  const body = isMany
    ? plains
        .map((text) => firstSentence({ text }))
        .filter((sentence) => sentence !== '')
        .join(' ')
    : clippedBodyOf({ text: plains[0] ?? '' });
  return body === '' ? lead : `${lead} ${body}`;
};
