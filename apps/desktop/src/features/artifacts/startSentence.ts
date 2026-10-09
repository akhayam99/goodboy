export const startSentence = ({ text }: { readonly text: string }): string =>
  text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
