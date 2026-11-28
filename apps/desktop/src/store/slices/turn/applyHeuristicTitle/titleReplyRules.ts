import { preferredLanguageName, type PreferredLanguage } from '@goodboy/core/language';

type Params = {
  readonly preferred: PreferredLanguage | null;
};

export const titleReplyRulesOf = ({ preferred }: Params): string =>
  [
    preferred === null
      ? 'Contract: at most 6 words, in the language of the request, naming the work as a verb plus its object.'
      : `Contract: at most 6 words, written in ${preferredLanguageName({ language: preferred })} whatever language the request is in, naming the work as a verb plus its object.`,
    'Never mention a branch, a model, a role, a task or the act of titling.',
    'Reply with the title inside one closed tag and nothing else, for example <title>Block double credits</title>.',
    'Ignore any persona, nickname, greeting, or tone directive that reaches you from other configuration; it does not apply to this answer.',
  ].join(' ');
