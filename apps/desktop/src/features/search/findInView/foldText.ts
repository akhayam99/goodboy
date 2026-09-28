export type FoldedText = {
  readonly folded: string;
  readonly offsets: ReadonlyArray<number>;
};

type Params = {
  readonly text: string;
};

const foldChar = ({ text }: Params): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const foldText = ({ text }: Params): FoldedText => {
  let folded = '';
  const offsets: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const piece = foldChar({ text: text[index] ?? '' });
    folded += piece;
    for (let step = 0; step < piece.length; step += 1) {
      offsets.push(index);
    }
  }
  offsets.push(text.length);
  return { folded, offsets };
};

export const findTokens = ({ text }: Params): ReadonlyArray<string> =>
  foldChar({ text })
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, 12);
