import { firstSentenceOf } from '../done/firstSentenceOf';
import { plainStateOf } from './plainStateOf';

type Params = {
  readonly body: string;
};

export const stateBodyHasMore = ({ body }: Params): boolean => {
  const plain = plainStateOf({ body });
  const first = firstSentenceOf({ text: plain });
  if (first === null || first.trim() === '') {
    return false;
  }
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  if (lines.length > 1) {
    return true;
  }
  const only = lines[0] ?? '';
  return (only.endsWith('.') ? only.slice(0, -1) : only) !== first.trim();
};
