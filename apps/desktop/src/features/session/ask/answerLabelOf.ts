type Params = {
  readonly text: string;
  readonly number: number;
};

const MAX_WORDS_LENGTH = 32;

export const answerLabelOf = ({ text, number }: Params): string => {
  const words = text.replace(/\s+/g, ' ').trim();
  if (words === '') {
    return `Answer question ${number}`;
  }
  if (words.length <= MAX_WORDS_LENGTH) {
    return `Answer: ${words}`;
  }
  const cut = words.slice(0, MAX_WORDS_LENGTH + 1);
  const lastSpace = cut.lastIndexOf(' ');
  const head = lastSpace > 0 ? cut.slice(0, lastSpace) : cut.slice(0, MAX_WORDS_LENGTH);
  return `Answer: ${head}…`;
};
