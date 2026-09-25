const SENTENCE_END = /[.!?](?=\s|$)/;

export const firstSentence = ({ text }: { readonly text: string }): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const match = SENTENCE_END.exec(flat);
  return match === null ? flat : flat.slice(0, match.index + 1);
};
