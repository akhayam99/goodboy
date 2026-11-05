const MAX_LENGTH = 158;

export const clipText = (text: string) => {
  if (text.length <= MAX_LENGTH) {
    return text;
  }
  const cut = text.slice(0, MAX_LENGTH - 3);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.;:]$/, '')}...`;
};
