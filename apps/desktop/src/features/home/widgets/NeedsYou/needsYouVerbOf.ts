import type { SessionAttentionReason } from '@goodboy/types';

type Params = {
  readonly reason: SessionAttentionReason | null;
};

export const needsYouVerbOf = ({ reason }: Params): string => {
  if (reason === 'open-question') {
    return 'Answer';
  }
  return reason === 'plan-approval' ? 'Review plan' : 'Open';
};
