const MAX_LENGTH = 70;
const MIN_LENGTH = 30;
const PAD = ' | Release notes and what changed';
const TAIL = ' .,;:';

type Params = {
  readonly version: string;
  readonly summary: string;
};

type TextParams = {
  readonly text: string;
};

type FitParams = {
  readonly prefix: string;
  readonly theme: string;
};

const trimTail = ({ text }: TextParams) => {
  let end = text.length;
  while (end > 0 && TAIL.includes(text[end - 1])) {
    end -= 1;
  }
  return text.slice(0, end);
};

const firstSentence = ({ text }: TextParams) => {
  const end = text.indexOf('. ');
  return trimTail({ text: end === -1 ? text : text.slice(0, end) });
};

const fitted = ({ prefix, theme }: FitParams) => {
  const room = MAX_LENGTH - prefix.length;
  if (theme.length <= room) {
    return `${prefix}${theme}`;
  }
  const cut = theme.slice(0, room + 1);
  const space = cut.lastIndexOf(' ');
  return `${prefix}${trimTail({ text: cut.slice(0, space === -1 ? room : space) })}`;
};

export const releaseTitle = ({ version, summary }: Params) => {
  const theme = firstSentence({ text: summary });
  const title =
    theme === '' ? `Goodboy ${version}` : fitted({ prefix: `Goodboy ${version}: `, theme });
  return title.length < MIN_LENGTH ? `${title}${PAD}` : title;
};
