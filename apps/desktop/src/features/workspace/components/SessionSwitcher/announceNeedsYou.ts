import { dispatchWindowEvent } from '../../../../shared/lib/dispatchWindowEvent';
import { NEEDS_YOU_FEEDBACK_EVENT } from './needsYouFeedbackEvent';

type Params = {
  readonly text: string;
};

export const announceNeedsYou = ({ text }: Params): void => {
  dispatchWindowEvent({ name: NEEDS_YOU_FEEDBACK_EVENT, detail: { text } });
};
