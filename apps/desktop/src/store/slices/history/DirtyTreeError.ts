import { dirtyTreeSentence } from '../../../shared/lib/dirtyTreeCopy';

type Params = {
  readonly count: number;
};

export class DirtyTreeError extends Error {
  readonly count: number;

  constructor({ count }: Params) {
    super(dirtyTreeSentence({ count }));
    this.name = 'DirtyTreeError';
    this.count = count;
  }
}
