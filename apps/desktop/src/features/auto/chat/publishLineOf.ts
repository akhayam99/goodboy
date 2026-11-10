import {
  canPutBackPublish,
  canRetryPublish,
  publishTextOf,
  type PublishState,
  type ResultPublish,
} from '@goodboy/core/auto';
import type { Tone } from '@goodboy/ui';

type Params = {
  readonly publish: ResultPublish;
};

export type PublishLine = Readonly<{
  text: string;
  state: PublishState;
  tone: Tone;
  canRetry: boolean;
  canPutBack: boolean;
}>;

const publishToneOf = ({ publish }: Params): Tone => {
  if (publish.state === 'failed') {
    return 'warning';
  }
  return publish.state === 'pushed' ? 'success' : 'neutral';
};

export const publishLineOf = ({ publish }: Params): PublishLine => ({
  text: publishTextOf({ publish }),
  state: publish.state,
  tone: publishToneOf({ publish }),
  canRetry: canRetryPublish({ publish }),
  canPutBack: canPutBackPublish({ publish }),
});
