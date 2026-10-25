const MODIFIER_RANK: Readonly<Record<string, number>> = { cmd: 0, ctrl: 1, alt: 2, shift: 3 };

type Params = {
  readonly combo: string;
};

export const normalizeCombo = ({ combo }: Params): string => {
  const parts = combo.split('+');
  const code = parts.at(-1) ?? '';
  const modifiers = parts
    .slice(0, -1)
    .sort((first, second) => (MODIFIER_RANK[first] ?? 9) - (MODIFIER_RANK[second] ?? 9));
  return [...modifiers, code].join('+');
};
