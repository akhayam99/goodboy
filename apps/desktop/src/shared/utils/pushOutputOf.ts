import { stripAnsi } from './stripAnsi';

type Params = {
  readonly stdout: string;
  readonly stderr: string;
};

const OUTPUT_LIMIT = 4000;
const HEAD_LIMIT = 3000;
const TAIL_LIMIT = 800;
const CUT_MARK = '\n...\n';

export const pushOutputOf = ({ stdout, stderr }: Params): string => {
  const joined = [stderr, stdout]
    .map((part) => stripAnsi({ text: part }).replace(/\r\n?/g, '\n').trim())
    .filter((part) => part.length > 0)
    .join('\n');
  if (joined.length <= OUTPUT_LIMIT) {
    return joined;
  }
  return `${joined.slice(0, HEAD_LIMIT)}${CUT_MARK}${joined.slice(-TAIL_LIMIT)}`;
};
