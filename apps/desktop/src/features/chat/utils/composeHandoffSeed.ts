import { stripControlMarkers } from '@goodboy/core';

type Params = {
  readonly sourceName: string;
  readonly reason: string;
  readonly output: string;
};

export const composeHandoffSeed = ({ sourceName, reason, output }: Params): string => {
  const trimmedReason = reason.trim();
  const header =
    trimmedReason === ''
      ? `Follow-up from ${sourceName}.`
      : `Follow-up from ${sourceName}: ${trimmedReason}`;
  const trimmedOutput = stripControlMarkers(output).trim();
  if (trimmedOutput === '') {
    return header;
  }
  return `${header}\n\nWhat ${sourceName} found:\n\n${trimmedOutput}`;
};
