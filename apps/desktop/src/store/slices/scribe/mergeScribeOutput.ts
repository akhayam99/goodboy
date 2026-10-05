import type { ExtractedScribeText } from '@goodboy/core';

type Params = {
  readonly previous: ExtractedScribeText | null;
  readonly next: ExtractedScribeText;
};

export const hasScribeText = ({ output }: { readonly output: ExtractedScribeText }): boolean =>
  output.prTitle !== null ||
  output.prBody !== null ||
  output.changelogEntry !== null ||
  output.commitMessages.length > 0;

export const mergeScribeOutput = ({ previous, next }: Params): ExtractedScribeText => {
  if (previous === null) {
    return next;
  }
  return {
    prTitle: next.prTitle ?? previous.prTitle,
    prBody: next.prBody ?? previous.prBody,
    commitMessages: next.commitMessages.length > 0 ? next.commitMessages : previous.commitMessages,
    changelogEntry: next.changelogEntry ?? previous.changelogEntry,
  };
};
