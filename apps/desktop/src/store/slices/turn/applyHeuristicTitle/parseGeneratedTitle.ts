import { extractAuxOutput } from '@goodboy/core/providers';
import { cleanWorkflowRunTitle, titleInTag } from '@goodboy/db';
import type { ProviderId } from '@goodboy/types';

const MAX_TITLE_WORDS = 6;

type Params = {
  readonly providerId: ProviderId;
  readonly stdout: string;
  readonly ask: string;
};

export const parseGeneratedTitle = ({ providerId, stdout, ask }: Params): string => {
  const text = extractAuxOutput({ providerId, stdout }).text;
  const title = titleInTag({ text })
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, MAX_TITLE_WORDS)
    .join(' ');
  return cleanWorkflowRunTitle({ title, goal: ask });
};
