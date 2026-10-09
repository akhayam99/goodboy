import { NAMES } from '../../shared/names';
import type { ResolveRowState } from './resolveRowState';

export const BAR_COPY = {
  label: 'Comment actions',
  more: 'More actions',
  retryPush: NAMES.retryPush,
  openTranscript: 'Open transcript',
  viewOn: ({ host }: { readonly host: string }): string => `View on ${host}`,
} as const;

export const PUSH_FAILED_TITLE = 'Push failed';

const PUSH_FAILED_SENTENCE =
  'The remote rejected the update. The fix is saved and nothing was sent. Retry the push.';

const GENERIC_PUSH_SENTENCE = 'Nothing was pushed';

const endsSentence = ({ text }: { readonly text: string }): string =>
  text.endsWith('.') ? text : `${text}.`;

export const pushFailedBodyOf = ({ rowState }: { readonly rowState: ResolveRowState }): string => {
  const sentence = rowState.sentence;
  if (sentence === null || sentence === GENERIC_PUSH_SENTENCE) {
    return PUSH_FAILED_SENTENCE;
  }
  return `${endsSentence({ text: sentence })} Retry the push.`;
};
