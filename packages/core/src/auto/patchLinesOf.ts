export type PatchLine = Readonly<{
  index: number;
  sign: '+' | '-' | ' ' | '@';
  text: string;
  isMoved: boolean;
}>;

type LinesParams = {
  readonly lines: ReadonlyArray<string>;
};

type TrimParams = {
  readonly text: string;
};

const withoutCommaOf = ({ text }: TrimParams): string => {
  const trimmed = text.trimEnd();
  return trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
};

type SignParams = {
  readonly line: string;
};

const SIGNS: ReadonlyArray<PatchLine['sign']> = ['+', '-', ' '];

const patchSignOf = ({ line }: SignParams): PatchLine['sign'] | null => {
  if (line.startsWith('@@')) {
    return '@';
  }
  if (line === '') {
    return ' ';
  }
  return SIGNS.find((sign) => line.startsWith(sign)) ?? null;
};

export const patchLinesOf = ({ lines }: LinesParams): ReadonlyArray<PatchLine> => {
  const start = lines.findIndex((line) => line.startsWith('@@'));
  if (start === -1) {
    return [];
  }
  const parsed: Array<{ index: number; sign: PatchLine['sign']; text: string }> = [];
  for (const [offset, line] of lines.slice(start).entries()) {
    const sign = patchSignOf({ line });
    if (sign !== null) {
      parsed.push({ index: start + offset, sign, text: sign === '@' ? line : line.slice(1) });
    }
  }
  const moved = new Set<number>();
  for (const [position, line] of parsed.entries()) {
    const next = parsed[position + 1];
    const isPair =
      line.sign === '-' &&
      next !== undefined &&
      next.sign === '+' &&
      withoutCommaOf({ text: line.text }) === withoutCommaOf({ text: next.text });
    if (isPair) {
      moved.add(line.index);
      moved.add(next.index);
    }
  }
  return parsed.map((line) => ({ ...line, isMoved: moved.has(line.index) }));
};
