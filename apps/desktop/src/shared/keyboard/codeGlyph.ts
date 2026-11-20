type Params = {
  readonly code: string;
  readonly glyphs: Record<string, string>;
};

export const codeGlyph = ({ code, glyphs }: Params): string => {
  if (glyphs[code] != null) {
    return glyphs[code];
  }
  if (code.startsWith('Key')) {
    return code.slice(3);
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  return code;
};
