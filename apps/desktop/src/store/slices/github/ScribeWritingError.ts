import { SCRIBE_WRITING_REASON } from '../scribe/scribeWritingReason';

export class ScribeWritingError extends Error {
  constructor() {
    super(SCRIBE_WRITING_REASON);
    this.name = 'ScribeWritingError';
  }
}
