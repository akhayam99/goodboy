import { stripControlMarkers } from '@goodboy/core';

const MAX_LENGTH = 2000;

export const agentLastMessage = ({ assistantText }: { readonly assistantText: string }): string => {
  const text = stripControlMarkers(assistantText).trim();
  if (text.length <= MAX_LENGTH) {
    return text;
  }
  const tail = text.slice(-MAX_LENGTH);
  const paragraph = tail.indexOf('\n\n');
  return (paragraph === -1 ? tail : tail.slice(paragraph + 2)).trim();
};
