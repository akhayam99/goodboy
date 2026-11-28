import {
  detectSessionLanguage,
  isInSessionLanguage,
  type PreferredLanguage,
} from '@goodboy/core/language';
import { extractAuxOutput } from '@goodboy/core/providers';
import { cleanWorkflowRunTitle, titleInTag } from '@goodboy/db';
import type { ProviderId } from '@goodboy/types';

const MAX_TITLE_WORDS = 6;

type Params = {
  readonly providerId: ProviderId;
  readonly stdout: string;
  readonly ask: string;
  readonly preferred?: PreferredLanguage | null;
};

export const parseGeneratedTitle = ({
  providerId,
  stdout,
  ask,
  preferred = null,
}: Params): string => {
  const text = extractAuxOutput({ providerId, stdout }).text;
  const words = titleInTag({ text })
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const title = words.length > MAX_TITLE_WORDS ? '' : words.join(' ');
  const cleaned = cleanWorkflowRunTitle({ title, goal: ask });
  if (preferred !== null) {
    return isInSessionLanguage({ preferred, text: cleaned })
      ? cleaned
      : cleanWorkflowRunTitle({ title: '', goal: ask });
  }
  const titleLanguage = detectSessionLanguage({ text: cleaned });
  const askLanguage = detectSessionLanguage({ text: ask });
  if (titleLanguage !== null && askLanguage !== null && titleLanguage !== askLanguage) {
    return cleanWorkflowRunTitle({ title: '', goal: ask });
  }
  return cleaned;
};
