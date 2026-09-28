export const NEW_CHAT_TITLE = 'New chat';

const MAX_TITLE_LENGTH = 60;

type Params = {
  readonly question: string;
};

export const chatTitleFromQuestion = ({ question }: Params): string => {
  const firstLine = question
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '');
  if (firstLine === undefined) {
    return NEW_CHAT_TITLE;
  }
  if (firstLine.length <= MAX_TITLE_LENGTH) {
    return firstLine;
  }
  return `${firstLine.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
};
