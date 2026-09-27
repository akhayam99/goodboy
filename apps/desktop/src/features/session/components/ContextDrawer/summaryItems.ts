const BULLET = /^[-*+][ \t]+/;
const SUB_LINE = /^[ \t]+\S/;
const SENTENCE_BREAK = /(?<=[.!?])[ \t]+(?=[A-Z0-9`"])/;

type Params = {
  readonly body: string;
};

const bulletsOf = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  lines.reduce<Array<string>>((items, line) => {
    if (BULLET.test(line)) {
      return [...items, line.replace(BULLET, '')];
    }
    const last = items.at(-1);
    if (last !== undefined && SUB_LINE.test(line)) {
      return [...items.slice(0, -1), `${last}\n${line.trimStart()}`];
    }
    return [...items, line.trim()];
  }, []);

const sentencesOf = (paragraph: string): ReadonlyArray<string> =>
  paragraph
    .split(SENTENCE_BREAK)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');

const itemsOfGroup = (group: string): ReadonlyArray<string> => {
  const lines = group.split('\n').filter((line) => line.trim() !== '');
  if (lines.some((line) => BULLET.test(line))) {
    return bulletsOf(lines);
  }
  return sentencesOf(lines.map((line) => line.trim()).join(' '));
};

export const summaryItems = ({ body }: Params): ReadonlyArray<string> =>
  body
    .split(/\n[ \t]*\n/)
    .flatMap(itemsOfGroup)
    .filter((item) => item.trim() !== '');
