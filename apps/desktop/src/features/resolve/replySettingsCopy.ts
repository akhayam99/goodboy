import type { ReplyVoice, ResolveCommitStyle } from '@goodboy/types';
import type { ReplySettings } from './replySettings';

export const REVIEW_REPLIES_SECTION_ID = 'review-replies';

export const VOICE_LABEL: Record<ReplyVoice, string> = {
  terse: 'Terse',
  friendly: 'Friendly',
  formal: 'Formal',
  mine: 'Like my replies',
};

export const VOICE_HELP: Record<ReplyVoice, string> = {
  terse: 'The reason, no thanks, no apologies, two to four sentences.',
  friendly: 'First person, with one short thanks when the comment caught a real bug.',
  formal: 'Third person, complete sentences, no contractions.',
  mine: 'Follows the style note learned from your own replies.',
};

export const VOICE_SAMPLE: Record<ReplyVoice, string> = {
  terse:
    'Attempts are now capped at 6 with exponential backoff, and `Retry-After` wins over the computed delay.',
  friendly:
    'Good catch, thanks. We now stop after 6 attempts with exponential backoff, and we respect `Retry-After` when the provider sends it.',
  formal:
    'The retry loop is now capped at six attempts with exponential backoff. When the provider sends `Retry-After`, that value takes precedence.',
  mine: 'Attempts are now capped at 6 with exponential backoff, and `Retry-After` wins over the computed delay.',
};

export const COMMIT_STYLE_LABEL: Record<ResolveCommitStyle, string> = {
  new: 'New commit',
  fixup: 'Fixup of the commit that added the line',
};

export const replySettingsSummary = ({ settings }: { readonly settings: ReplySettings }): string =>
  [
    VOICE_LABEL[settings.voice],
    settings.isSigned ? 'signed' : 'not signed',
    settings.resolveOnGithub ? 'resolves the thread on GitHub' : 'leaves the thread open',
  ].join(' · ');
