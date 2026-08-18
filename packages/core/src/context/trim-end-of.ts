type TrimParams = {
  readonly text: string;
  readonly characters: string;
};

export const trimEndOf = ({ text, characters }: TrimParams): string => {
  let end = text.length;
  while (end > 0 && characters.includes(text.charAt(end - 1))) {
    end -= 1;
  }
  return text.slice(0, end);
};
