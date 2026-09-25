type Params = {
  readonly text: string;
  readonly capChars: number;
};

export type BoundaryCut = {
  readonly text: string;
  readonly omittedChars: number;
};

const FENCE_LINE = /^\s*(```|~~~)/;
const SENTENCE_END = /[.!?](?=\s)/g;
const ELLIPSIS = '…';

type WindowParams = {
  readonly window: string;
  readonly floor: number;
  readonly capChars: number;
};

type Cut = {
  readonly end: number;
  readonly isMidSentence: boolean;
};

const lastSentenceEnd = ({ window, floor }: Omit<WindowParams, 'capChars'>): number => {
  const ends = [...window.matchAll(SENTENCE_END)].map((match) => match.index + 1);
  const last = ends.at(-1);
  return last !== undefined && last > floor ? last : -1;
};

const findCut = ({ window, floor, capChars }: WindowParams): Cut => {
  const paragraph = window.lastIndexOf('\n\n');
  if (paragraph > floor) {
    return { end: paragraph, isMidSentence: false };
  }
  const line = window.lastIndexOf('\n');
  if (line > floor) {
    return { end: line, isMidSentence: false };
  }
  const sentence = lastSentenceEnd({ window, floor });
  if (sentence > 0) {
    return { end: sentence, isMidSentence: false };
  }
  const word = window.search(/\s\S*$/);
  if (word > floor) {
    return { end: word, isMidSentence: true };
  }
  return { end: capChars, isMidSentence: true };
};

type FenceParams = {
  readonly text: string;
};

const openFence = ({ text }: FenceParams): string | null =>
  text.split('\n').reduce<string | null>((open, line) => {
    const marker = FENCE_LINE.exec(line)?.[1];
    if (marker === undefined) {
      return open;
    }
    if (open === null) {
      return marker;
    }
    return open === marker ? null : open;
  }, null);

export const cutAtBoundary = ({ text, capChars }: Params): BoundaryCut => {
  if (text.length <= capChars) {
    return { text, omittedChars: 0 };
  }
  const window = text.slice(0, capChars + 1);
  const { end, isMidSentence } = findCut({ window, floor: Math.floor(capChars / 2), capChars });
  const kept = window.slice(0, end).trimEnd();
  const omittedChars = text.length - kept.length;
  const fence = openFence({ text: kept });
  if (fence !== null) {
    return { text: `${kept}\n${fence}`, omittedChars };
  }
  return { text: isMidSentence ? `${kept}${ELLIPSIS}` : kept, omittedChars };
};
