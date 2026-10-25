import { stripAnsi } from '../../shared/utils/stripAnsi';

type Params = {
  readonly text: string;
};

type LineParams = {
  readonly line: string;
};

const collapseLine = ({ line }: LineParams): string => {
  if (!line.includes('\r')) {
    return line;
  }
  const frames = line.split('\r');
  const hasOpenFrame = frames[frames.length - 1] === '';
  const shown = frames.filter((frame) => stripAnsi({ text: frame }).trim() !== '');
  const last = shown[shown.length - 1];
  if (last === undefined) {
    return hasOpenFrame ? '\r' : '';
  }
  return hasOpenFrame ? `${last}\r` : last;
};

export const collapseCarriageReturns = ({ text }: Params): string => {
  if (!text.includes('\r')) {
    return text;
  }
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => collapseLine({ line }))
    .join('\n');
};
