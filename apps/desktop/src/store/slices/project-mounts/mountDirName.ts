import { seededRandom } from './seededRandom';

const PREFIX = 'gb-';
const SHORT_LENGTH = 6;
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

type Params = {
  readonly mountId: string;
  readonly random?: () => number;
  readonly length?: number;
};

export const mountDirName = ({
  mountId,
  random = seededRandom({ seed: mountId }),
  length = SHORT_LENGTH,
}: Params): string => {
  let suffix = '';
  for (let index = 0; index < length; index += 1) {
    const slot = Math.min(Math.floor(random() * ALPHABET.length), ALPHABET.length - 1);
    suffix += ALPHABET.charAt(slot);
  }
  return `${PREFIX}${suffix}`;
};
