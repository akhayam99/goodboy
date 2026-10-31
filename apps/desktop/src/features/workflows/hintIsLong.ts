type Params = {
  readonly text: string;
  readonly isClipped: boolean;
};

export const hintIsLong = ({ text, isClipped }: Params): boolean =>
  text.trim().includes('\n') || isClipped;
